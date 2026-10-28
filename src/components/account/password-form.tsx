"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"

const MIN = 8

const ERRORS: Record<string, string> = {
  INVALID_PASSWORD: "La contrasenya actual no és correcta",
  PASSWORD_TOO_SHORT: `La contrasenya nova ha de tenir com a mínim ${MIN} caràcters`,
  PASSWORD_TOO_LONG: "La contrasenya nova és massa llarga",
}

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revokeOthers, setRevokeOthers] = useState(true)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const f = new FormData(e.currentTarget)
    const currentPassword = String(f.get("currentPassword"))
    const newPassword = String(f.get("newPassword"))
    const confirm = String(f.get("confirmPassword"))

    if (newPassword.length < MIN) return setError(ERRORS.PASSWORD_TOO_SHORT)
    if (newPassword !== confirm) return setError("Les dues contrasenyes noves no coincideixen")
    if (newPassword === currentPassword) return setError("La contrasenya nova ha de ser diferent de l'actual")

    setPending(true)
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: revokeOthers,
    })
    setPending(false)
    if (error) return setError((error.code && ERRORS[error.code]) || "No s'ha pogut canviar la contrasenya")

    formRef.current?.reset()
    toast.success(
      revokeOthers
        ? "Contrasenya canviada. S'han tancat les sessions dels altres dispositius."
        : "Contrasenya canviada"
    )
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="max-w-md">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="currentPassword">Contrasenya actual</FieldLabel>
          <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
        </Field>
        <Field>
          <FieldLabel htmlFor="newPassword">Contrasenya nova</FieldLabel>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={MIN}
            autoComplete="new-password"
          />
          <FieldDescription>Com a mínim {MIN} caràcters.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmPassword">Repeteix la contrasenya nova</FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={MIN}
            autoComplete="new-password"
          />
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="revoke" checked={revokeOthers} onCheckedChange={(v) => setRevokeOthers(v === true)} />
          <FieldLabel htmlFor="revoke" className="font-normal">
            Tanca la sessió als altres dispositius
          </FieldLabel>
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Canviant…" : "Canvia la contrasenya"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
