"use client"

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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { MonthPicker } from "@/components/ui/month-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatEuro } from "@/lib/format"
import { currentMonth } from "@/lib/months"
import { assignPayrollToProject } from "@/server/actions"

export type PayrollOption = {
  id: string
  personName: string
  role: string | null
  monthlyAmount: number
  startMonth: string
  lastMonth: string | null
}

export function AssignPayrollDialog({
  projectId,
  payrolls,
  defaultFrom,
  defaultTo,
  children,
}: {
  projectId: string
  payrolls: PayrollOption[]
  defaultFrom?: string | null
  defaultTo?: string | null
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [payrollId, setPayrollId] = useState<string>("")
  const [from, setFrom] = useState(currentMonth().slice(0, 7))
  const [to, setTo] = useState(currentMonth().slice(0, 7))
  const [percentage, setPercentage] = useState(100)
  const [pending, start] = useTransition()

  const sel = payrolls.find((p) => p.id === payrollId)

  function onOpen(o: boolean) {
    setOpen(o)
    if (o) {
      setPayrollId("")
      setPercentage(100)
      setFrom((defaultFrom ?? currentMonth()).slice(0, 7))
      setTo((defaultTo && defaultTo < currentMonth() ? defaultTo : currentMonth()).slice(0, 7))
    }
  }

  function submit() {
    start(async () => {
      const res = await assignPayrollToProject(projectId, payrollId, `${from}-01`, `${to}-01`, percentage)
      if (!res.ok) return void toast.error(res.error)
      toast.success(`Nòmina assignada a ${res.data?.count} ${res.data?.count === 1 ? "mes" : "mesos"}`)
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assignar una nòmina</DialogTitle>
          <DialogDescription>
            Imputa un percentatge de la nòmina d&apos;una persona a aquest projecte durant un rang de mesos.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Persona</FieldLabel>
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
            <FieldDescription>
              Si manquen registres mensuals en aquest rang, es creen amb l&apos;import del mes més proper. Si la persona
              ja estava assignada a aquest projecte, se&apos;n substitueix el percentatge. Cap mes pot superar el 100 %
              entre tots els projectes.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel·la
          </Button>
          <Button onClick={submit} disabled={!payrollId || !from || !to || pending || !(percentage > 0)}>
            {pending ? "Assignant…" : "Assigna"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
