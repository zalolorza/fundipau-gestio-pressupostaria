import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { PayrollCreateDialog } from "@/components/payroll/payroll-create-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatEuro, formatMonth } from "@/lib/format"
import { getProjectOptions, listPayrolls } from "@/server/queries"

export const metadata: Metadata = { title: "Nòmines" }

export default async function PayrollsPage() {
  const [payrolls, projects] = await Promise.all([listPayrolls(), getProjectOptions()])
  const today = new Date().toISOString().slice(0, 10)
  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    hint: p.closedAt && p.closedAt < today ? "tancat" : undefined,
  }))
  return (
    <>
      <PageHeader crumbs={[{ label: "Costos" }, { label: "Nòmines" }]} />
      <PageBody>
        <PageTitle
          title="Nòmines"
          description="Cada nòmina té un registre per mes, que es pot repartir entre projectes."
        >
          <PayrollCreateDialog projectOptions={projectOptions}>
            <Button>
              <PlusIcon /> Nova nòmina
            </Button>
          </PayrollCreateDialog>
        </PageTitle>
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
              {payrolls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Encara no hi ha cap nòmina.
                  </TableCell>
                </TableRow>
              )}
              {payrolls.map((p) => (
                <TableRow key={p.id}>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </PageBody>
    </>
  )
}
