"use client"

import { ChevronDownIcon, PlusIcon } from "lucide-react"
import { useState } from "react"

import { InvoiceDialog } from "@/components/invoices/invoice-dialog"
import {
  AssignInvoiceDialog,
  type AssignableInvoice,
} from "@/components/projects/assign-invoice-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ActivityRef } from "@/components/projects/project-activities"
import type { SupplierOption } from "@/server/queries"

export function ProjectInvoiceMenu({
  projectId,
  invoices,
  current,
  projectOptions,
  activitiesByProject = {},
  suppliers,
  categories = [],
  activities = [],
  defaultVatDeductibleRate,
}: {
  projectId: string
  invoices: AssignableInvoice[]
  current: Record<string, number>
  projectOptions: { id: string; name: string; hint?: string }[]
  activitiesByProject?: Record<string, { id: string; name: string }[]>
  suppliers: SupplierOption[]
  categories?: { id: string; name: string }[]
  activities?: ActivityRef[]
  defaultVatDeductibleRate?: number
}) {
  const [mode, setMode] = useState<"create" | "assign" | null>(null)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <PlusIcon /> Factura
            <ChevronDownIcon className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setMode("create")}>Nova factura</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMode("assign")}>Assigna existent</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <InvoiceDialog
        open={mode === "create"}
        onOpenChange={(o) => {
          if (!o) setMode(null)
        }}
        projectOptions={projectOptions}
        activitiesByProject={activitiesByProject}
        suppliers={suppliers}
        categories={categories}
        allocations={[{ id: projectId, percentage: 100, activityId: null }]}
        defaultVatDeductibleRate={defaultVatDeductibleRate}
      />
      <AssignInvoiceDialog
        open={mode === "assign"}
        onOpenChange={(o) => {
          if (!o) setMode(null)
        }}
        projectId={projectId}
        invoices={invoices}
        current={current}
        activities={activities}
      />
    </>
  )
}
