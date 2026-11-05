import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { InteractiveTableRow } from "@/components/app/interactive-table-row"
import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { SubsidyDialog } from "@/components/subsidies/subsidy-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatEuro } from "@/lib/format"
import { getClientOptions, getProjectOptions, listSubsidies } from "@/server/queries"

export const metadata: Metadata = { title: "Subvencions" }

export default async function SubsidiesPage() {
  const [subsidies, clientOptions, projectOptions] = await Promise.all([
    listSubsidies(),
    getClientOptions(),
    getProjectOptions(),
  ])
  return (
    <>
      <PageHeader crumbs={[{ label: "Gestió" }, { label: "Subvencions" }]} />
      <PageBody>
        <PageTitle
          title="Subvencions"
          description="Ajudes amb finançadors assignats que poden finançar projectes."
        >
          <SubsidyDialog
            clientOptions={clientOptions}
            projectOptions={projectOptions.map((p) => ({
              id: p.id,
              name: p.name,
              maxBudget: p.maxBudget,
            }))}
          >
            <Button>
              <PlusIcon /> Nova subvenció
            </Button>
          </SubsidyDialog>
        </PageTitle>
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nom</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead>Finançadors</TableHead>
                <TableHead>Projectes</TableHead>
                <TableHead className="pr-4">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subsidies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Encara no hi ha cap subvenció.
                  </TableCell>
                </TableRow>
              )}
              {subsidies.map((s) => (
                <InteractiveTableRow key={s.id} href={`/subvencions/${s.id}`}>
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/subvencions/${s.id}`} className="hover:text-primary hover:underline">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(s.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(s.available)}</TableCell>
                  <TableCell>
                    <div className="flex max-w-md flex-wrap gap-1">
                      {s.clients.length === 0 && (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {s.clients.map((c) => (
                        <Badge key={c.id} variant="secondary">
                          {c.name} · {c.percentage} %
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-md flex-wrap gap-1">
                      {s.projects.length === 0 && (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {s.projects.map((p) => (
                        <Badge key={p.id} variant="outline">
                          {p.name} · {p.percentage} %
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate pr-4 text-muted-foreground">
                    {s.notes ?? ""}
                  </TableCell>
                </InteractiveTableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </PageBody>
    </>
  )
}
