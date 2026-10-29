"use client"

import { SearchIcon, XIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { useInvoiceListNav } from "@/components/invoices/invoice-list-nav"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { COST_TYPE_LABELS, COST_TYPE_PARAMS, costTypeFromParam, costTypeToParam } from "@/lib/cost-type"
import { cn } from "@/lib/utils"

const activeFilterClass = "bg-muted border-muted-foreground/20"

export function InvoiceFilters({
  suppliers,
  projects,
  categories = [],
}: {
  suppliers: { id: string; name: string }[]
  projects: { id: string; name: string }[]
  categories?: { id: string; name: string }[]
}) {
  const params = useSearchParams()
  const { setParam, replaceParams } = useInvoiceListNav()
  const [q, setQ] = useState(params.get("q") ?? "")

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) setParam("q", q)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const proveidor = params.get("proveidor")
  const projecte = params.get("projecte")
  const assignacio = params.get("assignacio")
  const tipus = costTypeFromParam(params.get("tipus"))
  const categoria = params.get("categoria")
  const des = params.get("des")
  const fins = params.get("fins")
  const qActive = Boolean(q.trim())
  const hasFilters = qActive || des || fins || proveidor || projecte || assignacio || tipus || categoria

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-64 flex-1">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cerca per número, proveïdor, NIF o descripció…"
          className={cn("pl-8", qActive && activeFilterClass)}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Select value={proveidor ?? "all"} onValueChange={(v) => setParam("proveidor", v === "all" ? "" : v)}>
        <SelectTrigger className={cn("w-56", proveidor && activeFilterClass)} aria-label="Proveïdor">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tots els proveïdors</SelectItem>
          <SelectSeparator />
          {suppliers.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={projecte ?? "all"} onValueChange={(v) => setParam("projecte", v === "all" ? "" : v)}>
        <SelectTrigger className={cn("w-56", projecte && activeFilterClass)} aria-label="Projecte">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tots els projectes</SelectItem>
          <SelectSeparator />
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={assignacio ?? "all"} onValueChange={(v) => setParam("assignacio", v === "all" ? "" : v)}>
        <SelectTrigger className={cn("w-56", assignacio && activeFilterClass)} aria-label="Assignació">
          <SelectValue placeholder="Assignació" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Totes les assignacions</SelectItem>
          <SelectSeparator />
          <SelectItem value="completa">Assignació completa</SelectItem>
          <SelectItem value="pendent">Assignació del 100% pendent</SelectItem>
          <SelectItem value="parcial">Assignació parcial pendent</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={tipus ? costTypeToParam(tipus) : "all"}
        onValueChange={(v) => setParam("tipus", v === "all" ? "" : v)}
      >
        <SelectTrigger className={cn("w-44", tipus && activeFilterClass)} aria-label="Tipus de cost">
          <SelectValue placeholder="Tipus" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tots els tipus</SelectItem>
          <SelectSeparator />
          {COST_TYPE_PARAMS.map((p) => (
            <SelectItem key={p} value={p}>
              {COST_TYPE_LABELS[costTypeFromParam(p)!]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={categoria ?? "all"}
        onValueChange={(v) => setParam("categoria", v === "all" ? "" : v)}
      >
        <SelectTrigger className={cn("w-48", categoria && activeFilterClass)} aria-label="Categoria">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Totes les categories</SelectItem>
          <SelectItem value="none">Sense categoria</SelectItem>
          {categories.length > 0 && <SelectSeparator />}
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DatePicker
        className={cn("w-40", des && activeFilterClass)}
        aria-label="Des de"
        placeholder="Des de"
        value={des ?? ""}
        onChange={(v) => setParam("des", v)}
      />
      <span className="text-sm text-muted-foreground">–</span>
      <DatePicker
        className={cn("w-40", fins && activeFilterClass)}
        aria-label="Fins a"
        placeholder="Fins a"
        value={fins ?? ""}
        onChange={(v) => setParam("fins", v)}
      />
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("")
            replaceParams((sp) => {
              for (const key of [
                "q",
                "des",
                "fins",
                "proveidor",
                "projecte",
                "assignacio",
                "tipus",
                "categoria",
              ])
                sp.delete(key)
            })
          }}
        >
          <XIcon /> Neteja
        </Button>
      )}
    </div>
  )
}
