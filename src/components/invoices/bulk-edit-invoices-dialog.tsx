"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { AllocationEditor, allocationError, type AllocationRow } from "@/components/app/allocation-editor"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { VAT_RATES } from "@/lib/invoice"
import { bulkUpdateInvoices } from "@/server/actions"
import type { SupplierOption } from "@/server/queries"

const NONE = "none"

type Fiscal = {
  supplierName: string
  supplierTaxId: string | null
  supplierAddress: string | null
  supplierPostalCode: string | null
  supplierCity: string | null
}

const EMPTY: Fiscal = {
  supplierName: "",
  supplierTaxId: "",
  supplierAddress: "",
  supplierPostalCode: "",
  supplierCity: "",
}

export function BulkEditInvoicesDialog({
  open,
  onOpenChange,
  invoiceIds,
  projectOptions,
  suppliers,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceIds: string[]
  projectOptions: { id: string; name: string; hint?: string }[]
  suppliers: SupplierOption[]
  onDone?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Editar {invoiceIds.length} {invoiceIds.length === 1 ? "factura" : "factures"}
          </DialogTitle>
          <DialogDescription>
            Només s&apos;apliquen els camps que activis. Els imports es recalculen a partir de la base de cada
            factura; l&apos;assignació a projectes substitueix la que tinguin ara.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <BulkEditForm
            key={invoiceIds.join(",")}
            invoiceIds={invoiceIds}
            projectOptions={projectOptions}
            suppliers={suppliers}
            onCancel={() => onOpenChange(false)}
            onDone={() => {
              onOpenChange(false)
              onDone?.()
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function BulkEditForm({
  invoiceIds,
  projectOptions,
  suppliers,
  onCancel,
  onDone,
}: {
  invoiceIds: string[]
  projectOptions: { id: string; name: string; hint?: string }[]
  suppliers: SupplierOption[]
  onCancel: () => void
  onDone: () => void
}) {
  const [pending, start] = useTransition()
  const [changeSupplier, setChangeSupplier] = useState(false)
  const [changeVat, setChangeVat] = useState(false)
  const [changeIrpf, setChangeIrpf] = useState(false)
  const [changeAlloc, setChangeAlloc] = useState(false)
  const [supplierId, setSupplierId] = useState(NONE)
  const [fiscal, setFiscal] = useState<Fiscal>(EMPTY)
  const [vatRate, setVatRate] = useState("21")
  const [irpfRate, setIrpfRate] = useState(0)
  const [alloc, setAlloc] = useState<AllocationRow[]>([])

  const linked = supplierId !== NONE ? suppliers.find((s) => s.id === supplierId) : undefined
  const n = invoiceIds.length
  const hasChange = changeSupplier || changeVat || changeIrpf || changeAlloc

  function onPickSupplier(id: string) {
    setSupplierId(id)
    if (id === NONE) return
    const s = suppliers.find((x) => x.id === id)
    if (!s) return
    setFiscal({
      supplierName: s.name,
      supplierTaxId: s.taxId,
      supplierAddress: s.address,
      supplierPostalCode: s.postalCode,
      supplierCity: s.city,
    })
    if (VAT_RATES.includes(s.defaultVatRate)) setVatRate(String(s.defaultVatRate))
    setIrpfRate(s.defaultIrpfRate)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasChange) return void toast.error("Indica què vols canviar")
    if (changeSupplier && !fiscal.supplierName.trim()) {
      return void toast.error("El nom del proveïdor és obligatori")
    }
    if (changeAlloc) {
      const err = allocationError(alloc, "max")
      if (err) return void toast.error(`Projectes: ${err}`)
    }
    start(async () => {
      const res = await bulkUpdateInvoices(invoiceIds, {
        supplier: changeSupplier
          ? {
              supplierId: linked?.id ?? null,
              ...fiscal,
            }
          : undefined,
        vatRate: changeVat ? Number(vatRate) : undefined,
        irpfRate: changeIrpf ? irpfRate : undefined,
        allocations: changeAlloc ? alloc : undefined,
      })
      if (!res.ok) return void toast.error(res.error)
      toast.success(n === 1 ? "Factura actualitzada" : `${n} factures actualitzades`)
      onDone()
    })
  }

  const fiscalField = (k: keyof Fiscal) => ({
    value: fiscal[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFiscal({ ...fiscal, [k]: e.target.value }),
  })

  return (
    <>
      <form id="bulk-invoice-form" onSubmit={onSubmit}>
        <FieldGroup>
          <FieldSet>
            <Field orientation="horizontal">
              <Checkbox
                id="bulk-supplier"
                checked={changeSupplier}
                onCheckedChange={(v) => setChangeSupplier(v === true)}
              />
              <FieldLabel htmlFor="bulk-supplier">Canviar el proveïdor</FieldLabel>
            </Field>
            {changeSupplier && (
              <>
                <Field>
                  <FieldLabel>Proveïdor de la llista</FieldLabel>
                  <Select value={supplierId} onValueChange={onPickSupplier}>
                    <SelectTrigger className="w-full" aria-label="Proveïdor">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>
                        <span className="text-muted-foreground">Cap · introduir les dades manualment</span>
                      </SelectItem>
                      <SelectSeparator />
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.taxId && <span className="text-muted-foreground"> · {s.taxId}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {linked ? (
                      <>
                        Les factures quedaran enllaçades a{" "}
                        <Link href={`/proveidors/${linked.id}`} className="text-primary hover:underline">
                          {linked.name}
                        </Link>
                        .
                      </>
                    ) : (
                      "Les factures quedaran sense proveïdor enllaçat."
                    )}
                  </FieldDescription>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="bulk-supplierName">Nom o raó social *</FieldLabel>
                    <Input id="bulk-supplierName" required={changeSupplier} {...fiscalField("supplierName")} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="bulk-supplierTaxId">NIF / CIF</FieldLabel>
                    <Input id="bulk-supplierTaxId" {...fiscalField("supplierTaxId")} />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="bulk-supplierAddress">Adreça</FieldLabel>
                    <Input id="bulk-supplierAddress" {...fiscalField("supplierAddress")} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="bulk-supplierPostalCode">Codi postal</FieldLabel>
                    <Input id="bulk-supplierPostalCode" {...fiscalField("supplierPostalCode")} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="bulk-supplierCity">Població</FieldLabel>
                    <Input id="bulk-supplierCity" {...fiscalField("supplierCity")} />
                  </Field>
                </div>
              </>
            )}
          </FieldSet>

          <FieldSet>
            <Field orientation="horizontal">
              <Checkbox id="bulk-vat" checked={changeVat} onCheckedChange={(v) => setChangeVat(v === true)} />
              <FieldLabel htmlFor="bulk-vat">Canviar l&apos;IVA</FieldLabel>
            </Field>
            {changeVat && (
              <Field>
                <FieldLabel>Tipus d&apos;IVA</FieldLabel>
                <Select value={vatRate} onValueChange={setVatRate}>
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
                <FieldDescription>Es recalcula l&apos;import d&apos;IVA i el total de cada factura.</FieldDescription>
              </Field>
            )}
          </FieldSet>

          <FieldSet>
            <Field orientation="horizontal">
              <Checkbox id="bulk-irpf" checked={changeIrpf} onCheckedChange={(v) => setChangeIrpf(v === true)} />
              <FieldLabel htmlFor="bulk-irpf">Canviar l&apos;IRPF</FieldLabel>
            </Field>
            {changeIrpf && (
              <Field>
                <FieldLabel htmlFor="bulk-irpf-rate">Tipus d&apos;IRPF (%)</FieldLabel>
                <Input
                  id="bulk-irpf-rate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  required={changeIrpf}
                  value={Number.isNaN(irpfRate) ? "" : irpfRate}
                  onChange={(e) => setIrpfRate(e.target.valueAsNumber)}
                />
                <FieldDescription>Es recalcula la retenció i el total de cada factura.</FieldDescription>
              </Field>
            )}
          </FieldSet>

          <FieldSet>
            <Field orientation="horizontal">
              <Checkbox id="bulk-alloc" checked={changeAlloc} onCheckedChange={(v) => setChangeAlloc(v === true)} />
              <FieldLabel htmlFor="bulk-alloc">Canviar l&apos;assignació a projectes</FieldLabel>
            </Field>
            {changeAlloc && (
              <>
                <FieldDescription>
                  Aquesta assignació es copiarà a totes les factures seleccionades (substitueix l&apos;actual).
                </FieldDescription>
                <AllocationEditor
                  value={alloc}
                  onChange={setAlloc}
                  options={projectOptions}
                  mode="max"
                  itemLabel="projecte"
                  emptyText="Sense assignar a cap projecte"
                />
              </>
            )}
          </FieldSet>
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel·la
        </Button>
        <Button type="submit" form="bulk-invoice-form" disabled={pending || !hasChange}>
          {pending ? "Desant…" : "Aplica"}
        </Button>
      </DialogFooter>
    </>
  )
}
