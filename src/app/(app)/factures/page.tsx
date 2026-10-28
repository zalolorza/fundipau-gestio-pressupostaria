import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { InvoiceDialog } from "@/components/invoices/invoice-dialog"
import { InvoicesBrowser } from "@/components/invoices/invoices-browser"
import { Button } from "@/components/ui/button"
import {
  invoiceAssignmentFilters,
  invoiceSortKeys,
  getProjectOptions,
  getSupplierOptions,
  listInvoices,
  type InvoiceAssignmentFilter,
  type InvoiceSortKey,
} from "@/server/queries"

export const metadata: Metadata = { title: "Factures de proveïdors" }

const isDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
const isSort = (v: unknown): v is InvoiceSortKey =>
  typeof v === "string" && (invoiceSortKeys as readonly string[]).includes(v)
const isAssignment = (v: unknown): v is InvoiceAssignmentFilter =>
  typeof v === "string" && (invoiceAssignmentFilters as readonly string[]).includes(v)

export default async function InvoicesPage({ searchParams }: PageProps<"/factures">) {
  const sp = await searchParams
  const isUuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined)
  const filters = {
    q: typeof sp.q === "string" ? sp.q : undefined,
    from: isDate(sp.des),
    to: isDate(sp.fins),
    supplierId: isUuid(sp.proveidor),
    projectId: isUuid(sp.projecte),
    assignment: isAssignment(sp.assignacio) ? sp.assignacio : undefined,
    sort: isSort(sp.ordre) ? sp.ordre : undefined,
    dir: sp.dir === "asc" ? ("asc" as const) : sp.dir === "desc" ? ("desc" as const) : undefined,
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
        <InvoicesBrowser
          invoices={invoices}
          suppliers={suppliers}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          projectOptions={projectOptions}
        />
      </PageBody>
    </>
  )
}
