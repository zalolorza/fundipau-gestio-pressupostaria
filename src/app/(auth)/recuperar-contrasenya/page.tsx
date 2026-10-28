import type { Metadata } from "next"

import { ForgotPasswordForm } from "@/components/app/forgot-password-form"

export const metadata: Metadata = { title: "Recuperar contrasenya" }

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
