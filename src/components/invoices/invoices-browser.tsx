"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"

import { DownloadXlsxButton } from "@/components/app/download-xlsx-button"
import { InvoiceFilters } from "@/components/invoices/invoice-filters"
import { InvoiceListNavProvider } from "@/components/invoices/invoice-list-nav"
import { InvoicesTable } from "@/components/invoices/invoices-table"
import {
  buildInvoicesSheet,
  invoicesListFilename,
} from "@/lib/exports/invoices"
import type { InvoiceListItem, SupplierOption } from "@/server/queries"

export function InvoicesBrowser({
  invoices,
  suppliers,
  projects,
  projectOptions,
  activitiesByProject = {},
  categories = [],
  defaultVatDeductibleRate,
}: {
  invoices: InvoiceListItem[]
  suppliers: SupplierOption[]
  projects: { id: string; name: string }[]
  projectOptions: { id: string; name: string; hint?: string }[]
  activitiesByProject?: Record<string, { id: string; name: string }[]>
  categories?: { id: string; name: string }[]
  defaultVatDeductibleRate?: number
}) {
  const params = useSearchParams()
  const dataKey = useMemo(
    () => invoices.map((i) => `${i.id}:${i.assigned}:${i.total}`).join("|"),
    [invoices]
  )

  const supplierId = params.get("proveidor")
  const supplierName = supplierId
    ? suppliers.find((s) => s.id === supplierId)?.name
    : null
  const filename = invoicesListFilename({
    supplierName,
    des: params.get("des"),
    fins: params.get("fins"),
  })

  return (
    <InvoiceListNavProvider dataKey={dataKey}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <InvoiceFilters
              suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
              projects={projects}
              categories={categories}
            />
          </div>
          <DownloadXlsxButton
            size="sm"
            filename={filename}
            getSheets={() => buildInvoicesSheet(invoices)}
            disabled={invoices.length === 0}
          />
        </div>
        <InvoicesTable
          invoices={invoices}
          projectOptions={projectOptions}
          activitiesByProject={activitiesByProject}
          suppliers={suppliers}
          categories={categories}
          defaultVatDeductibleRate={defaultVatDeductibleRate}
        />
      </div>
    </InvoiceListNavProvider>
  )
}
