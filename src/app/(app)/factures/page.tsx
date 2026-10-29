import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { InvoiceDialog } from "@/components/invoices/invoice-dialog"
import { InvoicesBrowser } from "@/components/invoices/invoices-browser"
import { Button } from "@/components/ui/button"
import { getDefaultVatDeductibleRate } from "@/lib/app-settings"
import { COST_TYPE_PARAMS, costTypeFromParam } from "@/lib/cost-type"
import {
  activitiesByProjectMap,
  invoiceAssignmentFilters,
  invoiceSortKeys,
  getProjectOptions,
  getSupplierOptions,
  listCategories,
  listInvoices,
  listProjectActivities,
  type InvoiceAssignmentFilter,
  type InvoiceSortKey,
} from "@/server/queries"

export const metadata: Metadata = { title: "Factures de proveïdors" }

const isDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
const isSort = (v: unknown): v is InvoiceSortKey =>
  typeof v === "string" && (invoiceSortKeys as readonly string[]).includes(v)
const isAssignment = (v: unknown): v is InvoiceAssignmentFilter =>
  typeof v === "string" && (invoiceAssignmentFilters as readonly string[]).includes(v)
const isTipus = (v: unknown) =>
  typeof v === "string" && (COST_TYPE_PARAMS as readonly string[]).includes(v) ? v : undefined

export default async function InvoicesPage({ searchParams }: PageProps<"/factures">) {
  const sp = await searchParams
  const isUuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined)
  const categoriaRaw = typeof sp.categoria === "string" ? sp.categoria : undefined
  const categoryId =
    categoriaRaw === "none" ? "none" : isUuid(categoriaRaw) ? categoriaRaw : undefined
  const filters = {
    q: typeof sp.q === "string" ? sp.q : undefined,
    from: isDate(sp.des),
    to: isDate(sp.fins),
    supplierId: isUuid(sp.proveidor),
    projectId: isUuid(sp.projecte),
    assignment: isAssignment(sp.assignacio) ? sp.assignacio : undefined,
    costType: costTypeFromParam(isTipus(sp.tipus)),
    categoryId,
    sort: isSort(sp.ordre) ? sp.ordre : undefined,
    dir: sp.dir === "asc" ? ("asc" as const) : sp.dir === "desc" ? ("desc" as const) : undefined,
  }
  const [invoices, projects, suppliers, categories, activities, defaultVatDeductibleRate] =
    await Promise.all([
      listInvoices(filters),
      getProjectOptions(),
      getSupplierOptions(),
      listCategories(),
      listProjectActivities(),
      getDefaultVatDeductibleRate(),
    ])
  const today = new Date().toISOString().slice(0, 10)
  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    hint: p.closedAt && p.closedAt < today ? "tancat" : undefined,
  }))
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }))
  const activitiesByProject = activitiesByProjectMap(activities)

  return (
    <>
      <PageHeader crumbs={[{ label: "Costos" }, { label: "Factures de proveïdors" }]} />
      <PageBody>
        <PageTitle title="Factures de proveïdors" description="Factures rebudes i la seva imputació a projectes.">
          <InvoiceDialog
            projectOptions={projectOptions}
            activitiesByProject={activitiesByProject}
            suppliers={suppliers}
            categories={categoryOptions}
            defaultVatDeductibleRate={defaultVatDeductibleRate}
          >
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
          activitiesByProject={activitiesByProject}
          categories={categoryOptions}
          defaultVatDeductibleRate={defaultVatDeductibleRate}
        />
      </PageBody>
    </>
  )
}
