"use client"

import { ChevronRightIcon, PencilIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { InteractiveTableRow } from "@/components/app/interactive-table-row"
import { InvoiceDialog } from "@/components/invoices/invoice-dialog"
import {
  AssignPayrollDialog,
  type PayrollAssignmentEdit,
  type PayrollOption,
} from "@/components/projects/assign-payroll-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { SupplierInvoice } from "@/db/schema"
import { COST_TYPE_LABELS, type CostType } from "@/lib/cost-type"
import { formatDate, formatEuro, formatMonth, formatPct } from "@/lib/format"
import { unassignInvoiceFromProject, unassignPayrollEntries } from "@/server/actions"
import type { SupplierOption } from "@/server/queries"

type Inv = SupplierInvoice & {
  cost: number
  percentage: number
  imputed: number
  allocations: { id: string; percentage: number }[]
}

type CostTypeFilter = "all" | CostType

function CostTypeFilterSelect({
  value,
  onChange,
}: {
  value: CostTypeFilter
  onChange: (v: CostTypeFilter) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CostTypeFilter)}>
      <SelectTrigger className="w-44" aria-label="Tipus de cost">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tots els tipus</SelectItem>
        <SelectItem value="direct">{COST_TYPE_LABELS.direct}s</SelectItem>
        <SelectItem value="indirect">{COST_TYPE_LABELS.indirect}s</SelectItem>
      </SelectContent>
    </Select>
  )
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
  const [editId, setEditId] = useState<string | null>(null)
  const [tipus, setTipus] = useState<CostTypeFilter>("all")
  const filtered = useMemo(
    () => (tipus === "all" ? invoices : invoices.filter((i) => i.costType === tipus)),
    [invoices, tipus]
  )

  if (invoices.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Cap factura assignada.</p>

  return (
    <div>
      <div className="flex items-center justify-end gap-2 border-b px-4 py-2">
        <CostTypeFilterSelect value={tipus} onChange={setTipus} />
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cap factura amb aquest filtre.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Data</TableHead>
              <TableHead>Proveïdor · Número</TableHead>
              <TableHead>Tipus</TableHead>
              <TableHead>Descripció</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Imputat</TableHead>
              <TableHead className="w-10 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((i) => {
              const { cost: _c, percentage: _p, imputed: _im, allocations, ...invoice } = i
              return (
                <InteractiveTableRow key={i.id} onActivate={() => setEditId(i.id)}>
                  <TableCell className="pl-4 whitespace-nowrap">{formatDate(i.issueDate)}</TableCell>
                  <TableCell>
                    <InvoiceDialog
                      invoice={invoice}
                      allocations={allocations}
                      projectOptions={projectOptions}
                      suppliers={suppliers}
                      open={editId === i.id}
                      onOpenChange={(o) => setEditId(o ? i.id : null)}
                    >
                      <Button variant="link" className="h-auto p-0 font-medium text-foreground">
                        {i.supplierName}
                        <span className="font-normal text-muted-foreground"> · {i.number}</span>
                      </Button>
                    </InvoiceDialog>
                  </TableCell>
                  <TableCell>
                    <Badge variant={i.costType === "indirect" ? "outline" : "secondary"}>
                      {COST_TYPE_LABELS[i.costType]}
                    </Badge>
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
                </InteractiveTableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

type PersonGroup = {
  payrollId: string
  personName: string
  role: string | null
  total: number
  entries: {
    entryId: string
    month: string
    amount: number
    percentage: number
    imputed: number
    costType: CostType
  }[]
}

function editFromGroup(g: PersonGroup): PayrollAssignmentEdit {
  const months = g.entries.map((e) => e.month).sort()
  const pcts = [...new Set(g.entries.map((e) => e.percentage))]
  const types = [...new Set(g.entries.map((e) => e.costType))]
  return {
    payrollId: g.payrollId,
    from: months[0]!,
    to: months[months.length - 1]!,
    percentage: pcts.length === 1 ? pcts[0]! : g.entries[0]!.percentage,
    costType: types.length === 1 ? types[0]! : "direct",
    entryIdsByMonth: g.entries.map((e) => ({ entryId: e.entryId, month: e.month })),
  }
}

export function AssignedPayroll({
  projectId,
  groups,
  payrolls,
  defaultFrom,
  defaultTo,
}: {
  projectId: string
  groups: PersonGroup[]
  payrolls: PayrollOption[]
  defaultFrom?: string | null
  defaultTo?: string | null
}) {
  const [pending, start] = useTransition()
  const [tipus, setTipus] = useState<CostTypeFilter>("all")
  const [edit, setEdit] = useState<PayrollAssignmentEdit | null>(null)

  const filtered = useMemo(() => {
    if (tipus === "all") return groups
    return groups
      .map((g) => {
        const entries = g.entries.filter((e) => e.costType === tipus)
        if (!entries.length) return null
        return {
          ...g,
          entries,
          total: entries.reduce((s, e) => s + e.imputed, 0),
        }
      })
      .filter((g): g is PersonGroup => g != null)
  }, [groups, tipus])

  if (groups.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Cap nòmina assignada.</p>

  const remove = (ids: string[], msg: string) =>
    start(async () => {
      await unassignPayrollEntries(projectId, ids)
      toast.success(msg)
    })

  return (
    <div>
      <div className="flex items-center justify-end gap-2 border-b px-4 py-2">
        <CostTypeFilterSelect value={tipus} onChange={setTipus} />
      </div>
      <AssignPayrollDialog
        projectId={projectId}
        payrolls={payrolls}
        defaultFrom={defaultFrom}
        defaultTo={defaultTo}
        edit={edit}
        open={edit != null}
        onOpenChange={(o) => {
          if (!o) setEdit(null)
        }}
      />
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cap nòmina amb aquest filtre.</p>
      ) : (
        <div className="divide-y">
          {filtered.map((g) => {
            const months = g.entries.map((e) => e.month).sort()
            const pcts = [...new Set(g.entries.map((e) => e.percentage))]
            const types = [...new Set(g.entries.map((e) => e.costType))]
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
                  {types.map((t) => (
                    <Badge key={t} variant={t === "indirect" ? "outline" : "secondary"}>
                      {COST_TYPE_LABELS[t]}
                    </Badge>
                  ))}
                  <span className="ml-auto font-medium tabular-nums">{formatEuro(g.total)}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edita l'assignació"
                    onClick={(e) => {
                      e.preventDefault()
                      setEdit(editFromGroup(g))
                    }}
                  >
                    <PencilIcon />
                  </Button>
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
                        <TableHead>Tipus</TableHead>
                        <TableHead className="text-right">Nòmina</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead className="text-right">Imputat</TableHead>
                        <TableHead className="w-10 pr-4" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.entries.map((e) => (
                        <InteractiveTableRow
                          key={e.entryId}
                          onActivate={() =>
                            setEdit({
                              payrollId: g.payrollId,
                              from: e.month,
                              to: e.month,
                              percentage: e.percentage,
                              costType: e.costType,
                              entryIdsByMonth: [{ entryId: e.entryId, month: e.month }],
                            })
                          }
                        >
                          <TableCell className="pl-12">{formatMonth(e.month)}</TableCell>
                          <TableCell>
                            <Badge variant={e.costType === "indirect" ? "outline" : "secondary"}>
                              {COST_TYPE_LABELS[e.costType]}
                            </Badge>
                          </TableCell>
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
                        </InteractiveTableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
