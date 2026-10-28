import "server-only"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { admin } from "better-auth/plugins"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { isAdminRole } from "@/lib/auth-roles"
import { sendPasswordResetEmail } from "@/lib/email"

export { isAdminRole }

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.ALLOW_SIGNUP !== "true",
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: ({ user, url }) =>
      sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        url,
      }),
  },
  plugins: [admin(), nextCookies()],
})

/** Retorna la sessió actual o redirigeix a /login */
export const requireSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")
  return session
})

/** Retorna la sessió d'una administradora o redirigeix */
export const requireAdmin = cache(async () => {
  const session = await requireSession()
  if (!isAdminRole(session.user.role)) redirect("/")
  return session
})
