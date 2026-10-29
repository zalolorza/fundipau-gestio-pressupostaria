"use client"

import { ChevronRightIcon, PencilIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { DownloadXlsxButton } from "@/components/app/download-xlsx-button"
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
import {
  buildAssignedInvoiceSheets,
  buildAssignedPayrollSheets,
  projectInvoicesFilename,
  projectPayrollFilename,
} from "@/lib/exports/project"
import { COST_TYPE_LABELS, type CostType } from "@/lib/cost-type"
import { formatDate, formatEuro, formatMonth, formatPct } from "@/lib/format"
import type { ActivityRef } from "@/components/projects/project-activities"
import {
  setInvoiceProjectActivity,
  setPayrollEntryProjectActivity,
  unassignInvoiceFromProject,
  unassignPayrollEntries,
} from "@/server/actions"
import type { SupplierOption } from "@/server/queries"

const ACTIVITY_NONE = "__none__"

type Inv = SupplierInvoice & {
  cost: number
  percentage: number
  imputed: number
  allocations: { id: string; percentage: number; activityId?: string | null }[]
  categories: { id: string; name: string }[]
  categoryIds: string[]
  activityId: string | null
  activityName: string | null
}

type CostTypeFilter = "all" | CostType
type CategoryFilter = "all" | "none" | string
type ActivityFilter = "all" | "none" | string

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

function CategoryFilterSelect({
  value,
  onChange,
  categories,
}: {
  value: CategoryFilter
  onChange: (v: CategoryFilter) => void
  categories: { id: string; name: string }[]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48" aria-label="Categoria">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Totes les categories</SelectItem>
        <SelectItem value="none">Sense categoria</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ActivityFilterSelect({
  value,
  onChange,
  activities,
}: {
  value: ActivityFilter
  onChange: (v: ActivityFilter) => void
  activities: ActivityRef[]
}) {
  if (activities.length === 0) return null
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48" aria-label="Activitat">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Totes les activitats</SelectItem>
        <SelectItem value="none">Sense activitat</SelectItem>
        {activities.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function matchesCategory(
  categoryIds: string[],
  filter: CategoryFilter
): boolean {
  if (filter === "all") return true
  if (filter === "none") return categoryIds.length === 0
  return categoryIds.includes(filter)
}

function matchesActivity(
  activityId: string | null | undefined,
  filter: ActivityFilter
): boolean {
  if (filter === "all") return true
  if (filter === "none") return !activityId
  return activityId === filter
}

function ActivitySelect({
  value,
  activities,
  disabled,
  onChange,
}: {
  value: string | null
  activities: ActivityRef[]
  disabled?: boolean
  onChange: (activityId: string | null) => void
}) {
  if (activities.length === 0) return null
  return (
    <Select
      value={value ?? ACTIVITY_NONE}
      disabled={disabled}
      onValueChange={(v) => onChange(v === ACTIVITY_NONE ? null : v)}
    >
      <SelectTrigger
        className="h-7 w-36 text-xs"
        aria-label="Activitat"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <SelectValue placeholder="Sense activitat" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ACTIVITY_NONE}>Sense activitat</SelectItem>
        {activities.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function InvoiceActivitySelect({
  projectId,
  invoiceId,
  activityId,
  activities,
}: {
  projectId: string
  invoiceId: string
  activityId: string | null
  activities: ActivityRef[]
}) {
  const [pending, start] = useTransition()
  return (
    <ActivitySelect
      value={activityId}
      activities={activities}
      disabled={pending}
      onChange={(next) =>
        start(async () => {
          const res = await setInvoiceProjectActivity(projectId, invoiceId, next)
          if (!res.ok) toast.error(res.error)
        })
      }
    />
  )
}

function PayrollActivitySelect({
  projectId,
  entryId,
  activityId,
  activities,
}: {
  projectId: string
  entryId: string
  activityId: string | null
  activities: ActivityRef[]
}) {
  const [pending, start] = useTransition()
  return (
    <ActivitySelect
      value={activityId}
      activities={activities}
      disabled={pending}
      onChange={(next) =>
        start(async () => {
          const res = await setPayrollEntryProjectActivity(projectId, entryId, next)
          if (!res.ok) toast.error(res.error)
        })
      }
    />
  )
}

export function AssignedInvoices({
  projectId,
  projectName,
  invoices,
  projectOptions,
  activitiesByProject = {},
  suppliers,
  categories = [],
  activities = [],
}: {
  projectId: string
  projectName: string
  invoices: Inv[]
  projectOptions: { id: string; name: string; hint?: string }[]
  activitiesByProject?: Record<string, { id: string; name: string }[]>
  suppliers: SupplierOption[]
  categories?: { id: string; name: string }[]
  activities?: ActivityRef[]
}) {
  const [pending, start] = useTransition()
  const [editId, setEditId] = useState<string | null>(null)
  const [tipus, setTipus] = useState<CostTypeFilter>("all")
  const [categoria, setCategoria] = useState<CategoryFilter>("all")
  const [activitat, setActivitat] = useState<ActivityFilter>("all")
  const filtered = useMemo(
    () =>
      invoices.filter(
        (i) =>
          (tipus === "all" || i.costType === tipus) &&
          matchesCategory(i.categoryIds, categoria) &&
          matchesActivity(i.activityId, activitat)
      ),
    [invoices, tipus, categoria, activitat]
  )

  if (invoices.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Cap factura assignada.</p>

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <DownloadXlsxButton
          size="sm"
          filename={projectInvoicesFilename(projectName)}
          getSheets={() => buildAssignedInvoiceSheets(filtered)}
          disabled={filtered.length === 0}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <CostTypeFilterSelect value={tipus} onChange={setTipus} />
          <CategoryFilterSelect value={categoria} onChange={setCategoria} categories={categories} />
          <ActivityFilterSelect value={activitat} onChange={setActivitat} activities={activities} />
        </div>
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
              {activities.length > 0 && <TableHead>Activitat</TableHead>}
              <TableHead>Descripció</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Imputat</TableHead>
              <TableHead className="w-10 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((i) => {
              const {
                cost: _c,
                percentage: _p,
                imputed: _im,
                allocations,
                categories: cats,
                categoryIds,
                activityId: _aid,
                activityName: _an,
                ...invoice
              } = i
              return (
                <InteractiveTableRow key={i.id} onActivate={() => setEditId(i.id)}>
                  <TableCell className="pl-4 whitespace-nowrap">{formatDate(i.issueDate)}</TableCell>
                  <TableCell>
                    <InvoiceDialog
                      invoice={invoice}
                      allocations={allocations}
                      categoryIds={categoryIds}
                      categories={categories}
                      projectOptions={projectOptions}
                      activitiesByProject={activitiesByProject}
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
                    <div className="flex max-w-44 flex-wrap gap-1">
                      <Badge variant={i.costType === "indirect" ? "outline" : "secondary"}>
                        {COST_TYPE_LABELS[i.costType]}
                      </Badge>
                      {cats.map((c) => (
                        <Badge key={c.id} variant="outline" className="font-normal">
                          {c.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  {activities.length > 0 && (
                    <TableCell>
                      <InvoiceActivitySelect
                        projectId={projectId}
                        invoiceId={i.id}
                        activityId={i.activityId}
                        activities={activities}
                      />
                    </TableCell>
                  )}
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
    categories: { id: string; name: string }[]
    categoryIds: string[]
    activityId: string | null
    activityName: string | null
  }[]
}

function editFromGroup(g: PersonGroup): PayrollAssignmentEdit {
  const months = g.entries.map((e) => e.month).sort()
  const pcts = [...new Set(g.entries.map((e) => e.percentage))]
  const types = [...new Set(g.entries.map((e) => e.costType))]
  const catKey = (ids: string[]) => [...ids].sort().join(",")
  const catSets = [...new Set(g.entries.map((e) => catKey(e.categoryIds)))]
  const activityIds = [...new Set(g.entries.map((e) => e.activityId ?? ""))]
  return {
    payrollId: g.payrollId,
    from: months[0]!,
    to: months[months.length - 1]!,
    percentage: pcts.length === 1 ? pcts[0]! : g.entries[0]!.percentage,
    costType: types.length === 1 ? types[0]! : "direct",
    categoryIds: catSets.length === 1 ? g.entries[0]!.categoryIds : [],
    activityId: activityIds.length === 1 ? g.entries[0]!.activityId : null,
    entryIdsByMonth: g.entries.map((e) => ({ entryId: e.entryId, month: e.month })),
  }
}

export function AssignedPayroll({
  projectId,
  projectName,
  groups,
  payrolls,
  categories = [],
  activities = [],
  defaultFrom,
  defaultTo,
}: {
  projectId: string
  projectName: string
  groups: PersonGroup[]
  payrolls: PayrollOption[]
  categories?: { id: string; name: string }[]
  activities?: ActivityRef[]
  defaultFrom?: string | null
  defaultTo?: string | null
}) {
  const [pending, start] = useTransition()
  const [tipus, setTipus] = useState<CostTypeFilter>("all")
  const [categoria, setCategoria] = useState<CategoryFilter>("all")
  const [activitat, setActivitat] = useState<ActivityFilter>("all")
  const [edit, setEdit] = useState<PayrollAssignmentEdit | null>(null)

  const filtered = useMemo(() => {
    return groups
      .map((g) => {
        const entries = g.entries.filter(
          (e) =>
            (tipus === "all" || e.costType === tipus) &&
            matchesCategory(e.categoryIds, categoria) &&
            matchesActivity(e.activityId, activitat)
        )
        if (!entries.length) return null
        return {
          ...g,
          entries,
          total: entries.reduce((s, e) => s + e.imputed, 0),
        }
      })
      .filter((g): g is PersonGroup => g != null)
  }, [groups, tipus, categoria, activitat])

  if (groups.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Cap nòmina assignada.</p>

  const remove = (ids: string[], msg: string) =>
    start(async () => {
      await unassignPayrollEntries(projectId, ids)
      toast.success(msg)
    })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <DownloadXlsxButton
          size="sm"
          filename={projectPayrollFilename(projectName)}
          getSheets={() => buildAssignedPayrollSheets(filtered)}
          disabled={filtered.length === 0}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <CostTypeFilterSelect value={tipus} onChange={setTipus} />
          <CategoryFilterSelect value={categoria} onChange={setCategoria} categories={categories} />
          <ActivityFilterSelect value={activitat} onChange={setActivitat} activities={activities} />
        </div>
      </div>
      <AssignPayrollDialog
        projectId={projectId}
        payrolls={payrolls}
        categories={categories}
        activities={activities}
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
            const catNames = [
              ...new Map(
                g.entries.flatMap((e) => e.categories).map((c) => [c.id, c.name] as const)
              ).values(),
            ]
            const activityNames = [
              ...new Set(g.entries.map((e) => e.activityName).filter(Boolean) as string[]),
            ]
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
                  {activityNames.map((name) => (
                    <Badge key={name} variant="outline" className="font-normal">
                      {name}
                    </Badge>
                  ))}
                  {catNames.map((name) => (
                    <Badge key={name} variant="outline" className="font-normal">
                      {name}
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
                        {activities.length > 0 && <TableHead>Activitat</TableHead>}
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
                              categoryIds: e.categoryIds,
                              activityId: e.activityId,
                              entryIdsByMonth: [{ entryId: e.entryId, month: e.month }],
                            })
                          }
                        >
                          <TableCell className="pl-12">{formatMonth(e.month)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant={e.costType === "indirect" ? "outline" : "secondary"}>
                                {COST_TYPE_LABELS[e.costType]}
                              </Badge>
                              {e.categories.map((c) => (
                                <Badge key={c.id} variant="outline" className="font-normal">
                                  {c.name}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          {activities.length > 0 && (
                            <TableCell>
                              <PayrollActivitySelect
                                projectId={projectId}
                                entryId={e.entryId}
                                activityId={e.activityId}
                                activities={activities}
                              />
                            </TableCell>
                          )}
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
