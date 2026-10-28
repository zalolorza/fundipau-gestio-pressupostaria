"use client"

import { PencilIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmButton } from "@/components/app/confirm-button"
import { InvoiceDialog } from "@/components/invoices/invoice-dialog"
import { Button } from "@/components/ui/button"
import type { SupplierInvoice } from "@/db/schema"
import { deleteInvoice } from "@/server/actions"

export function InvoiceRowActions({
  invoice,
  allocations,
  projectOptions,
  suppliers,
  open,
  onOpenChange,
}: {
  invoice: SupplierInvoice
  allocations: { id: string; percentage: number }[]
  projectOptions: { id: string; name: string; hint?: string }[]
  suppliers: React.ComponentProps<typeof InvoiceDialog>["suppliers"]
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <div className="flex justify-end gap-1" data-row-ignore>
      <InvoiceDialog
        invoice={invoice}
        allocations={allocations}
        projectOptions={projectOptions}
        suppliers={suppliers}
        open={open}
        onOpenChange={onOpenChange}
      >
        <Button variant="ghost" size="icon-sm" aria-label="Edita">
          <PencilIcon />
        </Button>
      </InvoiceDialog>
      <ConfirmButton
        title={`Eliminar la factura ${invoice.number}?`}
        description="També se n'eliminaran les assignacions a projectes."
        onConfirm={async () => {
          await deleteInvoice(invoice.id)
          toast.success("Factura eliminada")
        }}
      >
        <Button variant="ghost" size="icon-sm" aria-label="Elimina" className="text-destructive">
          <Trash2Icon />
        </Button>
      </ConfirmButton>
    </div>
  )
}
