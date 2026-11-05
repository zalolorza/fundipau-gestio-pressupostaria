import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { InteractiveTableRow } from "@/components/app/interactive-table-row"
import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { ClientDialog } from "@/components/clients/client-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listClients } from "@/server/queries"

export const metadata: Metadata = { title: "Finançadors" }

export default async function ClientsPage() {
  const clients = await listClients()
  return (
    <>
      <PageHeader crumbs={[{ label: "Gestió" }, { label: "Finançadors" }]} />
      <PageBody>
        <PageTitle title="Finançadors" description="Entitats que financen els projectes.">
          <ClientDialog>
            <Button>
              <PlusIcon /> Nou finançador
            </Button>
          </ClientDialog>
        </PageTitle>
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nom</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Població</TableHead>
                <TableHead>Projectes</TableHead>
                <TableHead>Subvencions</TableHead>
                <TableHead className="pr-4">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Encara no hi ha cap finançador.
                  </TableCell>
                </TableRow>
              )}
              {clients.map((c) => (
                <InteractiveTableRow key={c.id} href={`/financadors/${c.id}`}>
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/financadors/${c.id}`} className="hover:text-primary hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.taxId ?? "—"}</TableCell>
                  <TableCell>{c.city ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex max-w-md flex-wrap gap-1">
                      {c.projects.map((p) => (
                        <Badge key={p.projectId} variant="secondary">
                          {p.project.name} · {p.percentage} %
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-md flex-wrap gap-1">
                      {c.subsidies.map((s) => (
                        <Badge key={s.subsidyId} variant="outline">
                          {s.subsidy.name} · {s.percentage} %
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate pr-4 text-muted-foreground">{c.notes ?? ""}</TableCell>
                </InteractiveTableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </PageBody>
    </>
  )
}
