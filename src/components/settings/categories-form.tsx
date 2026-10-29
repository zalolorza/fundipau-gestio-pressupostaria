"use client"

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createCategory, deleteCategory, renameCategory } from "@/server/actions"

export type CategoryRef = { id: string; name: string }

export function CategoriesForm({ categories: initial }: { categories: CategoryRef[] }) {
  const [categories, setCategories] = useState(initial)
  const [createOpen, setCreateOpen] = useState(false)
  const [edit, setEdit] = useState<CategoryRef | null>(null)
  const [remove, setRemove] = useState<CategoryRef | null>(null)
  const [name, setName] = useState("")
  const [pending, start] = useTransition()

  const [prev, setPrev] = useState(initial)
  if (initial !== prev) {
    setPrev(initial)
    setCategories(initial)
  }

  function openCreate() {
    setName("")
    setCreateOpen(true)
  }

  function openEdit(c: CategoryRef) {
    setName(c.name)
    setEdit(c)
  }

  function submitCreate() {
    start(async () => {
      const res = await createCategory(name)
      if (!res.ok) return void toast.error(res.error)
      setCategories((list) =>
        [...list, res.data!].sort((a, b) => a.name.localeCompare(b.name))
      )
      toast.success("Categoria creada")
      setCreateOpen(false)
    })
  }

  function submitRename() {
    if (!edit) return
    start(async () => {
      const res = await renameCategory(edit.id, name)
      if (!res.ok) return void toast.error(res.error)
      setCategories((list) =>
        list
          .map((c) => (c.id === edit.id ? res.data! : c))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      toast.success("Categoria actualitzada")
      setEdit(null)
    })
  }

  function submitDelete() {
    if (!remove) return
    start(async () => {
      const res = await deleteCategory(remove.id)
      if (!res.ok) return void toast.error(res.error)
      setCategories((list) => list.filter((c) => c.id !== remove.id))
      toast.success("Categoria eliminada")
      setRemove(null)
    })
  }

  return (
    <div className="space-y-3">
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Encara no hi ha cap categoria. Serveixen per classificar factures i
          nòmines.
        </p>
      ) : (
        <ul className="space-y-1">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-1 rounded-md border px-2 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Edita ${c.name}`}
                onClick={() => openEdit(c)}
              >
                <PencilIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Elimina ${c.name}`}
                onClick={() => setRemove(c)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" size="sm" onClick={openCreate}>
        <PlusIcon /> Afegeix categoria
      </Button>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
            <DialogDescription>
              Etiqueta global per classificar factures i nòmines.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="category-name">Nom</FieldLabel>
              <Input
                id="category-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="p. ex. Viatges, Material…"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) submitCreate()
                }}
              />
            </Field>
          </FieldGroup>
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
            <DialogTitle>Editar categoria</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="category-rename">Nom</FieldLabel>
              <Input
                id="category-rename"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) submitRename()
                }}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancel·la
            </Button>
            <Button onClick={submitRename} disabled={pending || !name.trim()}>
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
              aquesta categoria. Aquesta acció no es pot desfer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel·la</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={submitDelete}
              disabled={pending}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
