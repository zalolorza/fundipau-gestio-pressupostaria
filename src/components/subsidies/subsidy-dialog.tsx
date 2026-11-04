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
import { Textarea } from "@/components/ui/textarea"
import type { Subsidy } from "@/db/schema"
import { formatEuro, round2 } from "@/lib/format"
import { saveSubsidy } from "@/server/actions"

export type SubsidyProjectOption = {
  id: string
  name: string
  maxBudget: number
}

export function SubsidyDialog({
  subsidy,
  clients,
  clientOptions,
  projects,
  projectOptions = [],
  children,
}: {
  subsidy?: Subsidy
  clients?: AllocationRow[]
  clientOptions: { id: string; name: string }[]
  projects?: AllocationRow[]
  projectOptions?: SubsidyProjectOption[]
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [alloc, setAlloc] = useState<AllocationRow[]>(clients ?? [])
  const [projectAlloc, setProjectAlloc] = useState<AllocationRow[]>(projects ?? [])
  const [total, setTotal] = useState(String(subsidy?.total ?? ""))
  const [pending, start] = useTransition()
  const router = useRouter()

  const totalN = Number(total)
  const allocErr = allocationError(alloc, "max")
  const projectAllocErr = allocationError(projectAlloc, "max", { allowOver100: true })
  const projectById = new Map(projectOptions.map((p) => [p.id, p]))
  const projectsAmount = round2(
    projectAlloc.reduce((s, row) => {
      const p = projectById.get(row.id)
      if (!p || !(Number(row.percentage) > 0)) return s
      return s + (p.maxBudget * Number(row.percentage)) / 100
    }, 0)
  )
  const projectsCapacityErr =
    Number.isFinite(totalN) && totalN >= 0 && projectsAmount > round2(totalN)
      ? `Els projectes sumen ${formatEuro(projectsAmount)}, superior al total (${formatEuro(totalN)})`
      : null
  const totalOk = Number.isFinite(totalN) && totalN >= 0
  const canSave = !allocErr && !projectAllocErr && !projectsCapacityErr && totalOk

  const projectSelectOptions = projectOptions.map((p) => ({
    id: p.id,
    name: p.name,
    hint: formatEuro(p.maxBudget),
  }))

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSave) return
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    start(async () => {
      const res = await saveSubsidy(subsidy?.id ?? null, f as never, alloc, projectAlloc)
      if (!res.ok) return void toast.error(res.error)
      toast.success(subsidy ? "Subvenció actualitzada" : "Subvenció creada")
      setOpen(false)
      if (!subsidy && res.data) router.push(`/subvencions/${res.data.id}`)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setAlloc(clients ?? [])
          setProjectAlloc(projects ?? [])
          setTotal(String(subsidy?.total ?? ""))
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{subsidy ? "Edita la subvenció" : "Nova subvenció"}</DialogTitle>
          <DialogDescription>
            Import total, clients finançadors i projectes assignats.
          </DialogDescription>
        </DialogHeader>
        <form id="subsidy-form" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Nom *</FieldLabel>
              <Input id="name" name="name" required defaultValue={subsidy?.name} />
            </Field>
            <Field>
              <FieldLabel htmlFor="total">Total *</FieldLabel>
              <div className="relative">
                <Input
                  id="total"
                  name="total"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  className="pr-6"
                />
                <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
                  €
                </span>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" name="notes" rows={3} defaultValue={subsidy?.notes ?? ""} />
            </Field>
            <FieldSet>
              <FieldLegend>Clients finançadors</FieldLegend>
              <FieldDescription>
                Repartiment del finançament (percentatge o import). No cal arribar al 100 %.
              </FieldDescription>
              <AllocationEditor
                value={alloc}
                onChange={setAlloc}
                options={clientOptions}
                mode="max"
                itemLabel="client"
                emptyText="Cap client assignat"
                amountBase={Number.isFinite(totalN) && totalN > 0 ? totalN : undefined}
              />
            </FieldSet>
            <FieldSet>
              <FieldLegend>Projectes</FieldLegend>
              <FieldDescription>
                Percentatge del pressupost de cada projecte finançat per aquesta
                subvenció. La suma d&apos;imports no pot superar el total
                {Number.isFinite(totalN) && totalN > 0
                  ? ` (${formatEuro(projectsAmount)} de ${formatEuro(totalN)})`
                  : ""}
                .
              </FieldDescription>
              <AllocationEditor
                value={projectAlloc}
                onChange={setProjectAlloc}
                options={projectSelectOptions}
                mode="max"
                itemLabel="projecte"
                emptyText="Cap projecte assignat"
                allowOver100
              />
              {projectsCapacityErr && (
                <p className="text-sm text-destructive">{projectsCapacityErr}</p>
              )}
            </FieldSet>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel·la
          </Button>
          <Button type="submit" form="subsidy-form" disabled={pending || !canSave}>
            {pending ? "Desant…" : "Desa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
