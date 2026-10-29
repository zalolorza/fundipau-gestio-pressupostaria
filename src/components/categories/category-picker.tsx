"use client"

import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { createCategory } from "@/server/actions"
import type { CategoryOption } from "@/server/queries"

export type CategoryRef = Pick<CategoryOption, "id" | "name">

export function CategoryPicker({
  categories,
  value,
  onChange,
  onCatalogChange,
  className,
  disabled,
}: {
  categories: CategoryRef[]
  value: string[]
  onChange: (ids: string[]) => void
  /** Quan es crea una categoria inline, actualitza el catàleg del pare. */
  onCatalogChange?: (next: CategoryRef[]) => void
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")
  const [pending, start] = useTransition()
  const selected = useMemo(() => new Set(value), [value])
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, filter])

  const label =
    value.length === 0
      ? "Sense categoria"
      : value.length === 1
        ? (categories.find((c) => c.id === value[0])?.name ?? "1 categoria")
        : `${value.length} categories`

  function toggle(id: string) {
    if (selected.has(id)) onChange(value.filter((v) => v !== id))
    else onChange([...value, id])
  }

  function createInline() {
    const name = filter.trim()
    if (!name) return
    start(async () => {
      const res = await createCategory(name)
      if (!res.ok) return void toast.error(res.error)
      const created = { id: res.data!.id, name: res.data!.name }
      onCatalogChange?.([...categories, created].sort((a, b) => a.name.localeCompare(b.name)))
      onChange([...value, created.id])
      setFilter("")
      toast.success("Categoria creada")
    })
  }

  const canCreate =
    filter.trim().length > 0 &&
    !categories.some((c) => c.name.toLowerCase() === filter.trim().toLowerCase())

  return (
    <div className={cn("space-y-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            disabled={disabled}
            aria-label="Categories"
          >
            <span className="truncate">{label}</span>
            <ChevronsUpDownIcon className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Cerca o crea…"
            className="mb-2"
            autoFocus
          />
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {filtered.length === 0 && !canCreate && (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                Cap categoria
              </p>
            )}
            {filtered.map((c) => {
              const checked = selected.has(c.id)
              return (
                <label
                  key={c.id}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(c.id)}
                  />
                  <span className="flex-1 truncate">{c.name}</span>
                  {checked && <CheckIcon className="size-3.5 text-muted-foreground" />}
                </label>
              )
            })}
          </div>
          {canCreate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 w-full justify-start"
              disabled={pending}
              onClick={createInline}
            >
              <PlusIcon />
              Crea «{filter.trim()}»
            </Button>
          )}
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((id) => {
            const c = categories.find((x) => x.id === id)
            if (!c) return null
            return (
              <Badge key={id} variant="secondary" className="font-normal">
                {c.name}
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
