"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { CategoryPicker, type CategoryRef } from "@/components/categories/category-picker"
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { MonthPicker } from "@/components/ui/month-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { COST_TYPE_LABELS, type CostType } from "@/lib/cost-type"
import { formatEuro } from "@/lib/format"
import { currentMonth } from "@/lib/months"
import { assignPayrollToProject, unassignPayrollEntries } from "@/server/actions"

export type PayrollOption = {
  id: string
  personName: string
  role: string | null
  monthlyAmount: number
  startMonth: string
  lastMonth: string | null
}

export type PayrollAssignmentEdit = {
  payrollId: string
  from: string
  to: string
  percentage: number
  costType?: CostType
  categoryIds?: string[]
  /** Mesos actualment assignats; els que quedin fora del nou rang es desassignen. */
  entryIdsByMonth?: { entryId: string; month: string }[]
}

export function AssignPayrollDialog({
  projectId,
  payrolls,
  categories: initialCategories = [],
  defaultFrom,
  defaultTo,
  edit,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  children,
}: {
  projectId: string
  payrolls: PayrollOption[]
  categories?: CategoryRef[]
  defaultFrom?: string | null
  defaultTo?: string | null
  edit?: PayrollAssignmentEdit | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = setControlledOpen ?? setUncontrolledOpen
  const isEdit = !!edit

  const [payrollId, setPayrollId] = useState<string>("")
  const [from, setFrom] = useState(currentMonth().slice(0, 7))
  const [to, setTo] = useState(currentMonth().slice(0, 7))
  const [percentage, setPercentage] = useState(100)
  const [costType, setCostType] = useState<CostType>("direct")
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [catalog, setCatalog] = useState(initialCategories)
  const [pending, start] = useTransition()

  const sel = payrolls.find((p) => p.id === payrollId)

  function hydrate() {
    setCatalog(initialCategories)
    if (edit) {
      setPayrollId(edit.payrollId)
      setPercentage(edit.percentage)
      setCostType(edit.costType ?? "direct")
      setCategoryIds(edit.categoryIds ?? [])
      setFrom(edit.from.slice(0, 7))
      setTo(edit.to.slice(0, 7))
      return
    }
    setPayrollId("")
    setPercentage(100)
    setCostType("direct")
    setCategoryIds([])
    setFrom((defaultFrom ?? currentMonth()).slice(0, 7))
    setTo((defaultTo && defaultTo < currentMonth() ? defaultTo : currentMonth()).slice(0, 7))
  }

  // Reset en obrir (incl. obertura controlada que no passa per onOpenChange).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) hydrate()
  }

  function handleOpenChange(o: boolean) {
    setOpen(o)
  }

  function submit() {
    start(async () => {
      const res = await assignPayrollToProject(
        projectId,
        payrollId,
        `${from}-01`,
        `${to}-01`,
        percentage,
        costType,
        categoryIds
      )
      if (!res.ok) return void toast.error(res.error)

      if (edit?.entryIdsByMonth?.length) {
        const fromKey = `${from}-01`
        const toKey = `${to}-01`
        const outside = edit.entryIdsByMonth
          .filter((e) => e.month < fromKey || e.month > toKey)
          .map((e) => e.entryId)
        if (outside.length) await unassignPayrollEntries(projectId, outside)
      }

      toast.success(
        isEdit
          ? `Assignació actualitzada (${res.data?.count} ${res.data?.count === 1 ? "mes" : "mesos"})`
          : `Nòmina assignada a ${res.data?.count} ${res.data?.count === 1 ? "mes" : "mesos"}`
      )
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar assignació de nòmina" : "Assignar una nòmina"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Canvia el rang de mesos o el percentatge imputat a aquest projecte."
              : "Imputa un percentatge de la nòmina d&apos;una persona a aquest projecte durant un rang de mesos."}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Persona</FieldLabel>
            {isEdit ? (
              <>
                <Input
                  readOnly
                  value={
                    sel
                      ? `${sel.personName}${sel.role ? ` · ${sel.role}` : ""}`
                      : payrolls.find((p) => p.id === edit.payrollId)?.personName ?? "—"
                  }
                />
                {sel && (
                  <FieldDescription>
                    {formatEuro(sel.monthlyAmount)} / mes · registres fins a {sel.lastMonth?.slice(0, 7) ?? "—"}
                  </FieldDescription>
                )}
              </>
            ) : (
              <>
                <Select value={payrollId} onValueChange={setPayrollId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Tria una persona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {payrolls.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.personName}
                        {p.role && <span className="text-muted-foreground"> · {p.role}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sel && (
                  <FieldDescription>
                    {formatEuro(sel.monthlyAmount)} / mes · registres fins a {sel.lastMonth?.slice(0, 7) ?? "—"}
                  </FieldDescription>
                )}
              </>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="from">Des de</FieldLabel>
              <MonthPicker id="from" value={from} onChange={setFrom} />
            </Field>
            <Field>
              <FieldLabel htmlFor="to">Fins a</FieldLabel>
              <MonthPicker id="to" value={to} onChange={setTo} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="pct">Percentatge de dedicació</FieldLabel>
              <Input
                id="pct"
                type="number"
                min={0.01}
                max={100}
                step="0.01"
                value={Number.isNaN(percentage) ? "" : percentage}
                onChange={(e) => setPercentage(e.target.valueAsNumber)}
              />
            </Field>
            <Field>
              <FieldLabel>Tipus de cost</FieldLabel>
              <Select value={costType} onValueChange={(v) => setCostType(v as CostType)}>
                <SelectTrigger className="w-full" aria-label="Tipus de cost">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">{COST_TYPE_LABELS.direct}</SelectItem>
                  <SelectItem value="indirect">{COST_TYPE_LABELS.indirect}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <FieldLabel>Categories</FieldLabel>
            <CategoryPicker
              categories={catalog}
              value={categoryIds}
              onChange={setCategoryIds}
              onCatalogChange={setCatalog}
            />
          </Field>
          <FieldDescription>
            {isEdit
              ? "Els mesos del nou rang s'actualitzen amb aquest percentatge, tipus i categories. Els mesos que quedin fora del rang es desassignen d'aquest projecte."
              : "Si manquen registres mensuals, es creen amb l'import del mes més proper. Si ja estava assignada, se'n substitueix el percentatge, el tipus i les categories. Cap mes pot superar el 100 % entre tots els projectes."}
          </FieldDescription>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel·la
          </Button>
          <Button onClick={submit} disabled={!payrollId || !from || !to || pending || !(percentage > 0)}>
            {pending ? (isEdit ? "Desant…" : "Assignant…") : isEdit ? "Desa" : "Assigna"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
