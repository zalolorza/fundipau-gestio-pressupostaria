"use client"

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { BudgetProgress } from "@/components/app/budget-progress"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatEuro, formatPct, round2 } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  createProjectActivity,
  deleteProjectActivity,
  updateProjectActivity,
} from "@/server/actions"

export type ActivityRef = { id: string; name: string }

export type ActivityWithBudget = ActivityRef & {
  budget: number | null
  spent: number
  progress: number
}

export function ProjectActivities({
  projectId,
  maxBudget,
  activities: initial,
}: {
  projectId: string
  maxBudget: number
  activities: ActivityWithBudget[]
}) {
  const [activities, setActivities] = useState(initial)
  const [createOpen, setCreateOpen] = useState(false)
  const [edit, setEdit] = useState<ActivityWithBudget | null>(null)
  const [remove, setRemove] = useState<ActivityWithBudget | null>(null)
  const [name, setName] = useState("")
  const [budget, setBudget] = useState("")
  const [pending, start] = useTransition()

  // Sync when server revalidates
  const [prev, setPrev] = useState(initial)
  if (initial !== prev) {
    setPrev(initial)
    setActivities(initial)
  }

  const allocatedBudget = round2(
    activities.reduce((s, a) => s + (a.budget ?? 0), 0)
  )
  const remainingForCreate = round2(Math.max(0, maxBudget - allocatedBudget))
  const remainingForEdit = edit
    ? round2(Math.max(0, maxBudget - (allocatedBudget - (edit.budget ?? 0))))
    : remainingForCreate

  function openCreate() {
    setName("")
    setBudget("")
    setCreateOpen(true)
  }

  function openEdit(a: ActivityWithBudget) {
    setName(a.name)
    setBudget(a.budget != null ? String(a.budget) : "")
    setEdit(a)
  }

  function parseBudgetInput() {
    const t = budget.trim()
    if (!t) return null
    const n = Number(t.replace(",", "."))
    return Number.isFinite(n) ? n : NaN
  }

  function submitCreate() {
    const b = parseBudgetInput()
    if (Number.isNaN(b)) return void toast.error("Pressupost no vàlid")
    if (b != null && b > remainingForCreate)
      return void toast.error(
        `El pressupost de les activitats no pot superar el del projecte (queden ${formatEuro(remainingForCreate)} disponibles)`
      )
    start(async () => {
      const res = await createProjectActivity(projectId, { name, budget: b })
      if (!res.ok) return void toast.error(res.error)
      setActivities((list) =>
        [...list, { ...res.data!, spent: 0, progress: 0 }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      )
      toast.success("Activitat creada")
      setCreateOpen(false)
    })
  }

  function submitUpdate() {
    if (!edit) return
    const b = parseBudgetInput()
    if (Number.isNaN(b)) return void toast.error("Pressupost no vàlid")
    if (b != null && b > remainingForEdit)
      return void toast.error(
        `El pressupost de les activitats no pot superar el del projecte (queden ${formatEuro(remainingForEdit)} disponibles)`
      )
    start(async () => {
      const res = await updateProjectActivity(projectId, edit.id, { name, budget: b })
      if (!res.ok) return void toast.error(res.error)
      setActivities((list) =>
        list
          .map((a) => {
            if (a.id !== edit.id) return a
            const budget = res.data!.budget
            const progress =
              budget != null && budget > 0 ? round2((a.spent / budget) * 100) : 0
            return { ...a, name: res.data!.name, budget, progress }
          })
          .sort((x, y) => x.name.localeCompare(y.name))
      )
      toast.success("Activitat actualitzada")
      setEdit(null)
    })
  }

  function submitDelete() {
    if (!remove) return
    start(async () => {
      const res = await deleteProjectActivity(projectId, remove.id)
      if (!res.ok) return void toast.error(res.error)
      setActivities((list) => list.filter((a) => a.id !== remove.id))
      toast.success("Activitat eliminada")
      setRemove(null)
    })
  }

  return (
    <div className="space-y-3">
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Encara no hi ha cap activitat. Serveixen per classificar factures i nòmines
          dins del projecte.
        </p>
      ) : (
        <ul className="space-y-2">
          {activities.map((a) => (
            <li key={a.id}>
              <div className="min-w-0 space-y-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{a.name}</span>
                      {a.budget != null && (
                        <span
                          className={cn(
                            "shrink-0 tabular-nums",
                            a.progress > 100
                              ? "text-destructive"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatPct(round2(a.progress))}
                        </span>
                      )}
                    </div>
                    {a.budget != null && (
                      <BudgetProgress value={a.progress} className="h-2" />
                    )}
                    <p className="text-sm tabular-nums">
                      {formatEuro(a.spent)}
                      {a.budget != null && (
                        <span className="text-muted-foreground">
                          {" "}
                          / {formatEuro(a.budget)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edita ${a.name}`}
                      onClick={() => openEdit(a)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Elimina ${a.name}`}
                      onClick={() => setRemove(a)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" size="sm" onClick={openCreate}>
        <PlusIcon /> Afegeix activitat
      </Button>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova activitat</DialogTitle>
            <DialogDescription>
              Les factures i les nòmines es podran assignar a aquesta activitat. El
              pressupost és opcional.
            </DialogDescription>
          </DialogHeader>
          <ActivityFields
            name={name}
            budget={budget}
            remaining={remainingForCreate}
            onNameChange={setName}
            onBudgetChange={setBudget}
            onSubmit={submitCreate}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel·la
            </Button>
            <Button onClick={submitCreate} disabled={pending || !name.trim()}>
              {pending ? "Creant…" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={edit != null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar activitat</DialogTitle>
          </DialogHeader>
          <ActivityFields
            name={name}
            budget={budget}
            remaining={remainingForEdit}
            onNameChange={setName}
            onBudgetChange={setBudget}
            onSubmit={submitUpdate}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancel·la
            </Button>
            <Button onClick={submitUpdate} disabled={pending || !name.trim()}>
              {pending ? "Desant…" : "Desa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={remove != null} onOpenChange={(o) => !o && setRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar «{remove?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Les factures i nòmines que hi estiguin assignades quedaran sense
              activitat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel·la</AlertDialogCancel>
            <AlertDialogAction onClick={submitDelete} disabled={pending}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ActivityFields({
  name,
  budget,
  remaining,
  onNameChange,
  onBudgetChange,
  onSubmit,
}: {
  name: string
  budget: string
  remaining: number
  onNameChange: (v: string) => void
  onBudgetChange: (v: string) => void
  onSubmit: () => void
}) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="activity-name">Nom</FieldLabel>
        <Input
          id="activity-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="p. ex. Formació, Comunicació…"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSubmit()
          }}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="activity-budget">Pressupost</FieldLabel>
        <Input
          id="activity-budget"
          type="number"
          inputMode="decimal"
          min={0}
          max={remaining}
          step="0.01"
          value={budget}
          onChange={(e) => onBudgetChange(e.target.value)}
          placeholder="Opcional"
        />
        <FieldDescription>
          Opcional. La suma dels pressupostos d&apos;activitats no pot superar el
          del projecte ({formatEuro(remaining)} disponibles).
        </FieldDescription>
      </Field>
    </FieldGroup>
  )
}
