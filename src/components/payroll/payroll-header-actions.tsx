"use client"

import { CalendarPlusIcon, EuroIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { ConfirmButton } from "@/components/app/confirm-button"
import { AmountChangeDialog } from "@/components/payroll/amount-change-dialog"
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
import { Textarea } from "@/components/ui/textarea"
import type { Payroll } from "@/db/schema"
import { addMonths } from "@/lib/months"
import { deletePayroll, extendPayroll, updatePayrollInfo } from "@/server/actions"

export function PayrollHeaderActions({
  payroll,
  referenceMonth,
  lastMonth,
}: {
  payroll: Payroll
  referenceMonth: string
  lastMonth: string | null
}) {
  return (
    <>
      <AmountChangeDialog payrollId={payroll.id} referenceMonth={referenceMonth} currentAmount={payroll.monthlyAmount}>
        <Button>
          <EuroIcon /> Modifica la quantitat
        </Button>
      </AmountChangeDialog>
      <ExtendDialog payrollId={payroll.id} lastMonth={lastMonth} />
      <InfoDialog payroll={payroll} />
      <ConfirmButton
        title="Eliminar la nòmina?"
        description="S'eliminaran tots els registres mensuals i les seves assignacions a projectes."
        onConfirm={() => deletePayroll(payroll.id)}
      >
        <Button variant="outline" size="icon" className="text-destructive" aria-label="Elimina">
          <Trash2Icon />
        </Button>
      </ConfirmButton>
    </>
  )
}

function InfoDialog({ payroll }: { payroll: Payroll }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PencilIcon /> Edita
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edita la nòmina</DialogTitle>
          <DialogDescription>Per canviar la quantitat fes servir «Modifica la quantitat».</DialogDescription>
        </DialogHeader>
        <form
          id="payroll-info"
          onSubmit={(e) => {
            e.preventDefault()
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
            start(async () => {
              const res = await updatePayrollInfo(payroll.id, {
                ...f,
                endMonth: f.endMonth ? `${f.endMonth}-01` : null,
              } as never)
              if (!res.ok) return void toast.error(res.error)
              toast.success("Nòmina actualitzada")
              setOpen(false)
            })
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="personName">Persona *</FieldLabel>
              <Input id="personName" name="personName" required defaultValue={payroll.personName} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="personTaxId">DNI / NIE</FieldLabel>
                <Input id="personTaxId" name="personTaxId" defaultValue={payroll.personTaxId ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="role">Càrrec</FieldLabel>
                <Input id="role" name="role" defaultValue={payroll.role ?? ""} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="endMonth">Mes final</FieldLabel>
              <MonthPicker id="endMonth" name="endMonth" defaultValue={payroll.endMonth?.slice(0, 7) ?? ""} />
              <FieldDescription>Informatiu: no elimina registres mensuals ja creats.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" name="notes" rows={2} defaultValue={payroll.notes ?? ""} />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel·la
          </Button>
          <Button type="submit" form="payroll-info" disabled={pending}>
            {pending ? "Desant…" : "Desa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ExtendDialog({ payrollId, lastMonth }: { payrollId: string; lastMonth: string | null }) {
  const [open, setOpen] = useState(false)
  const [until, setUntil] = useState("")
  const [pending, start] = useTransition()
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setUntil(addMonths(lastMonth ?? new Date().toISOString().slice(0, 7) + "-01", 12).slice(0, 7))
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarPlusIcon /> Afegeix mesos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Afegir registres mensuals</DialogTitle>
          <DialogDescription>
            Es crearan els mesos que falten amb la quantitat actual i la mateixa assignació a projectes que l&apos;últim
            mes.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="until">Fins a</FieldLabel>
          <MonthPicker id="until" value={until} onChange={setUntil} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel·la
          </Button>
          <Button
            disabled={!until || pending}
            onClick={() =>
              start(async () => {
                const res = await extendPayroll(payrollId, `${until}-01`)
                if (!res.ok) return void toast.error(res.error)
                toast.success(`${res.data?.count ?? 0} mesos afegits`)
                setOpen(false)
              })
            }
          >
            {pending ? "Afegint…" : "Afegeix"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
