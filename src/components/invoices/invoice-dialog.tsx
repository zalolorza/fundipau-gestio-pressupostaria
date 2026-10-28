"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { AllocationEditor, allocationError, type AllocationRow } from "@/components/app/allocation-editor"
import { InvoiceFileField, type InvoiceFileValue } from "@/components/invoices/invoice-file-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { SupplierInvoice } from "@/db/schema"
import { formatEuro } from "@/lib/format"
import { computeInvoice, invoiceCost, VAT_RATES } from "@/lib/invoice"
import { saveInvoice } from "@/server/actions"
import type { SupplierOption } from "@/server/queries"

type Fiscal = {
  supplierName: string
  supplierTaxId: string | null
  supplierAddress: string | null
  supplierPostalCode: string | null
  supplierCity: string | null
}

const NONE = "none"
const EMPTY: Fiscal = {
  supplierName: "",
  supplierTaxId: "",
  supplierAddress: "",
  supplierPostalCode: "",
  supplierCity: "",
}

function fiscalFromInvoice(i: SupplierInvoice): Fiscal {
  return {
    supplierName: i.supplierName,
    supplierTaxId: i.supplierTaxId,
    supplierAddress: i.supplierAddress,
    supplierPostalCode: i.supplierPostalCode,
    supplierCity: i.supplierCity,
  }
}

function fiscalFromSupplier(s: SupplierOption): Fiscal {
  return {
    supplierName: s.name,
    supplierTaxId: s.taxId,
    supplierAddress: s.address,
    supplierPostalCode: s.postalCode,
    supplierCity: s.city,
  }
}

/** Les rates que s'han de proposar segons el proveïdor (o la factura existent) */
const allowedRate = (list: number[], v: number | undefined, fallback: number) =>
  String(v != null && list.includes(v) ? v : fallback)

