"use client"

import { useState } from "react"

import { InteractiveTableRow } from "@/components/app/interactive-table-row"
import { InvoiceRowActions } from "@/components/invoices/invoice-row-actions"
import { TableCell } from "@/components/ui/table"
import type { SupplierInvoice } from "@/db/schema"

export function InvoiceTableRow({
  invoice,
  allocations,
  categoryIds,
  categories,
  projectOptions,
  suppliers,
  children,
  className,
}: {
  invoice: SupplierInvoice
  allocations: { id: string; percentage: number }[]
  categoryIds?: string[]
  categories?: React.ComponentProps<typeof InvoiceRowActions>["categories"]
  projectOptions: { id: string; name: string; hint?: string }[]
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
          categoryIds={categoryIds}
          categories={categories}
          projectOptions={projectOptions}
          suppliers={suppliers}
          open={open}
          onOpenChange={setOpen}
        />
      </TableCell>
    </InteractiveTableRow>
  )
}
