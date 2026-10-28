"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const newName = String(new FormData(e.currentTarget).get("name")).trim()
    if (!newName || newName === name) return
    setPending(true)
    const { error } = await authClient.updateUser({ name: newName })
    setPending(false)
    if (error) return void toast.error("No s'ha pogut desar el nom")
    toast.success("Nom actualitzat")
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Nom</FieldLabel>
          <Input id="name" name="name" required defaultValue={name} autoComplete="name" />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Correu electrònic</FieldLabel>
          <Input id="email" value={email} disabled readOnly />
          <FieldDescription>És el correu amb què inicies la sessió.</FieldDescription>
        </Field>
        <div>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Desant…" : "Desa el nom"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
