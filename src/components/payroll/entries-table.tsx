"use client"

import { PencilIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmButton } from "@/components/app/confirm-button"
import { InteractiveTableRow } from "@/components/app/interactive-table-row"
import { AmountChangeDialog } from "@/components/payroll/amount-change-dialog"
import { EntryAllocationDialog } from "@/components/payroll/entry-allocation-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatEuro, formatMonth, round2 } from "@/lib/format"
import { cn } from "@/lib/utils"
import { deletePayrollEntry } from "@/server/actions"

type Entry = {
  id: string
  month: string
  amount: number
  assigned: number
  allocations: { projectId: string; name: string; percentage: number }[]
}

export function EntriesTable({
  payrollId,
  entries,
  projectOptions,
  current,
}: {
  payrollId: string
  entries: Entry[]
  projectOptions: { id: string; name: string; hint?: string }[]
  current: string
}) {
  const [allocOpenId, setAllocOpenId] = useState<string | null>(null)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Mes</TableHead>
          <TableHead className="text-right">Quantitat</TableHead>
          <TableHead>Projectes</TableHead>
          <TableHead className="text-right">Imputat</TableHead>
          <TableHead className="w-24 pr-4" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e) => {
          const isCurrent = e.month === current
          return (
            <InteractiveTableRow
              key={e.id}
              className={cn(isCurrent && "bg-primary/5", e.month > current && "text-muted-foreground")}
              onActivate={() => setAllocOpenId(e.id)}
            >
              <TableCell className="pl-4 whitespace-nowrap">
                {formatMonth(e.month)}
                {isCurrent && (
                  <Badge className="ml-2" variant="default">
                    Actual
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <AmountChangeDialog payrollId={payrollId} referenceMonth={e.month} currentAmount={e.amount}>
                  <Button
                    variant="ghost"
                    className="group h-auto gap-1.5 px-1.5 font-normal tabular-nums hover:text-primary"
                  >
                    {formatEuro(e.amount)}
                    <PencilIcon className="size-3 opacity-0 group-hover:opacity-100" />
                  </Button>
                </AmountChangeDialog>
              </TableCell>
              <TableCell>
                <EntryAllocationDialog
                  payrollId={payrollId}
                  month={e.month}
                  allocations={e.allocations.map((a) => ({ id: a.projectId, percentage: a.percentage }))}
                  projectOptions={projectOptions}
                  open={allocOpenId === e.id}
                  onOpenChange={(o) => setAllocOpenId(o ? e.id : null)}
                >
                  <Button variant="ghost" className="h-auto flex-wrap justify-start gap-1 p-1 font-normal">
                    {e.allocations.map((a) => (
                      <Badge key={a.projectId} variant="secondary">
                        {a.name} · {a.percentage} %
                      </Badge>
                    ))}
                    {e.assigned < 100 && (
                      <Badge variant="outline" className="border-dashed">
                        {round2(100 - e.assigned)} % lliure
                      </Badge>
                    )}
                  </Button>
                </EntryAllocationDialog>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatEuro((e.amount * e.assigned) / 100)}</TableCell>
              <TableCell className="pr-4">
                <div className="flex justify-end" data-row-ignore>
                  <ConfirmButton
                    title={`Eliminar ${formatMonth(e.month)}?`}
                    description="S'eliminarà aquest registre mensual i les seves assignacions."
                    onConfirm={async () => {
                      await deletePayrollEntry(payrollId, e.id)
                      toast.success("Mes eliminat")
                    }}
                  >
                    <Button variant="ghost" size="icon-sm" aria-label="Elimina el mes" className="text-muted-foreground">
                      <Trash2Icon />
                    </Button>
                  </ConfirmButton>
                </div>
              </TableCell>
            </InteractiveTableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
