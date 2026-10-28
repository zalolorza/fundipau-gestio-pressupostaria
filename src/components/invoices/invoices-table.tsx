"use client"

import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, DownloadIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmButton } from "@/components/app/confirm-button"
import { InteractiveTableRow } from "@/components/app/interactive-table-row"
import { BulkEditInvoicesDialog } from "@/components/invoices/bulk-edit-invoices-dialog"
import { useInvoiceListNav } from "@/components/invoices/invoice-list-nav"
import { InvoiceRowActions } from "@/components/invoices/invoice-row-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatDate, formatEuro, round2 } from "@/lib/format"
import { invoiceFileHref } from "@/lib/invoice-file"
import { bulkDeleteInvoices } from "@/server/actions"
import type { InvoiceListItem, InvoiceSortKey, SupplierOption } from "@/server/queries"

function SortableHead({
  label,
  sortKey,
  align = "left",
}: {
  label: string
  sortKey: InvoiceSortKey
  align?: "left" | "right"
}) {
  const params = useSearchParams()
  const { replaceParams } = useInvoiceListNav()
  const active = (params.get("ordre") ?? "data") === sortKey
  const dir = params.get("dir") === "asc" ? "asc" : "desc"

  function toggle() {
    replaceParams((sp) => {
      if (active) {
        sp.set("ordre", sortKey)
        sp.set("dir", dir === "desc" ? "asc" : "desc")
      } else {
        sp.set("ordre", sortKey)
        sp.set("dir", "desc")
      }
    })
  }

  const Icon = !active ? ChevronsUpDownIcon : dir === "asc" ? ArrowUpIcon : ArrowDownIcon

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "inline-flex items-center gap-1 font-medium hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon className="size-3.5 opacity-70" />
      </button>
    </TableHead>
  )
}

