"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { clearAnthropicApiKey, setAnthropicApiKey } from "@/lib/app-settings"
import { requireAdmin } from "@/lib/auth"

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Dades no vàlides" }
  console.error(e)
  return { ok: false, error: e instanceof Error ? e.message : "S'ha produït un error" }
}

const apiKeySchema = z
  .string()
  .trim()
  .min(20, "La clau sembla massa curta")
  .refine((v) => v.startsWith("sk-ant-"), "La clau d'Anthropic ha de començar per sk-ant-")

export async function saveAnthropicApiKey(apiKey: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    const key = apiKeySchema.parse(apiKey)
    await setAnthropicApiKey(key)
    revalidatePath("/ajustaments")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

export async function removeAnthropicApiKey(): Promise<ActionResult> {
  await requireAdmin()
  try {
    await clearAnthropicApiKey()
    revalidatePath("/ajustaments")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}
