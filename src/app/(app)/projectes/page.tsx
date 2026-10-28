import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { BudgetProgress } from "@/components/app/budget-progress"
import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { ProjectDialog } from "@/components/projects/project-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatEuro } from "@/lib/format"
import { getClientOptions, listProjects } from "@/server/queries"

export const metadata: Metadata = { title: "Projectes" }

export default async function ProjectsPage() {
  const [projects, clientOptions] = await Promise.all([listProjects(), getClientOptions()])
  const today = new Date().toISOString().slice(0, 10)
  return (
    <>
      <PageHeader crumbs={[{ label: "Gestió" }, { label: "Projectes" }]} />
      <PageBody>
        <PageTitle title="Projectes" description="Pressupost, costos imputats i finançadors de cada projecte.">
          <ProjectDialog clientOptions={clientOptions}>
            <Button>
              <PlusIcon /> Nou projecte
            </Button>
          </ProjectDialog>
        </PageTitle>
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
              {projects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Encara no hi ha cap projecte.
                  </TableCell>
                </TableRow>
              )}
              {projects.map((p) => {
                const closed = p.closedAt && p.closedAt < today
                return (
                  <TableRow key={p.id}>
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
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      </PageBody>
    </>
  )
}
