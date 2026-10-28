"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import { InteractiveTableRow } from "@/components/app/interactive-table-row"
import { PayrollFilters, payrollFilters, type PayrollFilter } from "@/components/payroll/payroll-filters"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatEuro, formatMonth } from "@/lib/format"
import { currentMonth } from "@/lib/months"
import type { PayrollListItem } from "@/server/queries"

function matchesQuery(p: PayrollListItem, q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return [p.personName, p.role, p.personTaxId]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(needle))
}

function matchesFiltre(p: PayrollListItem, filtre: PayrollFilter | "", month: string) {
  if (filtre === "pendents") return p.assignedPct < 100
  if (filtre === "actives") return p.startMonth <= month && (!p.endMonth || p.endMonth >= month)
  return true
}

function parseFiltre(value: string | null): PayrollFilter | "" {
  if (value && (payrollFilters as readonly string[]).includes(value)) return value as PayrollFilter
  return ""
}

export function PayrollsBrowser({ payrolls }: { payrolls: PayrollListItem[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = useState("")
  const filtre = parseFiltre(params.get("filtre"))
  const month = currentMonth()
  const today = new Date().toISOString().slice(0, 10)

  const setFiltre = (next: PayrollFilter | "") => {
    const sp = new URLSearchParams(params)
    if (next) sp.set("filtre", next)
    else sp.delete("filtre")
    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const filtered = useMemo(
    () => payrolls.filter((p) => matchesQuery(p, q) && matchesFiltre(p, filtre, month)),
    [payrolls, q, filtre, month]
  )

  const emptyMessage =
    payrolls.length === 0
      ? "Encara no hi ha cap nòmina."
      : "Cap nòmina coincideix amb la cerca o els filtres."

  return (
    <div className="space-y-4">
      <PayrollFilters q={q} onQChange={setQ} filtre={filtre} onFiltreChange={setFiltre} />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Persona</TableHead>
              <TableHead>Càrrec</TableHead>
              <TableHead className="text-right">Quantitat mensual</TableHead>
              <TableHead>Registres</TableHead>
              <TableHead className="text-right">Total acumulat</TableHead>
              <TableHead className="w-48 pr-4">Assignat a projectes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <InteractiveTableRow key={p.id} href={`/nomines/${p.id}`}>
                <TableCell className="pl-4">
                  <Link href={`/nomines/${p.id}`} className="font-medium hover:text-primary hover:underline">
                    {p.personName}
                  </Link>
                  {p.endMonth && p.endMonth < today && (
                    <span className="ml-2 text-xs text-muted-foreground">(finalitzada)</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{p.role ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatEuro(p.monthlyAmount)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.entriesCount} mesos · {formatMonth(p.firstMonth, true)} – {formatMonth(p.lastMonth, true)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatEuro(p.total)}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex items-center gap-2">
                    <Progress value={p.assignedPct} className="h-2" />
                    <span className="w-12 text-right text-xs tabular-nums">{Math.round(p.assignedPct)} %</span>
                  </div>
                </TableCell>
              </InteractiveTableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
