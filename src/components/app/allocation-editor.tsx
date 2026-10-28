"use client"

import { PlusIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { round2 } from "@/lib/format"

export type AllocationRow = { id: string; percentage: number }
export type AllocationOption = { id: string; name: string; hint?: string; disabled?: boolean }

export function allocationSum(rows: AllocationRow[]) {
  return round2(rows.reduce((s, r) => s + (Number(r.percentage) || 0), 0))
}

export function allocationError(rows: AllocationRow[], mode: "exact" | "max"): string | null {
  if (rows.some((r) => !r.id)) return "Tria un element a cada fila"
  if (new Set(rows.map((r) => r.id)).size !== rows.length) return "Hi ha elements repetits"
  if (rows.some((r) => !(Number(r.percentage) > 0))) return "Tots els percentatges han de ser més grans que 0"
  const sum = allocationSum(rows)
  if (mode === "exact" && rows.length > 0 && sum !== 100) return `Ha de sumar 100 % (ara ${sum} %)`
  if (sum > 100) return `No pot superar el 100 % (ara ${sum} %)`
  return null
}

export function AllocationEditor({
  value,
  onChange,
  options,
  mode,
  itemLabel,
  emptyText,
}: {
  value: AllocationRow[]
  onChange: (rows: AllocationRow[]) => void
  options: AllocationOption[]
  mode: "exact" | "max"
  itemLabel: string
  emptyText?: string
}) {
  const sum = allocationSum(value)
  const error = allocationError(value, mode)
  const used = new Set(value.map((r) => r.id))

  const update = (i: number, patch: Partial<AllocationRow>) =>
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const distribute = () => {
    if (!value.length) return
    const each = Math.floor((100 / value.length) * 100) / 100
    const rows = value.map((r) => ({ ...r, percentage: each }))
    rows[rows.length - 1].percentage = round2(100 - each * (rows.length - 1))
    onChange(rows)
  }

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
          {emptyText ?? "Sense assignar"}
        </p>
      )}
      {value.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select value={row.id} onValueChange={(id) => update(i, { id })}>
            <SelectTrigger className="min-w-0 flex-1">
              <SelectValue placeholder={`Tria ${itemLabel}…`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id} disabled={o.disabled || (used.has(o.id) && o.id !== row.id)}>
                  {o.name}
                  {o.hint && <span className="text-muted-foreground"> · {o.hint}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-24 shrink-0">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.01"
              value={Number.isNaN(row.percentage) ? "" : row.percentage}
              onChange={(e) => update(i, { percentage: e.target.valueAsNumber })}
              className="pr-6 text-right"
              aria-label="Percentatge"
            />
            <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
              %
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            aria-label="Elimina"
          >
            <Trash2Icon />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange([...value, { id: "", percentage: Math.max(0, round2((mode === "exact" ? 100 : 100) - sum)) }])
            }
            disabled={value.length >= options.length}
          >
            <PlusIcon /> Afegeix {itemLabel}
          </Button>
          {value.length > 1 && (
            <Button type="button" variant="ghost" size="sm" onClick={distribute}>
              Reparteix a parts iguals
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : (
            mode === "max" &&
            sum < 100 && <span className="text-muted-foreground">{round2(100 - sum)} % sense assignar</span>
          )}
          <Badge variant={error ? "destructive" : "secondary"}>Total {sum} %</Badge>
        </div>
      </div>
    </div>
  )
}
