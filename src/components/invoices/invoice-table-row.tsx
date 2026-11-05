"use client"

import { useState } from "react"

import { InteractiveTableRow } from "@/components/app/interactive-table-row"
import { InvoiceRowActions } from "@/components/invoices/invoice-row-actions"
import { TableCell } from "@/components/ui/table"
import type { SupplierInvoice } from "@/db/schema"

export function InvoiceTableRow({
  invoice,
  allocations,
  funderAllocations,
  categoryIds,
  categories,
  projectOptions,
  activitiesByProject,
  fundersByProject,
  suppliers,
  children,
  className,
}: {
  invoice: SupplierInvoice
  allocations: {
    id: string
    percentage: number
    activityId?: string | null
  }[]
  funderAllocations?: { id: string; percentage: number }[]
  categoryIds?: string[]
  categories?: React.ComponentProps<typeof InvoiceRowActions>["categories"]
  projectOptions: { id: string; name: string; hint?: string }[]
  activitiesByProject?: React.ComponentProps<typeof InvoiceRowActions>["activitiesByProject"]
  fundersByProject?: React.ComponentProps<typeof InvoiceRowActions>["fundersByProject"]
  suppliers: React.ComponentProps<typeof InvoiceRowActions>["suppliers"]
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <InteractiveTableRow className={className} onActivate={() => setOpen(true)}>
      {children}
      <TableCell className="pr-4">
        <InvoiceRowActions
          invoice={invoice}
          allocations={allocations}
          funderAllocations={funderAllocations}
          categoryIds={categoryIds}
          categories={categories}
          projectOptions={projectOptions}
          activitiesByProject={activitiesByProject}
          fundersByProject={fundersByProject}
          suppliers={suppliers}
          open={open}
          onOpenChange={setOpen}
        />
      </TableCell>
    </InteractiveTableRow>
  )
}
