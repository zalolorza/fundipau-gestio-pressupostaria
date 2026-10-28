import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { SupplierDialog } from "@/components/suppliers/supplier-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatEuro } from "@/lib/format"
import { countUnlinkedInvoices, listSuppliers } from "@/server/queries"

export const metadata: Metadata = { title: "Proveïdors" }

export default async function SuppliersPage() {
  const [suppliers, unlinked] = await Promise.all([listSuppliers(), countUnlinkedInvoices()])
  return (
    <>
      <PageHeader crumbs={[{ label: "Costos" }, { label: "Proveïdors" }]} />
      <PageBody>
        <PageTitle
          title="Proveïdors"
          description={
            unlinked > 0 ? (
              <>
                Llista de proveïdors. Hi ha {unlinked} {unlinked === 1 ? "factura" : "factures"} sense proveïdor
                enllaçat.
              </>
            ) : (
              "Llista de proveïdors i el que se'ls ha facturat."
            )
          }
        >
          <SupplierDialog>
            <Button>
              <PlusIcon /> Nou proveïdor
            </Button>
          </SupplierDialog>
        </PageTitle>
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Proveïdor</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Població</TableHead>
                <TableHead>IVA / IRPF</TableHead>
                <TableHead className="text-right">Factures</TableHead>
                <TableHead className="text-right">Total facturat</TableHead>
                <TableHead className="pr-4 text-right">Última factura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Encara no hi ha cap proveïdor.
                  </TableCell>
                </TableRow>
              )}
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/proveidors/${s.id}`} className="hover:text-primary hover:underline">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.taxId ?? "—"}</TableCell>
                  <TableCell>{s.city ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {s.defaultVatRate} % / {s.defaultIrpfRate} %
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.invoiceCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(s.total)}</TableCell>
                  <TableCell className="pr-4 text-right text-muted-foreground">
                    {s.lastInvoice ? formatDate(s.lastInvoice) : "—"}
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
