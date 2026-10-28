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
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { SupplierInvoice } from "@/db/schema"
import { COST_TYPE_LABELS, type CostType } from "@/lib/cost-type"
import { formatEuro } from "@/lib/format"
import {
  computeInvoice,
  deductibleVatAmount,
  DEFAULT_VAT_DEDUCTIBLE_RATE,
  invoiceCost,
  VAT_RATES,
} from "@/lib/invoice"
import type { ExtractedInvoiceFields } from "@/lib/invoice-extract-types"
import { saveInvoice } from "@/server/actions"
import { extractInvoiceFromPathname } from "@/server/invoice-extract-actions"
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

function todayISO() {
  return new Date().toISOString().slice(0, 10)
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

function emptyStr(v: string | null | undefined) {
  return !v?.trim()
}

function normTaxId(v: string | null | undefined) {
  return (v ?? "").replace(/[\s.-]/g, "").toUpperCase()
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
  defaultVatDeductibleRate = DEFAULT_VAT_DEDUCTIBLE_RATE,
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
  /** % d'IVA deduïble per defecte (dels ajustos) en crear una factura */
  defaultVatDeductibleRate?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const [pending, start] = useTransition()
  const [extracting, setExtracting] = useState(false)
  const [alloc, setAlloc] = useState<AllocationRow[]>([])
  const [supplierId, setSupplierId] = useState<string>(NONE)
  const [fiscal, setFiscal] = useState<Fiscal>(EMPTY)
  const [createSupplier, setCreateSupplier] = useState(false)
  const [number, setNumber] = useState("")
  const [issueDate, setIssueDate] = useState(todayISO())
  const [description, setDescription] = useState("")
  const [base, setBase] = useState<number>(NaN)
  const [vatRate, setVatRate] = useState("21")
  const [vatDeductibleRate, setVatDeductibleRate] = useState(defaultVatDeductibleRate)
  const [irpfRate, setIrpfRate] = useState(0)
  const [costType, setCostType] = useState<CostType>("direct")
  const [file, setFile] = useState<InvoiceFileValue | null>(null)

  const calc = computeInvoice(base || 0, Number(vatRate), irpfRate || 0)
  const deductibleRate = vatDeductibleRate || 0
  const deductibleVat = deductibleVatAmount({
    vatAmount: calc.vatAmount,
    vatDeductibleRate: deductibleRate,
  })
  const imputable = invoiceCost({
    baseAmount: base || 0,
    vatAmount: calc.vatAmount,
    vatDeductibleRate: deductibleRate,
  })
  const linked = supplierId !== NONE ? suppliers.find((s) => s.id === supplierId) : undefined

  function reset() {
    setAlloc(allocations ?? [])
    setCreateSupplier(false)
    setBase(invoice?.baseAmount ?? NaN)
    setNumber(invoice?.number ?? "")
    setIssueDate(invoice?.issueDate ?? todayISO())
    setDescription(invoice?.description ?? "")
    setFile(
      invoice?.filePathname
        ? { filePathname: invoice.filePathname, fileName: invoice.fileName ?? "arxiu" }
        : null
    )
    setExtracting(false)
    if (invoice) {
      setSupplierId(invoice.supplierId ?? NONE)
      setFiscal(fiscalFromInvoice(invoice))
      setVatRate(String(invoice.vatRate))
      setVatDeductibleRate(invoice.vatDeductibleRate)
      setCostType(invoice.costType)
      setIrpfRate(invoice.irpfRate)
      return
    }
    const pre = defaultSupplierId ? suppliers.find((s) => s.id === defaultSupplierId) : undefined
    setSupplierId(pre?.id ?? NONE)
    setFiscal(pre ? fiscalFromSupplier(pre) : EMPTY)
    setVatRate(allowedRate(VAT_RATES, pre?.defaultVatRate, 21))
    setVatDeductibleRate(defaultVatDeductibleRate)
    setIrpfRate(pre?.defaultIrpfRate ?? 0)
    setCostType("direct")
  }

  // Reset en obrir (incl. obertura controlada que no passa per onOpenChange).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) reset()
  }

  function handleOpenChange(next: boolean) {
    if (!next && extracting) return
    setOpen(next)
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

  function applyExtracted(data: ExtractedInvoiceFields): boolean {
    let filled = false

    if (data.number && emptyStr(number)) {
      setNumber(data.number)
      filled = true
    }
    // La data del document preval (el valor per defecte és «avui»)
    if (data.issueDate) {
      setIssueDate(data.issueDate)
      filled = true
    }
    if (data.description && emptyStr(description)) {
      setDescription(data.description)
      filled = true
    }
    const amountsEmpty = Number.isNaN(base)
    if (data.baseAmount != null && amountsEmpty) {
      setBase(data.baseAmount)
      filled = true
    }
    // IVA / IRPF només si els imports encara no s'havien omplert
    if (amountsEmpty && data.vatRate != null) {
      setVatRate(String(data.vatRate))
      filled = true
    }
    if (amountsEmpty && data.irpfRate != null) {
      setIrpfRate(data.irpfRate)
      filled = true
    }

    const taxNorm = normTaxId(data.supplierTaxId)
    const match =
      taxNorm &&
      suppliers.find((s) => s.taxId && normTaxId(s.taxId) === taxNorm)

    if (match && supplierId === NONE) {
      onPickSupplier(match.id)
      filled = true
    } else {
      const next = { ...fiscal }
      let fiscalChanged = false
      const fill = (k: keyof Fiscal, v: string | null | undefined) => {
        if (!v?.trim() || !emptyStr(fiscal[k])) return
        next[k] = v.trim()
        fiscalChanged = true
      }
      fill("supplierName", data.supplierName)
      fill("supplierTaxId", data.supplierTaxId)
      fill("supplierAddress", data.supplierAddress)
      fill("supplierPostalCode", data.supplierPostalCode)
      fill("supplierCity", data.supplierCity)
      if (fiscalChanged) {
        setFiscal(next)
        filled = true
      }
    }

    return filled
  }

  async function onFileUploaded(next: InvoiceFileValue) {
    setExtracting(true)
    try {
      const res = await extractInvoiceFromPathname(next.filePathname)
      if (!res.ok) {
        // Sense clau configurada: silenciós (l'arxiu ja s'ha pujat)
        if (res.error.includes("no està configurada")) return
        toast.error(res.error)
        return
      }
      if (!res.data) return
      if (applyExtracted(res.data)) toast.success("Hem omplert els camps a partir de l'arxiu")
      else toast.message("No s'han trobat camps buits per omplir")
    } finally {
      setExtracting(false)
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const err = allocationError(alloc, "max")
    if (err) return void toast.error(`Projectes: ${err}`)
    start(async () => {
      const res = await saveInvoice(
        invoice?.id ?? null,
        {
          number,
          issueDate,
          description,
          ...fiscal,
          supplierId: linked?.id ?? null,
          baseAmount: base,
          vatRate: Number(vatRate),
          vatDeductibleRate,
          irpfRate,
          costType,
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
      <DialogContent
        className="sm:max-w-3xl"
        showCloseButton={!extracting}
        onEscapeKeyDown={(e) => {
          if (extracting) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (extracting) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (extracting) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{invoice ? `Factura ${invoice.number}` : "Nova factura de proveïdor"}</DialogTitle>
          <DialogDescription>Dades de la factura, del proveïdor i repartiment entre projectes.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          {extracting && (
            <div
              className="absolute inset-0 z-10 bg-popover/55 backdrop-blur-[2px]"
              aria-busy
              aria-live="polite"
            >
              <div className="sticky top-0 flex h-[min(20rem,45svh)] flex-col items-center justify-center gap-3">
                <Spinner className="size-8 text-primary" />
                <p className="text-sm font-medium text-foreground">Llegint la factura…</p>
              </div>
            </div>
          )}
          <form
            id="invoice-form"
            onSubmit={onSubmit}
            className={extracting ? "pointer-events-none select-none" : undefined}
            inert={extracting}
          >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="number">Número *</FieldLabel>
                <Input
                  id="number"
                  name="number"
                  required
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="issueDate">Data *</FieldLabel>
                <DatePicker
                  id="issueDate"
                  name="issueDate"
                  required
                  value={issueDate}
                  onChange={setIssueDate}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="description">Descripció</FieldLabel>
              <Textarea
                id="description"
                name="description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>

            <InvoiceFileField
              value={file}
              onChange={setFile}
              committedPathname={invoice?.filePathname}
              onUploaded={onFileUploaded}
              extracting={extracting}
            />

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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                  <FieldLabel htmlFor="vatDeductibleRate">IVA deduïble (%)</FieldLabel>
                  <Input
                    id="vatDeductibleRate"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    required
                    value={Number.isNaN(vatDeductibleRate) ? "" : vatDeductibleRate}
                    onChange={(e) => setVatDeductibleRate(e.target.valueAsNumber)}
                  />
                  <FieldDescription className="tabular-nums">
                    {formatEuro(deductibleVat)} de l&apos;IVA
                  </FieldDescription>
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
                    Cost imputable {formatEuro(imputable)}
                  </FieldDescription>
                </Field>
              </div>
            </FieldSet>

            <Field>
              <FieldLabel>Tipus de cost</FieldLabel>
              <Select value={costType} onValueChange={(v) => setCostType(v as CostType)}>
                <SelectTrigger className="w-full sm:w-56" aria-label="Tipus de cost">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">{COST_TYPE_LABELS.direct}</SelectItem>
                  <SelectItem value="indirect">{COST_TYPE_LABELS.indirect}</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Directe si el cost està vinculat al projecte; indirecte si és d&apos;estructura o suport.
              </FieldDescription>
            </Field>

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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={extracting}>
            Cancel·la
          </Button>
          <Button type="submit" form="invoice-form" disabled={pending || extracting}>
            {pending ? "Desant…" : "Desa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
