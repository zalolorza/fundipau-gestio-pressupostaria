"use client"

import { SearchIcon } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
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
import type { ActivityRef } from "@/components/projects/project-activities"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate, formatEuro, round2 } from "@/lib/format"
import { cn } from "@/lib/utils"
import { assignInvoiceToProject } from "@/server/actions"

const NONE = "__none__"

export type AssignableInvoice = {
  id: string
  number: string
  supplierName: string
  issueDate: string
  description: string | null
  cost: number
  assigned: number
}

export function AssignInvoiceDialog({
  projectId,
  invoices,
  current,
  activities = [],
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  projectId: string
  invoices: AssignableInvoice[]
  /** percentatges actuals d'aquest projecte, per factura */
  current: Record<string, number>
  activities?: ActivityRef[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [percentage, setPercentage] = useState<number>(100)
  const [activityId, setActivityId] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const available = (inv: AssignableInvoice) => round2(100 - inv.assigned + (current[inv.id] ?? 0))
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return invoices
      .filter((i) => available(i) > 0)
      .filter(
        (i) =>
          !t ||
          i.number.toLowerCase().includes(t) ||
          i.supplierName.toLowerCase().includes(t) ||
          (i.description ?? "").toLowerCase().includes(t)
      )
      .slice(0, 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, invoices, current])

  const sel = invoices.find((i) => i.id === selected)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setSelected(null)
      setQ("")
      setActivityId(null)
    }
  }

  function submit() {
    if (!selected) return
    start(async () => {
      const res = await assignInvoiceToProject(projectId, selected, percentage, activityId)
      if (!res.ok) return void toast.error(res.error)
      toast.success("Factura assignada")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assignar una factura</DialogTitle>
          <DialogDescription>Tria una factura i el percentatge que s&apos;imputa a aquest projecte.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per número, proveïdor o descripció…"
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-1">
          {list.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">No hi ha factures disponibles.</p>
          )}
          {list.map((inv) => (
            <Button
              key={inv.id}
              type="button"
              variant="ghost"
              onClick={() => {
                setSelected(inv.id)
                setPercentage(available(inv))
              }}
              className={cn(
                "h-auto w-full items-center justify-start gap-3 rounded-md px-3 py-2 text-left font-normal",
                selected === inv.id && "bg-primary/10 ring-1 ring-primary"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {inv.supplierName} <span className="font-normal text-muted-foreground">· {inv.number}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDate(inv.issueDate)} · {inv.description}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular-nums">{formatEuro(inv.cost)}</p>
                <p className="text-xs text-muted-foreground">{available(inv)} % disponible</p>
              </div>
            </Button>
          ))}
        </div>
        {sel && (
          <div className="space-y-3">
            <Field orientation="horizontal" className="items-center">
              <FieldLabel htmlFor="pct" className="flex-1">
                Percentatge a imputar (màx. {available(sel)} %)
              </FieldLabel>
              <Input
                id="pct"
                type="number"
                min={0.01}
                max={available(sel)}
                step="0.01"
                value={Number.isNaN(percentage) ? "" : percentage}
                onChange={(e) => setPercentage(e.target.valueAsNumber)}
                className="w-28 text-right"
              />
              <span className="w-28 text-right text-sm tabular-nums">
                {formatEuro(((percentage || 0) * sel.cost) / 100)}
              </span>
            </Field>
            {activities.length > 0 && (
              <Field orientation="horizontal" className="items-center">
                <FieldLabel className="flex-1">Activitat</FieldLabel>
                <Select
                  value={activityId ?? NONE}
                  onValueChange={(v) => setActivityId(v === NONE ? null : v)}
                >
                  <SelectTrigger className="w-56" aria-label="Activitat">
                    <SelectValue placeholder="Sense activitat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sense activitat</SelectItem>
                    {activities.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel·la
          </Button>
          <Button onClick={submit} disabled={!sel || pending || !(percentage > 0)}>
            {pending ? "Assignant…" : "Assigna"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
