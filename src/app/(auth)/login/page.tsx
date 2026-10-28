import type { Metadata } from "next"
import { connection } from "next/server"

import { AuthForm } from "@/components/app/auth-form"

export const metadata: Metadata = { title: "Inicia la sessió" }

export default async function LoginPage() {
  await connection()
  return <AuthForm mode="login" allowSignup={process.env.ALLOW_SIGNUP === "true"} />
}
