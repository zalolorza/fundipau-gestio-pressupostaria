"use client"

import { useMemo } from "react"

import { InvoiceFilters } from "@/components/invoices/invoice-filters"
import { InvoiceListNavProvider } from "@/components/invoices/invoice-list-nav"
import { InvoicesTable } from "@/components/invoices/invoices-table"
import type { InvoiceListItem, SupplierOption } from "@/server/queries"

export function InvoicesBrowser({
  invoices,
  suppliers,
  projects,
  projectOptions,
  defaultVatDeductibleRate,
}: {
  invoices: InvoiceListItem[]
  suppliers: SupplierOption[]
  projects: { id: string; name: string }[]
  projectOptions: { id: string; name: string; hint?: string }[]
  defaultVatDeductibleRate?: number
}) {
  const dataKey = useMemo(
    () => invoices.map((i) => `${i.id}:${i.assigned}:${i.total}`).join("|"),
    [invoices]
  )

  return (
    <InvoiceListNavProvider dataKey={dataKey}>
      <div className="space-y-4">
        <InvoiceFilters suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} projects={projects} />
        <InvoicesTable
          invoices={invoices}
          projectOptions={projectOptions}
          suppliers={suppliers}
          defaultVatDeductibleRate={defaultVatDeductibleRate}
        />
      </div>
    </InvoiceListNavProvider>
  )
}
