"use client";

import { PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmButton } from "@/components/app/confirm-button";
import { InteractiveTableRow } from "@/components/app/interactive-table-row";
import { AmountChangeDialog } from "@/components/payroll/amount-change-dialog";
import { BulkEditEntriesDialog } from "@/components/payroll/bulk-edit-entries-dialog";
import { EntryAllocationDialog } from "@/components/payroll/entry-allocation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEuro, formatMonth, round2 } from "@/lib/format";
import { cn } from "@/lib/utils";
import { bulkDeletePayrollEntries, deletePayrollEntry } from "@/server/actions";

type Entry = {
  id: string;
  month: string;
  amount: number;
  assigned: number;
  allocations: {
    projectId: string;
    name: string;
    percentage: number;
    costType: "direct" | "indirect";
    activityId?: string | null;
    categoryIds?: string[];
    categories?: { id: string; name: string }[];
  }[];
};

export function EntriesTable({
  payrollId,
  entries,
  projectOptions,
  activitiesByProject = {},
  categories = [],
  current,
  className,
}: {
  payrollId: string;
  entries: Entry[];
  projectOptions: { id: string; name: string; hint?: string }[];
  activitiesByProject?: Record<string, { id: string; name: string }[]>;
  categories?: { id: string; name: string }[];
  current: string;
  className?: string;
}) {
  const [allocOpenId, setAllocOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [editOpen, setEditOpen] = useState(false);

  const ids = useMemo(() => entries.map((e) => e.id), [entries]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = ids.some((id) => selected.has(id));
  const selectedIds = useMemo(
    () => ids.filter((id) => selected.has(id)),
    [ids, selected],
  );
  const count = selectedIds.length;

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(ids) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  return (
    <>
      <div className="space-y-3">
        {count > 0 && (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-sm">
            <span className="text-sm font-medium">
              {count} {count === 1 ? "mes seleccionat" : "mesos seleccionats"}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={() => setEditOpen(true)}>
                <PencilIcon />
                Edita
              </Button>
              <ConfirmButton
                title={`Eliminar ${count} ${count === 1 ? "mes" : "mesos"}?`}
                description="S'eliminaran els registres mensuals seleccionats i les seves assignacions a projectes."
                onConfirm={async () => {
                  const res = await bulkDeletePayrollEntries(
                    payrollId,
                    selectedIds,
                  );
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(
                    count === 1
                      ? "Mes eliminat"
                      : `${count} mesos eliminats`,
                  );
                  clearSelection();
                }}
              >
                <Button type="button" size="sm" variant="destructive">
                  <Trash2Icon />
                  Elimina
                </Button>
              </ConfirmButton>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                aria-label="Desselecciona"
              >
                <XIcon />
              </Button>
            </div>
          </div>
        )}

        <Table className={className}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">
                <Checkbox
                  aria-label="Selecciona tots"
                  checked={
                    allSelected ? true : someSelected ? "indeterminate" : false
                  }
                  onCheckedChange={(v) => toggleAll(v === true)}
                  disabled={entries.length === 0}
                />
              </TableHead>
              <TableHead>Mes</TableHead>
              <TableHead className="text-right">Quantitat</TableHead>
              <TableHead>Projectes</TableHead>
              <TableHead className="text-right">Imputat</TableHead>
              <TableHead className="w-24 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => {
              const isCurrent = e.month === current;
              const isSelected = selected.has(e.id);
              return (
                <InteractiveTableRow
                  key={e.id}
                  data-state={isSelected ? "selected" : undefined}
                  className={cn(
                    isCurrent && "bg-primary/5",
                    e.month > current && "text-muted-foreground",
                  )}
                  onActivate={() => setAllocOpenId(e.id)}
                >
                  <TableCell className="pl-4">
                    <Checkbox
                      aria-label={`Selecciona ${formatMonth(e.month)}`}
                      checked={isSelected}
                      onCheckedChange={(v) => toggleOne(e.id, v === true)}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatMonth(e.month)}
                    {isCurrent && (
                      <Badge className="ml-2" variant="default">
                        Actual
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <AmountChangeDialog
                      payrollId={payrollId}
                      referenceMonth={e.month}
                      currentAmount={e.amount}
                    >
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
                      allocations={e.allocations.map((a) => ({
                        id: a.projectId,
                        percentage: a.percentage,
                        costType: a.costType,
                        categoryIds: a.categoryIds ?? [],
                        activityId: a.activityId ?? null,
                      }))}
                      projectOptions={projectOptions}
                      activitiesByProject={activitiesByProject}
                      categories={categories}
                      open={allocOpenId === e.id}
                      onOpenChange={(o) => setAllocOpenId(o ? e.id : null)}
                    >
                      <Button
                        variant="ghost"
                        className="h-auto flex-wrap justify-start gap-1 p-1 font-normal"
                      >
                        {e.allocations.map((a) => {
                          const activityName = a.activityId
                            ? activitiesByProject[a.projectId]?.find((x) => x.id === a.activityId)
                                ?.name
                            : null
                          return (
                            <Badge key={a.projectId} variant="secondary">
                              {a.name} · {a.percentage} %
                              {a.costType === "indirect" ? " · ind." : ""}
                              {activityName ? ` · ${activityName}` : ""}
                              {a.categories?.length
                                ? ` · ${a.categories.map((c) => c.name).join(", ")}`
                                : ""}
                            </Badge>
                          )
                        })}
                        {e.assigned < 100 && (
                          <Badge variant="outline" className="border-dashed">
                            {round2(100 - e.assigned)} % lliure
                          </Badge>
                        )}
                      </Button>
                    </EntryAllocationDialog>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatEuro((e.amount * e.assigned) / 100)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end" data-row-ignore>
                      <ConfirmButton
                        title={`Eliminar ${formatMonth(e.month)}?`}
                        description="S'eliminarà aquest registre mensual i les seves assignacions."
                        onConfirm={async () => {
                          await deletePayrollEntry(payrollId, e.id);
                          toast.success("Mes eliminat");
                          setSelected((prev) => {
                            if (!prev.has(e.id)) return prev;
                            const next = new Set(prev);
                            next.delete(e.id);
                            return next;
                          });
                        }}
                      >
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Elimina el mes"
                          className="text-muted-foreground"
                        >
                          <Trash2Icon />
                        </Button>
                      </ConfirmButton>
                    </div>
                  </TableCell>
                </InteractiveTableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <BulkEditEntriesDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        payrollId={payrollId}
        entryIds={selectedIds}
        projectOptions={projectOptions}
        activitiesByProject={activitiesByProject}
        categories={categories}
        onDone={clearSelection}
      />
    </>
  );
}
