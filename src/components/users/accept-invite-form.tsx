"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { acceptInvitation } from "@/server/user-actions"

export function AcceptInviteForm({
  token,
  email,
}: {
  token: string
  email: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setPending(true)
    const res = await acceptInvitation({
      token,
      name: String(f.get("name")),
      password: String(f.get("password")),
    })
    setPending(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success("Compte creat")
    router.push("/")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <Logo className="h-auto w-40" color="blanc" variant="icon" />
      </div>
      <Card className="overflow-hidden p-0">
        <CardContent className="p-6 md:p-8">
          <form className="flex flex-col gap-6" onSubmit={onSubmit}>
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="font-heading text-2xl font-bold">Crea el teu compte</h1>
              <p className="text-balance text-muted-foreground">
                Has estat convidada a la gestió pressupostària de Fundipau.
              </p>
            </div>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Correu electrònic</FieldLabel>
                <Input id="email" value={email} readOnly className="min-h-10 bg-muted" />
              </Field>
              <Field>
                <FieldLabel htmlFor="name">Nom</FieldLabel>
                <Input id="name" name="name" required autoComplete="name" className="min-h-10" />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Contrasenya</FieldLabel>
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
                <Button type="submit" size="lg" disabled={pending} className="w-full">
                  {pending ? "Un moment…" : "Crea el compte"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
