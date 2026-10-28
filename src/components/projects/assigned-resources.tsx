"use client"

import { ChevronRightIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useTransition } from "react"
import { toast } from "sonner"

import { InvoiceDialog } from "@/components/invoices/invoice-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { SupplierInvoice } from "@/db/schema"
import { formatDate, formatEuro, formatMonth, formatPct } from "@/lib/format"
import { unassignInvoiceFromProject, unassignPayrollEntries } from "@/server/actions"
import type { SupplierOption } from "@/server/queries"

type Inv = SupplierInvoice & {
  cost: number
  percentage: number
  imputed: number
  allocations: { id: string; percentage: number }[]
}

export function AssignedInvoices({
  projectId,
  invoices,
  projectOptions,
  suppliers,
}: {
  projectId: string
  invoices: Inv[]
  projectOptions: { id: string; name: string; hint?: string }[]
  suppliers: SupplierOption[]
}) {
  const [pending, start] = useTransition()
  if (invoices.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Cap factura assignada.</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Data</TableHead>
          <TableHead>Proveïdor · Número</TableHead>
          <TableHead>Descripció</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead className="text-right">%</TableHead>
          <TableHead className="text-right">Imputat</TableHead>
          <TableHead className="w-10 pr-4" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((i) => {
          const { cost: _c, percentage: _p, imputed: _im, allocations, ...invoice } = i
          return (
            <TableRow key={i.id}>
              <TableCell className="pl-4 whitespace-nowrap">{formatDate(i.issueDate)}</TableCell>
              <TableCell>
                <InvoiceDialog
                  invoice={invoice}
                  allocations={allocations}
                  projectOptions={projectOptions}
                  suppliers={suppliers}
                >
                  <Button variant="link" className="h-auto p-0 font-medium text-foreground">
                    {i.supplierName}
                    <span className="font-normal text-muted-foreground"> · {i.number}</span>
                  </Button>
                </InvoiceDialog>
              </TableCell>
              <TableCell className="max-w-56 truncate text-muted-foreground">{i.description}</TableCell>
              <TableCell className="text-right tabular-nums">{formatEuro(i.cost)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatPct(i.percentage)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatEuro(i.imputed)}</TableCell>
              <TableCell className="pr-4">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  aria-label="Desassigna"
                  onClick={() =>
                    start(async () => {
                      await unassignInvoiceFromProject(projectId, i.id)
                      toast.success("Factura desassignada")
                    })
                  }
                >
                  <XIcon />
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

type PersonGroup = {
  payrollId: string
  personName: string
  role: string | null
  total: number
  entries: { entryId: string; month: string; amount: number; percentage: number; imputed: number }[]
}

export function AssignedPayroll({ projectId, groups }: { projectId: string; groups: PersonGroup[] }) {
  const [pending, start] = useTransition()
  if (groups.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Cap nòmina assignada.</p>

  const remove = (ids: string[], msg: string) =>
    start(async () => {
      await unassignPayrollEntries(projectId, ids)
      toast.success(msg)
    })

  return (
    <div className="divide-y">
      {groups.map((g) => {
        const months = g.entries.map((e) => e.month).sort()
        const pcts = [...new Set(g.entries.map((e) => e.percentage))]
        return (
          <details key={g.payrollId} className="group">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
              <div className="min-w-0">
                <Link href={`/nomines/${g.payrollId}`} className="font-medium hover:text-primary hover:underline">
                  {g.personName}
                </Link>
                {g.role && <span className="text-sm text-muted-foreground"> · {g.role}</span>}
              </div>
              <Badge variant="secondary">
                {formatMonth(months[0], true)} – {formatMonth(months[months.length - 1], true)}
              </Badge>
              <Badge variant="outline">{pcts.length === 1 ? formatPct(pcts[0]) : "% variable"}</Badge>
              <span className="ml-auto font-medium tabular-nums">{formatEuro(g.total)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={pending}
                aria-label="Desassigna tots els mesos"
                onClick={(e) => {
                  e.preventDefault()
                  remove(
                    g.entries.map((x) => x.entryId),
                    `${g.personName} desassignada del projecte`
                  )
                }}
              >
                <XIcon />
              </Button>
            </summary>
            <div className="pb-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-12">Mes</TableHead>
                    <TableHead className="text-right">Nòmina</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Imputat</TableHead>
                    <TableHead className="w-10 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.entries.map((e) => (
                    <TableRow key={e.entryId}>
                      <TableCell className="pl-12">{formatMonth(e.month)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEuro(e.amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPct(e.percentage)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEuro(e.imputed)}</TableCell>
                      <TableCell className="pr-4">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          disabled={pending}
                          aria-label="Desassigna el mes"
                          onClick={() => remove([e.entryId], "Mes desassignat")}
                        >
                          <XIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        )
      })}
    </div>
  )
}
