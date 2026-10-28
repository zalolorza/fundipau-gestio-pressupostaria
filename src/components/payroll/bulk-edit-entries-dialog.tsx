"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import {
  AllocationEditor,
  allocationError,
  type AllocationRow,
} from "@/components/app/allocation-editor"
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatEuro } from "@/lib/format"
import { bulkUpdatePayrollEntries } from "@/server/actions"

export function BulkEditEntriesDialog({
  open,
  onOpenChange,
  payrollId,
  entryIds,
  projectOptions,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  payrollId: string
  entryIds: string[]
  projectOptions: { id: string; name: string; hint?: string }[]
  onDone?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Editar {entryIds.length}{" "}
            {entryIds.length === 1 ? "registre mensual" : "registres mensuals"}
          </DialogTitle>
          <DialogDescription>
            Només s&apos;apliquen els camps que activis. L&apos;assignació a
            projectes substitueix la que tinguin ara.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <BulkEditForm
            key={entryIds.join(",")}
            payrollId={payrollId}
            entryIds={entryIds}
            projectOptions={projectOptions}
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
  payrollId,
  entryIds,
  projectOptions,
  onCancel,
  onDone,
}: {
  payrollId: string
  entryIds: string[]
  projectOptions: { id: string; name: string; hint?: string }[]
  onCancel: () => void
  onDone: () => void
}) {
  const [pending, start] = useTransition()
  const [changeAmount, setChangeAmount] = useState(false)
  const [changeAlloc, setChangeAlloc] = useState(false)
  const [amount, setAmount] = useState(0)
  const [alloc, setAlloc] = useState<AllocationRow[]>([])

  const n = entryIds.length
  const hasChange = changeAmount || changeAlloc

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasChange) return void toast.error("Indica què vols canviar")
    if (changeAmount && !(amount >= 0)) {
      return void toast.error("La quantitat no és vàlida")
    }
    if (changeAlloc) {
      const err = allocationError(alloc, "max")
      if (err) return void toast.error(`Projectes: ${err}`)
    }
    start(async () => {
      const res = await bulkUpdatePayrollEntries(payrollId, entryIds, {
        amount: changeAmount ? amount : undefined,
        allocations: changeAlloc ? alloc : undefined,
      })
      if (!res.ok) return void toast.error(res.error)
      toast.success(
        n === 1
          ? "Registre actualitzat"
          : `${n} registres actualitzats`,
      )
      onDone()
    })
  }

  return (
    <>
      <form id="bulk-payroll-entries-form" onSubmit={onSubmit}>
        <FieldGroup>
          <FieldSet>
            <Field orientation="horizontal">
              <Checkbox
                id="bulk-amount"
                checked={changeAmount}
                onCheckedChange={(v) => setChangeAmount(v === true)}
              />
              <FieldLabel htmlFor="bulk-amount">
                Canviar la mensualitat
              </FieldLabel>
            </Field>
            {changeAmount && (
              <Field>
                <FieldLabel htmlFor="bulk-amount-value">
                  Nova quantitat mensual (€)
                </FieldLabel>
                <Input
                  id="bulk-amount-value"
                  type="number"
                  step="0.01"
                  min={0}
                  required={changeAmount}
                  value={Number.isNaN(amount) ? "" : amount}
                  onChange={(e) => setAmount(e.target.valueAsNumber)}
                />
                <FieldDescription>
                  Es posarà {formatEuro(Number.isFinite(amount) ? amount : 0)} a
                  tots els mesos seleccionats.
                </FieldDescription>
              </Field>
            )}
          </FieldSet>

          <FieldSet>
            <Field orientation="horizontal">
              <Checkbox
                id="bulk-alloc"
                checked={changeAlloc}
                onCheckedChange={(v) => setChangeAlloc(v === true)}
              />
              <FieldLabel htmlFor="bulk-alloc">
                Canviar l&apos;assignació a projectes
              </FieldLabel>
            </Field>
            {changeAlloc && (
              <>
                <FieldDescription>
                  Aquesta assignació es copiarà a tots els mesos seleccionats
                  (substitueix l&apos;actual).
                </FieldDescription>
                <AllocationEditor
                  value={alloc}
                  onChange={setAlloc}
                  options={projectOptions}
                  mode="max"
                  itemLabel="projecte"
                  emptyText="Sense assignar a cap projecte"
                  withCostType
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
        <Button
          type="submit"
          form="bulk-payroll-entries-form"
          disabled={pending || !hasChange}
        >
          {pending ? "Desant…" : "Aplica"}
        </Button>
      </DialogFooter>
    </>
  )
}
