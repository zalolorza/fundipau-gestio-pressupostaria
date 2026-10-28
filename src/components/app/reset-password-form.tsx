"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { resetPassword } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

export function ResetPasswordForm({
  token,
  invalid,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  token?: string
  invalid?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!token) return
    const f = new FormData(e.currentTarget)
    const password = String(f.get("password"))
    const confirm = String(f.get("confirm"))
    if (password !== confirm) {
      toast.error("Les contrasenyes no coincideixen")
      return
    }
    setPending(true)
    const { error } = await resetPassword({
      newPassword: password,
      token,
    })
    setPending(false)
    if (error) {
      toast.error(
        error.code === "INVALID_TOKEN"
          ? "L’enllaç no és vàlid o ha caducat"
          : (error.message ?? "No s'ha pogut restablir la contrasenya"),
      )
      return
    }
    toast.success("Contrasenya actualitzada")
    router.push("/login")
    router.refresh()
  }

  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      <div className="flex justify-center">
        <Logo className="h-auto w-40" color="blanc" variant="icon" />
      </div>
      <Card className="overflow-hidden rounded-xl! p-0">
        <CardContent className="p-0">
          {invalid || !token ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-6 text-center md:p-8">
              <h1 className="font-heading text-2xl font-bold">
                Enllaç no vàlid
              </h1>
              <p className="text-balance text-muted-foreground">
                Aquest enllaç de restabliment no és vàlid o ha caducat. Torna a
                demanar-ne un de nou.
              </p>
              <Button asChild size="lg">
                <Link href="/recuperar-contrasenya">Demana un enllaç nou</Link>
              </Button>
            </div>
          ) : (
            <form
              className="flex min-h-[320px] flex-col justify-center p-6 md:p-8"
              onSubmit={onSubmit}
            >
              <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="font-heading text-2xl font-bold">
                    Nova contrasenya
                  </h1>
                  <p className="text-balance text-muted-foreground">
                    Tria una contrasenya nova d’almenys 8 caràcters.
                  </p>
                </div>
                <Field>
                  <FieldLabel htmlFor="password">Nova contrasenya</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="min-h-10"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm">
                    Confirma la contrasenya
                  </FieldLabel>
                  <Input
                    id="confirm"
                    name="confirm"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="min-h-10"
                  />
                </Field>
                <Field>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={pending}
                    className="w-full"
                  >
                    {pending ? "Un moment…" : "Desa la contrasenya"}
                  </Button>
                </Field>
                <FieldDescription className="text-center">
                  <Link
                    href="/login"
                    className="underline-offset-4 hover:underline"
                  >
                    Torna a l’inici de sessió
                  </Link>
                </FieldDescription>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
