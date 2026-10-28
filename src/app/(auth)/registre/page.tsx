import type { Metadata } from "next"
import { connection } from "next/server"
import { redirect } from "next/navigation"

import { AuthForm } from "@/components/app/auth-form"

export const metadata: Metadata = { title: "Registre" }

export default async function SignupPage() {
  await connection()
  if (process.env.ALLOW_SIGNUP !== "true") redirect("/login")
  return <AuthForm mode="signup" />
}
