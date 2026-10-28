"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { BudgetProgress } from "@/components/app/budget-progress"
import { InteractiveTableRow } from "@/components/app/interactive-table-row"
import {
  ProjectFilters,
  type ProjectBudgetFilter,
} from "@/components/projects/project-filters"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatEuro } from "@/lib/format"
import type { ProjectListItem } from "@/server/queries"

function matchesQuery(p: ProjectListItem, q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  if (p.name.toLowerCase().includes(needle)) return true
  return p.clients.some((c) => c.name.toLowerCase().includes(needle))
}

function matchesFiltre(p: ProjectListItem, filtre: ProjectBudgetFilter | "") {
  if (filtre === "superat") return p.costs.total > p.maxBudget
  if (filtre === "remanent") return p.costs.total < p.maxBudget
  return true
}

export function ProjectsBrowser({ projects }: { projects: ProjectListItem[] }) {
  const [q, setQ] = useState("")
  const [filtre, setFiltre] = useState<ProjectBudgetFilter | "">("")
  const today = new Date().toISOString().slice(0, 10)

  const filtered = useMemo(
    () => projects.filter((p) => matchesQuery(p, q) && matchesFiltre(p, filtre)),
    [projects, q, filtre]
  )

  const emptyMessage =
    projects.length === 0
      ? "Encara no hi ha cap projecte."
      : "Cap projecte coincideix amb la cerca o els filtres."

  return (
    <div className="space-y-4">
      <ProjectFilters q={q} onQChange={setQ} filtre={filtre} onFiltreChange={setFiltre} />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Projecte</TableHead>
              <TableHead>Clients</TableHead>
              <TableHead>Període</TableHead>
              <TableHead className="text-right">Pressupost</TableHead>
              <TableHead className="text-right">Cost imputat</TableHead>
              <TableHead className="w-48 pr-4">Progrés</TableHead>
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
            {filtered.map((p) => {
              const closed = p.closedAt && p.closedAt < today
              return (
                <InteractiveTableRow key={p.id} href={`/projectes/${p.id}`}>
                  <TableCell className="pl-4">
                    <Link href={`/projectes/${p.id}`} className="font-medium hover:text-primary hover:underline">
                      {p.name}
                    </Link>
                    {closed && (
                      <Badge variant="outline" className="ml-2">
                        Tancat
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {p.clients.length === 0 && <span className="text-muted-foreground">—</span>}
                      {p.clients.map((c) => (
                        <Badge key={c.id} variant="secondary">
                          {c.name} · {c.percentage} %
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                    {formatDate(p.openedAt)} – {p.closedAt ? formatDate(p.closedAt) : "obert"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(p.maxBudget)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(p.costs.total)}</TableCell>
                  <TableCell className="pr-4">
                    <div className="flex items-center gap-2">
                      <BudgetProgress value={p.progress} />
                      <span className="w-12 text-right text-xs tabular-nums">{Math.round(p.progress)} %</span>
                    </div>
                  </TableCell>
                </InteractiveTableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
