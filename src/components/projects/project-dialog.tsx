"use client"

import { useRouter } from "next/navigation"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { Project } from "@/db/schema"
import { round2 } from "@/lib/format"
import { saveProject } from "@/server/actions"

function hasSplit(p?: Project) {
  return p?.directBudget != null && p?.indirectBudget != null
}

export function ProjectDialog({
  project,
  clients,
  clientOptions,
  children,
}: {
  project?: Project
  clients?: AllocationRow[]
  clientOptions: { id: string; name: string }[]
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [alloc, setAlloc] = useState<AllocationRow[]>(clients ?? [])
  const [split, setSplit] = useState(hasSplit(project))
  const [maxBudget, setMaxBudget] = useState(String(project?.maxBudget ?? ""))
  const [directBudget, setDirectBudget] = useState(
    project?.directBudget != null ? String(project.directBudget) : ""
  )
  const [pending, start] = useTransition()
  const router = useRouter()

  function resetBudgetFields() {
    setSplit(hasSplit(project))
    setMaxBudget(String(project?.maxBudget ?? ""))
    setDirectBudget(project?.directBudget != null ? String(project.directBudget) : "")
  }

  const max = Number(maxBudget)
  const direct = Number(directBudget)
  const indirect =
    split && Number.isFinite(max) && Number.isFinite(direct) ? round2(Math.max(0, max - direct)) : null
  const allocErr = allocationError(alloc, "exact")
  const budgetOk =
    Number.isFinite(max) &&
    max >= 0 &&
    (!split || (Number.isFinite(direct) && direct >= 0 && direct <= max))
  const canSave = !allocErr && budgetOk

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSave) return
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    if (split) {
      f.directBudget = String(direct)
      f.indirectBudget = String(round2(max - direct))
    } else {
      f.directBudget = ""
      f.indirectBudget = ""
    }
    start(async () => {
      const res = await saveProject(project?.id ?? null, f as never, alloc)
      if (!res.ok) return void toast.error(res.error)
      toast.success(project ? "Projecte actualitzat" : "Projecte creat")
      setOpen(false)
      if (!project && res.data) router.push(`/projectes/${res.data.id}`)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setAlloc(clients ?? [])
          resetBudgetFields()
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{project ? "Edita el projecte" : "Nou projecte"}</DialogTitle>
          <DialogDescription>Dades bàsiques, pressupost i clients que el financen.</DialogDescription>
        </DialogHeader>
        <form id="project-form" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Nom *</FieldLabel>
              <Input id="name" name="name" required defaultValue={project?.name} />
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Descripció</FieldLabel>
              <Textarea id="description" name="description" rows={3} defaultValue={project?.description ?? ""} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="openedAt">Data d&apos;obertura</FieldLabel>
                <DatePicker id="openedAt" name="openedAt" defaultValue={project?.openedAt ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="closedAt">Data de tancament</FieldLabel>
                <DatePicker id="closedAt" name="closedAt" defaultValue={project?.closedAt ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="maxBudget">Pressupost màxim *</FieldLabel>
                <div className="relative">
                  <Input
                    id="maxBudget"
                    name="maxBudget"
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value)}
                    className="pr-6"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
                    €
                  </span>
                </div>
              </Field>
            </div>
            <Field orientation="horizontal">
              <Checkbox
                id="budgetSplit"
                checked={split}
                onCheckedChange={(v) => {
                  const on = v === true
                  setSplit(on)
                  if (on && !directBudget && Number.isFinite(max) && max > 0) {
                    setDirectBudget(String(max))
                  }
                }}
              />
              <FieldLabel htmlFor="budgetSplit" className="font-normal">
                Desglossar el pressupost en costes directes i indirectes
              </FieldLabel>
            </Field>
            {split && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="directBudget">Pressupost directe</FieldLabel>
                  <div className="relative">
                    <Input
                      id="directBudget"
                      type="number"
                      step="0.01"
                      min={0}
                      max={Number.isFinite(max) ? max : undefined}
                      required={split}
                      value={directBudget}
                      onChange={(e) => setDirectBudget(e.target.value)}
                      className="pr-6"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
                      €
                    </span>
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="indirectBudget">Pressupost indirecte</FieldLabel>
                  <div className="relative">
                    <Input
                      id="indirectBudget"
                      type="number"
                      step="0.01"
                      min={0}
                      readOnly
                      tabIndex={-1}
                      value={indirect ?? ""}
                      className="bg-muted pr-6"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
                      €
                    </span>
                  </div>
                  <FieldDescription>Es calcula com a màxim − directe.</FieldDescription>
                </Field>
              </div>
            )}
            <FieldSet>
              <FieldLegend>Clients</FieldLegend>
              <FieldDescription>
                Repartiment del finançament (percentatge o import). Ha de sumar 100 %.
              </FieldDescription>
              <AllocationEditor
                value={alloc}
                onChange={setAlloc}
                options={clientOptions}
                mode="exact"
                itemLabel="client"
                emptyText="Cap client assignat"
                amountBase={Number.isFinite(max) && max > 0 ? max : undefined}
              />
            </FieldSet>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel·la
          </Button>
          <Button type="submit" form="project-form" disabled={pending || !canSave}>
            {pending ? "Desant…" : "Desa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
