"use server";

import { hashPassword } from "better-auth/crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { account, invitations, user } from "@/db/schema";
import { auth, requireAdmin } from "@/lib/auth";
import { isSmtpConfigured, sendInviteEmail } from "@/lib/email";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError)
    return { ok: false, error: e.issues[0]?.message ?? "Dades no vàlides" };
  console.error(e);
  return {
    ok: false,
    error: e instanceof Error ? e.message : "S'ha produït un error",
  };
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function appBaseUrl() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function inviteUrl(token: string) {
  return `${appBaseUrl()}/convidar/${token}`;
}

const inviteSchema = z.object({
  email: z.email("Correu no vàlid").transform((v) => v.trim().toLowerCase()),
  sendEmail: z.boolean().optional(),
  role: z.enum(["user", "admin"]).optional().default("user"),
});

export async function createInvitation(input: {
  email: string;
  sendEmail?: boolean;
  role?: "user" | "admin";
}): Promise<ActionResult<{ id: string; url: string; emailSent: boolean }>> {
  const session = await requireAdmin();
  try {
    const data = inviteSchema.parse(input);
    const shouldEmail = data.sendEmail !== false;

    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, data.email))
      .limit(1);
    if (existingUser)
      return { ok: false, error: "Ja existeix un compte amb aquest correu" };

    const token =
      crypto.randomUUID().replaceAll("-", "") +
      crypto.randomUUID().replaceAll("-", "");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await db
      .delete(invitations)
      .where(
        and(eq(invitations.email, data.email), isNull(invitations.acceptedAt)),
      );

    const [row] = await db
      .insert(invitations)
      .values({
        email: data.email,
        token,
        role: data.role,
        invitedByUserId: session.user.id,
        expiresAt,
      })
      .returning({ id: invitations.id });

    const url = inviteUrl(token);
    let emailSent = false;
    if (shouldEmail && isSmtpConfigured()) {
      try {
        await sendInviteEmail({
          to: data.email,
          inviterName: session.user.name,
          url,
        });
        emailSent = true;
      } catch (emailError) {
        console.error("No s'ha pogut enviar el correu d'invitació", emailError);
      }
    }

    revalidatePath("/usuaries");
    return { ok: true, data: { id: row.id, url, emailSent } };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await db
      .delete(invitations)
      .where(and(eq(invitations.id, id), isNull(invitations.acceptedAt)));
    revalidatePath("/usuaries");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeUser(userId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    if (userId === session.user.id) {
      return { ok: false, error: "No et pots eliminar a tu mateixa" };
    }
    await auth.api.removeUser({
      body: { userId },
      headers: await headers(),
    });
    revalidatePath("/usuaries");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setUserRole(
  userId: string,
  role: "user" | "admin",
): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    if (userId === session.user.id && role !== "admin") {
      return { ok: false, error: "No et pots treure el rol d’administradora" };
    }
    await auth.api.setRole({
      body: { userId, role },
      headers: await headers(),
    });
    revalidatePath("/usuaries");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1, "El nom és obligatori"),
  password: z.string().min(8, "La contrasenya ha de tenir almenys 8 caràcters"),
});

export async function acceptInvitation(input: {
  token: string;
  name: string;
  password: string;
}): Promise<ActionResult> {
  try {
    const data = acceptInviteSchema.parse(input);
    const [invite] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, data.token))
      .limit(1);

    if (!invite) return { ok: false, error: "La invitació no és vàlida" };
    if (invite.acceptedAt)
      return { ok: false, error: "Aquesta invitació ja s’ha utilitzat" };
    if (invite.expiresAt.getTime() < Date.now())
      return { ok: false, error: "La invitació ha caducat" };

    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, invite.email))
      .limit(1);
    if (existingUser)
      return { ok: false, error: "Ja existeix un compte amb aquest correu" };

    const role = invite.role === "admin" ? "admin" : "user";
    // neon-http no suporta transaccions: insercions seqüencials
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(data.password);
    try {
      await db.insert(user).values({
        id,
        name: data.name,
        email: invite.email,
        emailVerified: true,
        role,
      });
      await db.insert(account).values({
        id: crypto.randomUUID(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: passwordHash,
      });
      await db
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(invitations.id, invite.id));
    } catch (e) {
      await db.delete(account).where(eq(account.userId, id));
      await db.delete(user).where(eq(user.id, id));
      throw e;
    }

    await auth.api.signInEmail({
      body: { email: invite.email, password: data.password },
      headers: await headers(),
    });

    revalidatePath("/usuaries");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
