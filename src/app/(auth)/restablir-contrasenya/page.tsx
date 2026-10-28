import type { Metadata } from "next"

import { ResetPasswordForm } from "@/components/app/reset-password-form"

export const metadata: Metadata = { title: "Restablir contrasenya" }

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/restablir-contrasenya">) {
  const sp = await searchParams
  const token = typeof sp.token === "string" ? sp.token : undefined
  const invalid = sp.error === "INVALID_TOKEN"

  return <ResetPasswordForm token={token} invalid={invalid} />
}
