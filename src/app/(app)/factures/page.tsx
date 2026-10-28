import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { InvoiceDialog } from "@/components/invoices/invoice-dialog"
import { InvoiceFilters } from "@/components/invoices/invoice-filters"
import { InvoiceRowActions } from "@/components/invoices/invoice-row-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, formatEuro, round2 } from "@/lib/format"
import { getProjectOptions, getSupplierOptions, listInvoices } from "@/server/queries"

export const metadata: Metadata = { title: "Factures de proveïdors" }

const isDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)

export default async function InvoicesPage({ searchParams }: PageProps<"/factures">) {
  const sp = await searchParams
  const isUuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined)
  const filters = {
    q: typeof sp.q === "string" ? sp.q : undefined,
    from: isDate(sp.des),
    to: isDate(sp.fins),
    supplierId: isUuid(sp.proveidor),
    projectId: isUuid(sp.projecte),
  }
  const [invoices, projects, suppliers] = await Promise.all([
    listInvoices(filters),
    getProjectOptions(),
    getSupplierOptions(),
  ])
  const today = new Date().toISOString().slice(0, 10)
  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    hint: p.closedAt && p.closedAt < today ? "tancat" : undefined,
  }))
  const sum = (k: "baseAmount" | "vatAmount" | "irpfAmount" | "total") =>
    round2(invoices.reduce((s, i) => s + i[k], 0))

  return (
    <>
      <PageHeader crumbs={[{ label: "Costos" }, { label: "Factures de proveïdors" }]} />
      <PageBody>
        <PageTitle title="Factures de proveïdors" description="Factures rebudes i la seva imputació a projectes.">
          <InvoiceDialog projectOptions={projectOptions} suppliers={suppliers}>
            <Button>
              <PlusIcon /> Nova factura
            </Button>
          </InvoiceDialog>
        </PageTitle>
        <InvoiceFilters
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        />
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Data</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Proveïdor</TableHead>
                <TableHead>Descripció</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">IRPF</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Projectes</TableHead>
                <TableHead className="w-20 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    No s&apos;ha trobat cap factura.
                  </TableCell>
                </TableRow>
              )}
              {invoices.map((inv) => {
                const { projects: _p, supplier: _s, allocations, assigned, cost: _c, ...row } = inv
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="pl-4 whitespace-nowrap">{formatDate(inv.issueDate)}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.number}</TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {inv.supplier ? (
                          <Link href={`/proveidors/${inv.supplier.id}`} className="hover:text-primary hover:underline">
                            {inv.supplierName}
                          </Link>
                        ) : (
                          <>
                            {inv.supplierName}{" "}
                            <Badge variant="outline" className="ml-1 border-dashed font-normal">
                              no enllaçat
                            </Badge>
                          </>
                        )}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{inv.supplierTaxId}</div>
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">{inv.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEuro(inv.baseAmount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatEuro(inv.vatAmount)}
                      <div className="text-xs">{inv.vatRate} %</div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {inv.irpfAmount ? `−${formatEuro(inv.irpfAmount)}` : "—"}
                      {inv.irpfRate > 0 && <div className="text-xs">{inv.irpfRate} %</div>}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatEuro(inv.total)}</TableCell>
                    <TableCell>
                      <div className="flex max-w-60 flex-wrap gap-1">
                        {allocations.map((a) => (
                          <Badge key={a.projectId} variant="secondary" className="max-w-56">
                            <span className="truncate">{a.name}</span> · {a.percentage} %
                          </Badge>
                        ))}
                        {assigned < 100 && (
                          <Badge variant="destructive">{round2(100 - assigned)} % sense assignar</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pr-4">
                      <InvoiceRowActions
                        invoice={row}
                        allocations={allocations.map((a) => ({ id: a.projectId, percentage: a.percentage }))}
                        projectOptions={projectOptions}
                        suppliers={suppliers}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            {invoices.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-4" colSpan={4}>
                    {invoices.length} factures
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(sum("baseAmount"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(sum("vatAmount"))}</TableCell>
                  <TableCell className="text-right tabular-nums">−{formatEuro(sum("irpfAmount"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(sum("total"))}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </Card>
      </PageBody>
    </>
  )
}
