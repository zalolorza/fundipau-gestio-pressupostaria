"use client"

import { PencilIcon, Trash2Icon } from "lucide-react"

import { ConfirmButton } from "@/components/app/confirm-button"
import { SupplierDialog } from "@/components/suppliers/supplier-dialog"
import { Button } from "@/components/ui/button"
import type { Supplier } from "@/db/schema"
import { deleteSupplier } from "@/server/actions"

export function SupplierActions({ supplier, invoiceCount }: { supplier: Supplier; invoiceCount: number }) {
  return (
    <>
      <SupplierDialog supplier={supplier}>
        <Button variant="outline">
          <PencilIcon /> Edita
        </Button>
      </SupplierDialog>
      <ConfirmButton
        title="Eliminar el proveïdor?"
        description={
          invoiceCount > 0
            ? `Les ${invoiceCount} factures d'aquest proveïdor NO s'eliminen: conserven les dades fiscals però quedaran sense enllaçar.`
            : "Aquest proveïdor no té factures."
        }
        onConfirm={() => deleteSupplier(supplier.id)}
      >
        <Button variant="outline" className="text-destructive">
          <Trash2Icon /> Elimina
        </Button>
      </ConfirmButton>
    </>
  )
}