export function InvoiceDialog({
  invoice,
  allocations,
  projectOptions,
  suppliers,
  defaultSupplierId,
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  invoice?: SupplierInvoice
  allocations?: AllocationRow[]
  projectOptions: { id: string; name: string; hint?: string }[]
  suppliers: SupplierOption[]
  /** Proveïdor preseleccionat en crear una factura (p. ex. des de la fitxa del proveïdor) */
  defaultSupplierId?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const [pending, start] = useTransition()
  const [alloc, setAlloc] = useState<AllocationRow[]>([])
  const [supplierId, setSupplierId] = useState<string>(NONE)
  const [fiscal, setFiscal] = useState<Fiscal>(EMPTY)
  const [createSupplier, setCreateSupplier] = useState(false)
  const [base, setBase] = useState<number>(NaN)
  const [vatRate, setVatRate] = useState("21")
  const [irpfRate, setIrpfRate] = useState(0)
  const [file, setFile] = useState<InvoiceFileValue | null>(null)

  const calc = computeInvoice(base || 0, Number(vatRate), irpfRate || 0)
  const linked = supplierId !== NONE ? suppliers.find((s) => s.id === supplierId) : undefined

  function reset() {
    setAlloc(allocations ?? [])
    setCreateSupplier(false)
    setBase(invoice?.baseAmount ?? NaN)
    setFile(
      invoice?.filePathname
        ? { filePathname: invoice.filePathname, fileName: invoice.fileName ?? "arxiu" }
        : null
    )
    if (invoice) {
      setSupplierId(invoice.supplierId ?? NONE)
      setFiscal(fiscalFromInvoice(invoice))
      setVatRate(String(invoice.vatRate))
      setIrpfRate(invoice.irpfRate)
      return
    }
    const pre = defaultSupplierId ? suppliers.find((s) => s.id === defaultSupplierId) : undefined
    setSupplierId(pre?.id ?? NONE)
    setFiscal(pre ? fiscalFromSupplier(pre) : EMPTY)
    setVatRate(allowedRate(VAT_RATES, pre?.defaultVatRate, 21))
    setIrpfRate(pre?.defaultIrpfRate ?? 0)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) reset()
  }

  function onPickSupplier(id: string) {
    setSupplierId(id)
    if (id === NONE) return
    const s = suppliers.find((x) => x.id === id)
    if (!s) return
    setFiscal(fiscalFromSupplier(s))
    setVatRate(allowedRate(VAT_RATES, s.defaultVatRate, 21))
    setIrpfRate(s.defaultIrpfRate)
    setCreateSupplier(false)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const err = allocationError(alloc, "max")
    if (err) return void toast.error(`Projectes: ${err}`)
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    start(async () => {
      const res = await saveInvoice(
        invoice?.id ?? null,
        {
          ...f,
          ...fiscal,
          supplierId: linked?.id ?? null,
          baseAmount: base,
          vatRate: Number(vatRate),
          irpfRate,
          file,
        } as never,
        alloc,
        { createSupplier: !linked && createSupplier }
      )
      if (!res.ok) return void toast.error(res.error)
      toast.success(
        invoice ? "Factura actualitzada" : !linked && createSupplier ? "Factura i proveïdor creats" : "Factura creada"
      )
      setOpen(false)
    })
  }

  const fiscalField = (k: keyof Fiscal) => ({
    value: fiscal[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFiscal({ ...fiscal, [k]: e.target.value }),
  })

  // Si les dades de la factura difereixen de la fitxa del proveïdor, ho indiquem
  const differs =
    linked &&
    (fiscal.supplierName !== linked.name ||
      (fiscal.supplierTaxId ?? "") !== (linked.taxId ?? "") ||
      (fiscal.supplierAddress ?? "") !== (linked.address ?? ""))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{invoice ? `Factura ${invoice.number}` : "Nova factura de proveïdor"}</DialogTitle>
          <DialogDescription>Dades de la factura, del proveïdor i repartiment entre projectes.</DialogDescription>
        </DialogHeader>
        <form id="invoice-form" onSubmit={onSubmit}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="number">Número *</FieldLabel>
                <Input id="number" name="number" required defaultValue={invoice?.number} />
              </Field>
              <Field>
                <FieldLabel htmlFor="issueDate">Data *</FieldLabel>
                <DatePicker
                  id="issueDate"
                  name="issueDate"
                  required
                  defaultValue={invoice?.issueDate ?? new Date().toISOString().slice(0, 10)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="description">Descripció</FieldLabel>
              <Textarea id="description" name="description" rows={2} defaultValue={invoice?.description ?? ""} />
            </Field>

            <InvoiceFileField value={file} onChange={setFile} committedPathname={invoice?.filePathname} />

            <FieldSet>
              <FieldLegend>Proveïdor</FieldLegend>
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
                      Factura enllaçada a{" "}
                      <Link href={`/proveidors/${linked.id}`} className="text-primary hover:underline">
                        {linked.name}
                      </Link>
                      . Les dades fiscals es copien a la factura i es poden ajustar.
                      {differs && " (Ara difereixen de la fitxa del proveïdor.)"}
                    </>
                  ) : (
                    "La factura no estarà enllaçada a cap proveïdor."
                  )}
                </FieldDescription>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="supplierName">Nom o raó social *</FieldLabel>
                  <Input id="supplierName" required {...fiscalField("supplierName")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="supplierTaxId">NIF / CIF</FieldLabel>
                  <Input id="supplierTaxId" {...fiscalField("supplierTaxId")} />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="supplierAddress">Adreça</FieldLabel>
                  <Input id="supplierAddress" {...fiscalField("supplierAddress")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="supplierPostalCode">Codi postal</FieldLabel>
                  <Input id="supplierPostalCode" {...fiscalField("supplierPostalCode")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="supplierCity">Població</FieldLabel>
                  <Input id="supplierCity" {...fiscalField("supplierCity")} />
                </Field>
              </div>
              {!linked && (
                <Field orientation="horizontal">
                  <Checkbox
                    id="createSupplier"
                    checked={createSupplier}
                    onCheckedChange={(v) => setCreateSupplier(v === true)}
                  />
                  <FieldLabel htmlFor="createSupplier" className="font-normal">
                    Afegeix aquest proveïdor a la llista i enllaça-hi la factura
                  </FieldLabel>
                </Field>
              )}
            </FieldSet>

            <FieldSet>
              <FieldLegend>Imports</FieldLegend>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field>
                  <FieldLabel htmlFor="baseAmount">Base imposable *</FieldLabel>
                  <Input
                    id="baseAmount"
                    type="number"
                    step="0.01"
                    required
                    value={Number.isNaN(base) ? "" : base}
                    onChange={(e) => setBase(e.target.valueAsNumber)}
                  />
                </Field>
                <Field>
                  <FieldLabel>IVA</FieldLabel>
                  <Select value={vatRate} onValueChange={setVatRate}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...new Set([...VAT_RATES, Number(vatRate)])].map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          {r} %
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription className="tabular-nums">{formatEuro(calc.vatAmount)}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="irpfRate">IRPF (%)</FieldLabel>
                  <Input
                    id="irpfRate"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    required
                    value={Number.isNaN(irpfRate) ? "" : irpfRate}
                    onChange={(e) => setIrpfRate(e.target.valueAsNumber)}
                  />
                  <FieldDescription className="tabular-nums">−{formatEuro(calc.irpfAmount)}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Total factura</FieldLabel>
                  <p className="flex h-8 items-center text-lg font-semibold tabular-nums">{formatEuro(calc.total)}</p>
                  <FieldDescription className="tabular-nums">
                    Cost imputable {formatEuro(invoiceCost({ baseAmount: base || 0, vatAmount: calc.vatAmount }))}
                  </FieldDescription>
                </Field>
              </div>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Projectes</FieldLegend>
              <FieldDescription>
                Percentatge del cost imputat a cada projecte. Pot quedar una part sense assignar.
              </FieldDescription>
              <AllocationEditor
                value={alloc}
                onChange={setAlloc}
                options={projectOptions}
                mode="max"
                itemLabel="projecte"
                emptyText="Factura sense assignar a cap projecte"
              />
            </FieldSet>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel·la
          </Button>
          <Button type="submit" form="invoice-form" disabled={pending}>
            {pending ? "Desant…" : "Desa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