export function InvoicesTable({
  invoices,
  projectOptions,
  suppliers,
}: {
  invoices: InvoiceListItem[]
  projectOptions: { id: string; name: string; hint?: string }[]
  suppliers: SupplierOption[]
}) {
  const { pending } = useInvoiceListNav()
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [editOpen, setEditOpen] = useState(false)
  const [rowEditId, setRowEditId] = useState<string | null>(null)

  const ids = useMemo(() => invoices.map((i) => i.id), [invoices])
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))
  const someSelected = ids.some((id) => selected.has(id))
  const selectedIds = useMemo(() => ids.filter((id) => selected.has(id)), [ids, selected])
  const count = selectedIds.length

  const sum = (k: "baseAmount" | "vatAmount" | "irpfAmount" | "total" | "assignedTotal") =>
    round2(invoices.reduce((s, i) => s + i[k], 0))

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(ids) : new Set())
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  return (
    <>
      <div className="space-y-3">
        {count > 0 && (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-sm">
            <span className="text-sm font-medium">
              {count} {count === 1 ? "factura seleccionada" : "factures seleccionades"}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={() => setEditOpen(true)}>
                <PencilIcon />
                Edita
              </Button>
              <ConfirmButton
                title={`Eliminar ${count} ${count === 1 ? "factura" : "factures"}?`}
                description="També se n'eliminaran les assignacions a projectes i els arxius adjunts."
                onConfirm={async () => {
                  const res = await bulkDeleteInvoices(selectedIds)
                  if (!res.ok) return void toast.error(res.error)
                  toast.success(count === 1 ? "Factura eliminada" : `${count} factures eliminades`)
                  clearSelection()
                }}
              >
                <Button type="button" size="sm" variant="destructive">
                  <Trash2Icon />
                  Elimina
                </Button>
              </ConfirmButton>
              <Button type="button" size="sm" variant="ghost" onClick={clearSelection} aria-label="Desselecciona">
                <XIcon />
              </Button>
            </div>
          </div>
        )}

        <Card className="relative py-0">
          {pending && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
              <Spinner className="size-6 text-primary" />
            </div>
          )}
          <Table className={pending ? "pointer-events-none opacity-60" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="Selecciona totes"
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    disabled={invoices.length === 0}
                  />
                </TableHead>
                <SortableHead label="Data" sortKey="data" />
                <TableHead>Número</TableHead>
                <TableHead>Proveïdor</TableHead>
                <TableHead>Descripció</TableHead>
                <SortableHead label="Base" sortKey="base" align="right" />
                <SortableHead label="IVA" sortKey="iva" align="right" />
                <SortableHead label="IRPF" sortKey="irpf" align="right" />
                <SortableHead label="Total" sortKey="total" align="right" />
                <SortableHead label="Total assignat" sortKey="assignat" align="right" />
                <TableHead>Projectes</TableHead>
                <TableHead className="w-20 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="py-10 text-center text-muted-foreground">
                    No s&apos;ha trobat cap factura.
                  </TableCell>
                </TableRow>
              )}
              {invoices.map((inv) => {
                const { projects: _p, supplier: _s, allocations, assigned, assignedTotal, cost: _c, ...row } = inv
                const isSelected = selected.has(inv.id)
                return (
                  <InteractiveTableRow
                    key={inv.id}
                    data-state={isSelected ? "selected" : undefined}
                    onActivate={() => setRowEditId(inv.id)}
                  >
                    <TableCell className="pl-4">
                      <Checkbox
                        aria-label={`Selecciona ${inv.number}`}
                        checked={isSelected}
                        onCheckedChange={(v) => toggleOne(inv.id, v === true)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(inv.issueDate)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        {inv.number}
                        {inv.filePathname ? (
                          <a
                            href={invoiceFileHref(inv.filePathname)}
                            target="_blank"
                            rel="noreferrer"
                            title={inv.fileName ?? "Arxiu"}
                            download={inv.fileName ?? undefined}
                            className="text-muted-foreground hover:text-primary"
                            aria-label={`Descarrega l'arxiu de ${inv.number}`}
                          >
                            <DownloadIcon className="size-3.5" />
                          </a>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {inv.supplier ? (
                          <Link href={`/proveidors/${inv.supplier.id}`} className="hover:text-primary hover:underline">
                            {inv.supplierName}
                          </Link>
                        ) : (
                          <>
                            {inv.supplierName}{" "}
                            <Badge variant="outline" className="ml-1 border-dashed font-normal">
                              no enllaçat
                            </Badge>
                          </>
                        )}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{inv.supplierTaxId}</div>
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">{inv.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEuro(inv.baseAmount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatEuro(inv.vatAmount)}
                      <div className="text-xs">{inv.vatRate} %</div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {inv.irpfAmount ? `−${formatEuro(inv.irpfAmount)}` : "—"}
                      {inv.irpfRate > 0 && <div className="text-xs">{inv.irpfRate} %</div>}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatEuro(inv.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatEuro(assignedTotal)}
                      <div className="text-xs text-muted-foreground">{assigned} %</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-60 flex-wrap gap-1">
                        {allocations.map((a) => (
                          <Badge key={a.projectId} variant="secondary" className="max-w-56">
                            <span className="truncate">{a.name}</span> · {a.percentage} %
                          </Badge>
                        ))}
                        {assigned < 100 && (
                          <Badge variant="destructive">{round2(100 - assigned)} % sense assignar</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pr-4">
                      <InvoiceRowActions
                        invoice={row}
                        allocations={allocations.map((a) => ({ id: a.projectId, percentage: a.percentage }))}
                        projectOptions={projectOptions}
                        suppliers={suppliers}
                        open={rowEditId === inv.id}
                        onOpenChange={(o) => setRowEditId(o ? inv.id : null)}
                      />
                    </TableCell>
                  </InteractiveTableRow>
                )
              })}
            </TableBody>
            {invoices.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-4" colSpan={5}>
                    {invoices.length} factures
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(sum("baseAmount"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(sum("vatAmount"))}</TableCell>
                  <TableCell className="text-right tabular-nums">−{formatEuro(sum("irpfAmount"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(sum("total"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(sum("assignedTotal"))}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </Card>
      </div>

      <BulkEditInvoicesDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        invoiceIds={selectedIds}
        projectOptions={projectOptions}
        suppliers={suppliers}
        onDone={clearSelection}
      />
    </>
  )
}
