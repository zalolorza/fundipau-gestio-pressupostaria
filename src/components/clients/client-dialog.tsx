"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { Client } from "@/db/schema"
import { saveClient } from "@/server/actions"

export function ClientDialog({ client, children }: { client?: Client; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    start(async () => {
      const res = await saveClient(client?.id ?? null, f as never)
      if (!res.ok) return void toast.error(res.error)
      toast.success(client ? "Client actualitzat" : "Client creat")
      setOpen(false)
      if (!client && res.data) router.push(`/clients/${res.data.id}`)
    })
  }

  const v = (k: keyof Client) => (client?.[k] as string | null) ?? ""

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{client ? "Edita el client" : "Nou client"}</DialogTitle>
          <DialogDescription>Nom, dades fiscals i notes del client.</DialogDescription>
        </DialogHeader>
        <form id="client-form" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Nom *</FieldLabel>
              <Input id="name" name="name" required defaultValue={v("name")} />
            </Field>
            <FieldSet>
              <FieldLegend>Dades fiscals</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="legalName">Raó social</FieldLabel>
                  <Input id="legalName" name="legalName" defaultValue={v("legalName")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="taxId">NIF / CIF</FieldLabel>
                  <Input id="taxId" name="taxId" defaultValue={v("taxId")} />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="address">Adreça</FieldLabel>
                  <Input id="address" name="address" defaultValue={v("address")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="postalCode">Codi postal</FieldLabel>
                  <Input id="postalCode" name="postalCode" defaultValue={v("postalCode")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="city">Població</FieldLabel>
                  <Input id="city" name="city" defaultValue={v("city")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="province">Província</FieldLabel>
                  <Input id="province" name="province" defaultValue={v("province")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="country">País</FieldLabel>
                  <Input id="country" name="country" defaultValue={client ? v("country") : "Espanya"} />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="email">Correu de facturació</FieldLabel>
                  <Input id="email" name="email" type="email" defaultValue={v("email")} />
                </Field>
              </div>
            </FieldSet>
            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" name="notes" rows={3} defaultValue={v("notes")} />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel·la
          </Button>
          <Button type="submit" form="client-form" disabled={pending}>
            {pending ? "Desant…" : "Desa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
