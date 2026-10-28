"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
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
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Supplier } from "@/db/schema"
import { IRPF_RATES, VAT_RATES } from "@/lib/invoice"
import { saveSupplier } from "@/server/actions"

export function SupplierDialog({ supplier, children }: { supplier?: Supplier; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [vat, setVat] = useState(String(supplier?.defaultVatRate ?? 21))
  const [irpf, setIrpf] = useState(String(supplier?.defaultIrpfRate ?? 0))
  const router = useRouter()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    start(async () => {
      const res = await saveSupplier(supplier?.id ?? null, {
        ...f,
        defaultVatRate: Number(vat),
        defaultIrpfRate: Number(irpf),
      } as never)
      if (!res.ok) return void toast.error(res.error)
      toast.success(supplier ? "Proveïdor actualitzat" : "Proveïdor creat")
      setOpen(false)
      if (!supplier && res.data) router.push(`/proveidors/${res.data.id}`)
    })
  }

  const v = (k: keyof Supplier) => (supplier?.[k] as string | null) ?? ""

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setVat(String(supplier?.defaultVatRate ?? 21))
          setIrpf(String(supplier?.defaultIrpfRate ?? 0))
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{supplier ? "Edita el proveïdor" : "Nou proveïdor"}</DialogTitle>
          <DialogDescription>
            {supplier
              ? "Els canvis s'aplicaran a les factures noves. Les factures ja registrades conserven les dades fiscals que tenien."
              : "Dades fiscals, de contacte i tipus impositius habituals."}
          </DialogDescription>
        </DialogHeader>
        <form id="supplier-form" onSubmit={onSubmit}>
          <FieldGroup>
            <FieldSet>
              <FieldLegend>Dades fiscals</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="name">Nom o raó social *</FieldLabel>
                  <Input id="name" name="name" required defaultValue={v("name")} />
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
                  <Input id="country" name="country" defaultValue={supplier ? v("country") : "Espanya"} />
                </Field>
              </div>
            </FieldSet>
            <FieldSet>
              <FieldLegend>Contacte i pagament</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="email">Correu</FieldLabel>
                  <Input id="email" name="email" type="email" defaultValue={v("email")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="phone">Telèfon</FieldLabel>
                  <Input id="phone" name="phone" type="tel" defaultValue={v("phone")} />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="iban">IBAN</FieldLabel>
                  <Input id="iban" name="iban" defaultValue={v("iban")} className="font-mono" />
                </Field>
              </div>
            </FieldSet>
            <FieldSet>
              <FieldLegend>Tipus habituals</FieldLegend>
              <FieldDescription>Es proposaran en crear una factura d&apos;aquest proveïdor.</FieldDescription>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>IVA</FieldLabel>
                  <Select value={vat} onValueChange={setVat}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_RATES.map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          {r} %
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>IRPF</FieldLabel>
                  <Select value={irpf} onValueChange={setIrpf}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IRPF_RATES.map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          {r} %
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FieldSet>
            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" name="notes" rows={2} defaultValue={v("notes")} />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel·la
          </Button>
          <Button type="submit" form="supplier-form" disabled={pending}>
            {pending ? "Desant…" : "Desa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
