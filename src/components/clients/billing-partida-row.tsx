"use client"

import { useState } from "react"

import { InteractiveTableRow } from "@/components/app/interactive-table-row"
import { InvoiceDialog } from "@/components/invoices/invoice-dialog"
import { EntryAllocationDialog } from "@/components/payroll/entry-allocation-dialog"
import { Badge } from "@/components/ui/badge"
import { TableCell } from "@/components/ui/table"
import { formatDate, formatEuro, formatMonth, formatPct } from "@/lib/format"
import type { BillingLine, SupplierOption } from "@/server/queries"

export type BillingEditOptions = {
  projectOptions: { id: string; name: string; hint?: string }[]
  activitiesByProject: Record<string, { id: string; name: string }[]>
  fundersByProject: Record<string, { id: string; name: string }[]>
  suppliers: SupplierOption[]
  categories: { id: string; name: string }[]
}

export function BillingPartidaRow({
  line,
  edit,
}: {
  line: BillingLine
  edit: BillingEditOptions
}) {
  const [open, setOpen] = useState(false)

  const dialog =
    line.kind === "factura" ? (
      <InvoiceDialog
        invoice={line.invoice}
        allocations={line.allocations}
        funderAllocations={line.funderAllocations}
        categoryIds={line.categoryIds}
        categories={edit.categories}
        projectOptions={edit.projectOptions}
        activitiesByProject={edit.activitiesByProject}
        fundersByProject={edit.fundersByProject}
        suppliers={edit.suppliers}
        open={open}
        onOpenChange={setOpen}
      />
    ) : (
      <EntryAllocationDialog
        payrollId={line.payrollId}
        month={line.month}
        allocations={line.allocations}
        funderAllocations={line.funderAllocations}
        projectOptions={edit.projectOptions}
        activitiesByProject={edit.activitiesByProject}
        fundersByProject={edit.fundersByProject}
        categories={edit.categories}
        open={open}
        onOpenChange={setOpen}
      />
    )

  return (
    <InteractiveTableRow onActivate={() => setOpen(true)}>
      <TableCell className="pl-4 whitespace-nowrap">
        {line.kind === "nomina"
          ? formatMonth(line.date, true)
          : formatDate(line.date)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={line.kind === "nomina" ? "secondary" : "outline"}>
            {line.kind === "nomina" ? "Nòmina" : "Factura"}
          </Badge>
          <span>{line.concept}</span>
        </div>
        {line.detail && (
          <p className="text-xs text-muted-foreground">{line.detail}</p>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatEuro(line.cost)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatPct(line.projectPct)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatPct(line.clientPct)}
      </TableCell>
      <TableCell className="pr-4 text-right font-medium tabular-nums">
        {formatEuro(line.amount)}
        {dialog}
      </TableCell>
    </InteractiveTableRow>
  )
}
