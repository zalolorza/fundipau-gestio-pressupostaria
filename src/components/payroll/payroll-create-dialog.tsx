"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { AllocationEditor, allocationError, type AllocationRow } from "@/components/app/allocation-editor"
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
import { MonthPicker } from "@/components/ui/month-picker"
import { Textarea } from "@/components/ui/textarea"
import { currentMonth } from "@/lib/months"
import { createPayroll } from "@/server/actions"

export function PayrollCreateDialog({
  projectOptions,
  children,
}: {
  projectOptions: { id: string; name: string; hint?: string }[]
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [alloc, setAlloc] = useState<AllocationRow[]>([])
  const [pending, start] = useTransition()
  const router = useRouter()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const err = allocationError(alloc, "max")
    if (err) return void toast.error(`Projectes: ${err}`)
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    start(async () => {
      const res = await createPayroll(
        { ...f, startMonth: `${f.startMonth}-01`, endMonth: f.endMonth ? `${f.endMonth}-01` : null } as never,
        alloc
      )
      if (!res.ok) return void toast.error(res.error)
      toast.success("Nòmina creada")
      setOpen(false)
      if (res.data) router.push(`/nomines/${res.data.id}`)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setAlloc([])
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova nòmina</DialogTitle>
          <DialogDescription>
            Es crearà un registre per cada mes, des del mes d&apos;inici fins al mes final (o fins a desembre si no
            n&apos;hi ha).
          </DialogDescription>
        </DialogHeader>
        <form id="payroll-form" onSubmit={onSubmit}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="personName">Persona *</FieldLabel>
                <Input id="personName" name="personName" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="personTaxId">DNI / NIE</FieldLabel>
                <Input id="personTaxId" name="personTaxId" />
              </Field>
              <Field>
                <FieldLabel htmlFor="role">Càrrec</FieldLabel>
                <Input id="role" name="role" />
              </Field>
              <Field>
                <FieldLabel htmlFor="monthlyAmount">Quantitat mensual (€) *</FieldLabel>
                <Input id="monthlyAmount" name="monthlyAmount" type="number" step="0.01" min={0} required />
                <FieldDescription>Cost total per a l&apos;entitat (brut + Seguretat Social).</FieldDescription>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="startMonth">Mes d&apos;inici *</FieldLabel>
                  <MonthPicker
                    id="startMonth"
                    name="startMonth"
                    required
                    defaultValue={currentMonth().slice(0, 7)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="endMonth">Mes final</FieldLabel>
                  <MonthPicker id="endMonth" name="endMonth" />
                </Field>
              </div>
            </div>
            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" name="notes" rows={2} />
            </Field>
            <FieldSet>
              <FieldLegend>Assignació inicial a projectes</FieldLegend>
              <FieldDescription>S&apos;aplicarà a tots els mesos generats. Després es pot canviar mes a mes.</FieldDescription>
              <AllocationEditor
                value={alloc}
                onChange={setAlloc}
                options={projectOptions}
                mode="max"
                itemLabel="projecte"
                emptyText="Sense assignar a cap projecte"
                withCostType
              />
            </FieldSet>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel·la
          </Button>
          <Button type="submit" form="payroll-form" disabled={pending}>
            {pending ? "Creant…" : "Crea la nòmina"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
