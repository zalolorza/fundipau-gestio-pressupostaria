import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { InvoiceDialog } from "@/components/invoices/invoice-dialog"
import { InvoiceTableRow } from "@/components/invoices/invoice-table-row"
import { SupplierActions } from "@/components/suppliers/supplier-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { getProjectOptions, getSupplier, getSupplierOptions, listInvoices } from "@/server/queries"

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id)

export async function generateMetadata({ params }: PageProps<"/proveidors/[id]">): Promise<Metadata> {
  const { id } = await params
  if (!isUuid(id)) return { title: "Proveïdor" }
  const s = await getSupplier(id)
  return { title: s?.name ?? "Proveïdor" }
}

export default async function SupplierPage({ params }: PageProps<"/proveidors/[id]">) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const [supplier, invoices, projects, supplierOptions] = await Promise.all([
    getSupplier(id),
    listInvoices({ supplierId: id }),
    getProjectOptions(),
    getSupplierOptions(),
  ])
  if (!supplier) notFound()

  const today = new Date().toISOString().slice(0, 10)
  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    hint: p.closedAt && p.closedAt < today ? "tancat" : undefined,
  }))
  const sum = (k: "baseAmount" | "vatAmount" | "irpfAmount" | "total" | "cost") =>
    round2(invoices.reduce((s, i) => s + i[k], 0))
  const thisYear = today.slice(0, 4)
  const yearTotal = round2(invoices.filter((i) => i.issueDate.startsWith(thisYear)).reduce((s, i) => s + i.total, 0))

  const fiscal = [
    ["NIF / CIF", supplier.taxId],
    ["Adreça", supplier.address],
    ["Població", [supplier.postalCode, supplier.city].filter(Boolean).join(" ")],
    ["Província", supplier.province],
    ["País", supplier.country],
  ] as const
  const contact = [
    ["Correu", supplier.email],
    ["Telèfon", supplier.phone],
    ["IBAN", supplier.iban],
    ["IVA habitual", `${supplier.defaultVatRate} %`],
    ["IRPF habitual", `${supplier.defaultIrpfRate} %`],
  ] as const

  return (
    <>
      <PageHeader crumbs={[{ label: "Proveïdors", href: "/proveidors" }, { label: supplier.name }]} />
      <PageBody>
        <PageTitle title={supplier.name} description={supplier.taxId ?? undefined}>
          <SupplierActions supplier={supplier} invoiceCount={invoices.length} />
        </PageTitle>

        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi label="Factures" value={String(invoices.length)} />
          <Kpi label={`Facturat el ${thisYear}`} value={formatEuro(yearTotal)} />
          <Kpi label="Facturat en total" value={formatEuro(sum("total"))} hint={`Base ${formatEuro(sum("baseAmount"))}`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <InfoCard title="Dades fiscals" rows={fiscal} />
          <InfoCard title="Contacte i pagament" rows={contact} />
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{supplier.notes || "Sense notes."}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="pb-0">
          <CardHeader className="border-b pb-4">
            <CardTitle>Factures</CardTitle>
            <CardDescription>Factures enllaçades a aquest proveïdor.</CardDescription>
            <CardAction>
              <InvoiceDialog projectOptions={projectOptions} suppliers={supplierOptions} defaultSupplierId={supplier.id}>
                <Button size="sm">
                  <PlusIcon /> Nova factura
                </Button>
              </InvoiceDialog>
            </CardAction>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Data</TableHead>
                <TableHead>Número</TableHead>
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
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    Encara no hi ha cap factura d&apos;aquest proveïdor.
                  </TableCell>
                </TableRow>
              )}
              {invoices.map((inv) => {
                const { projects: _p, supplier: _s, allocations, assigned, cost: _c, ...row } = inv
                return (
                  <InvoiceTableRow
                    key={inv.id}
                    invoice={row}
                    allocations={allocations.map((a) => ({ id: a.projectId, percentage: a.percentage }))}
                    projectOptions={projectOptions}
                    suppliers={supplierOptions}
                  >
                    <TableCell className="pl-4 whitespace-nowrap">{formatDate(inv.issueDate)}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.number}</TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground">{inv.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEuro(inv.baseAmount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatEuro(inv.vatAmount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {inv.irpfAmount ? `−${formatEuro(inv.irpfAmount)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatEuro(inv.total)}</TableCell>
                    <TableCell>
                      <div className="flex max-w-60 flex-wrap gap-1">
                        {allocations.map((a) => (
                          <Badge key={a.projectId} variant="secondary" className="max-w-56">
                            <Link href={`/projectes/${a.projectId}`} className="truncate">
                              {a.name}
                            </Link>{" "}
                            · {a.percentage} %
                          </Badge>
                        ))}
                        {assigned < 100 && (
                          <Badge variant="destructive">{round2(100 - assigned)} % sense assignar</Badge>
                        )}
                      </div>
                    </TableCell>
                  </InvoiceTableRow>
                )
              })}
            </TableBody>
            {invoices.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-4" colSpan={3}>
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

function InfoCard({ title, rows }: { title: string; rows: readonly (readonly [string, string | null])[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-words">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="px-4 text-xs text-muted-foreground">{hint}</CardContent>}
    </Card>
  )
}
