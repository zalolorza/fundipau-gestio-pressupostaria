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
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { Project } from "@/db/schema"
import { saveProject } from "@/server/actions"

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
  const [pending, start] = useTransition()
  const router = useRouter()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const err = allocationError(alloc, "exact")
    if (err) return void toast.error(`Clients: ${err}`)
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
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
        if (o) setAlloc(clients ?? [])
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
                <FieldLabel htmlFor="maxBudget">Pressupost màxim (€) *</FieldLabel>
                <Input
                  id="maxBudget"
                  name="maxBudget"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  defaultValue={project?.maxBudget ?? ""}
                />
              </Field>
            </div>
            <FieldSet>
              <FieldLegend>Clients</FieldLegend>
              <FieldDescription>Repartiment del finançament. Ha de sumar 100 %.</FieldDescription>
              <AllocationEditor
                value={alloc}
                onChange={setAlloc}
                options={clientOptions}
                mode="exact"
                itemLabel="client"
                emptyText="Cap client assignat"
              />
            </FieldSet>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel·la
          </Button>
          <Button type="submit" form="project-form" disabled={pending}>
            {pending ? "Desant…" : "Desa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
