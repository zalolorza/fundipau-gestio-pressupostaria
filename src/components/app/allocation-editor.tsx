"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import {
  CategoryPicker,
  type CategoryRef,
} from "@/components/categories/category-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { COST_TYPE_LABELS, type CostType } from "@/lib/cost-type";
import { round2 } from "@/lib/format";
import { cn } from "@/lib/utils";

export type AllocationRow = {
  id: string;
  percentage: number;
  costType?: CostType;
  categoryIds?: string[];
  /** Activitat del projecte (només assignacions de factura). */
  activityId?: string | null;
};
export type AllocationOption = {
  id: string;
  name: string;
  hint?: string;
  disabled?: boolean;
};
export type AllocationActivityOption = { id: string; name: string };

const ACTIVITY_NONE = "__none__";

export function allocationSum(rows: AllocationRow[]) {
  return round2(rows.reduce((s, r) => s + (Number(r.percentage) || 0), 0));
}

export function allocationError(
  rows: AllocationRow[],
  mode: "exact" | "max",
): string | null {
  if (rows.some((r) => !r.id)) return "Tria un element a cada fila";
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    return "Hi ha elements repetits";
  if (rows.some((r) => !(Number(r.percentage) > 0)))
    return "Tots els percentatges han de ser més grans que 0";
  const sum = allocationSum(rows);
  if (mode === "exact" && rows.length > 0 && sum !== 100)
    return `Ha de sumar 100 % (ara ${sum} %)`;
  if (sum > 100) return `No pot superar el 100 % (ara ${sum} %)`;
  return null;
}

export function AllocationEditor({
  value,
  onChange,
  options,
  mode,
  itemLabel,
  emptyText,
  withCostType = false,
  categories,
  onCatalogChange,
  activitiesByProject,
  /** Base (€) per mostrar i editar l'import a partir del %. Si hi és, ambdós inputs es sincronitzen. */
  amountBase,
}: {
  value: AllocationRow[];
  onChange: (rows: AllocationRow[]) => void;
  options: AllocationOption[];
  mode: "exact" | "max";
  itemLabel: string;
  emptyText?: string;
  /** Mostra el selector directe/indirecte per fila (assignacions de nòmina). */
  withCostType?: boolean;
  /** Catàleg de categories; si hi és, mostra el picker per fila (nòmines). */
  categories?: CategoryRef[];
  onCatalogChange?: (next: CategoryRef[]) => void;
  /** Activitats per projecte; si hi és, mostra el selector d'activitat (factures). */
  activitiesByProject?: Record<string, AllocationActivityOption[]>;
  amountBase?: number;
}) {
  const withCategories = !!categories;
  const withActivities = !!activitiesByProject;
  const withAmount =
    amountBase != null && Number.isFinite(amountBase) && amountBase > 0;
  const sum = allocationSum(value);
  const error = allocationError(value, mode);
  const used = new Set(value.map((r) => r.id));
  /** Draft of the field being edited so typing/spinners stay smooth while the other updates. */
  const [edit, setEdit] = useState<{
    i: number;
    field: "pct" | "amount";
    value: string;
  } | null>(null);

  const update = (i: number, patch: Partial<AllocationRow>) =>
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const amountOf = (percentage: number) =>
    withAmount ? round2(((Number(percentage) || 0) * amountBase!) / 100) : 0;

  /** Màxim % per a la fila sense superar el 100 % total. */
  const maxPercentageFor = (i: number) => {
    const others = value.reduce(
      (s, r, idx) =>
        s +
        (idx === i || !Number.isFinite(r.percentage) ? 0 : Number(r.percentage)),
      0,
    );
    return round2(Math.max(0, 100 - others));
  };

  /** Pas d'€ equivalent a 0,01 % perquè el spinner i el round-trip %↔€ coincideixin. */
  const amountStep = withAmount
    ? Math.max(0.01, round2(amountBase! / 10000))
    : 0.01;

  const commitPercentage = (i: number, percentage: number, maxPct: number) => {
    update(i, {
      percentage: Number.isNaN(percentage)
        ? Number.NaN
        : round2(Math.min(maxPct, percentage)),
    });
  };

  const commitAmount = (i: number, amount: number, maxPct: number) => {
    if (!withAmount) return;
    if (Number.isNaN(amount)) {
      update(i, { percentage: Number.NaN });
      return;
    }
    const maxAmount = round2((maxPct * amountBase!) / 100);
    const capped = Math.min(maxAmount, amount);
    commitPercentage(i, (capped / amountBase!) * 100, maxPct);
  };

  const distribute = () => {
    if (!value.length) return;
    const each = Math.floor((100 / value.length) * 100) / 100;
    const rows = value.map((r) => ({ ...r, percentage: each }));
    rows[rows.length - 1].percentage = round2(100 - each * (rows.length - 1));
    onChange(rows);
  };

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
          {emptyText ?? "Sense assignar"}
        </p>
      )}
      {value.map((row, i) => {
        const projectActivities = row.id
          ? (activitiesByProject?.[row.id] ?? [])
          : [];
        const dense =
          withCostType || withCategories || withActivities || withAmount;
        const amount = amountOf(row.percentage);
        const maxPct = maxPercentageFor(i);
        const maxAmount = withAmount
          ? round2((maxPct * amountBase!) / 100)
          : 0;
        return (
          <div key={i}>
            {i > 0 && (
              <Separator
                className={cn("mb-2", dense ? "lg:hidden" : "sm:hidden")}
              />
            )}
            <div
              className={cn(
                "flex flex-wrap items-center gap-2",
                dense && "lg:flex-nowrap",
              )}
            >
              <Select
                value={row.id}
                onValueChange={(id) =>
                  update(i, {
                    id,
                    ...(withActivities ? { activityId: null } : {}),
                  })
                }
              >
                <SelectTrigger className="min-w-0 flex-1 basis-40 lg:basis-auto lg:min-w-48">
                  <SelectValue placeholder={`Tria ${itemLabel}…`} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem
                      key={o.id}
                      value={o.id}
                      disabled={
                        o.disabled || (used.has(o.id) && o.id !== row.id)
                      }
                    >
                      {o.name}
                      {o.hint && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {o.hint}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {withActivities && (
                <Select
                  value={row.activityId ?? ACTIVITY_NONE}
                  onValueChange={(v) =>
                    update(i, { activityId: v === ACTIVITY_NONE ? null : v })
                  }
                  disabled={!row.id || projectActivities.length === 0}
                >
                  <SelectTrigger
                    className="w-full sm:w-44 shrink-0"
                    aria-label="Activitat"
                  >
                    <SelectValue placeholder="Sense activitat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ACTIVITY_NONE}>
                      Sense activitat
                    </SelectItem>
                    {projectActivities.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {withCostType && (
                <Select
                  value={row.costType ?? "direct"}
                  onValueChange={(v) => update(i, { costType: v as CostType })}
                >
                  <SelectTrigger
                    className="w-full sm:w-32 shrink-0"
                    aria-label="Tipus de cost"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">
                      {COST_TYPE_LABELS.direct}
                    </SelectItem>
                    <SelectItem value="indirect">
                      {COST_TYPE_LABELS.indirect}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
              {withCategories && (
                <CategoryPicker
                  className="min-w-0 w-full sm:w-44 shrink-0"
                  compact
                  categories={categories!}
                  value={row.categoryIds ?? []}
                  onChange={(categoryIds) => update(i, { categoryIds })}
                  onCatalogChange={onCatalogChange}
                />
              )}
              <div className="relative w-24 shrink-0">
                <Input
                  type="number"
                  inputMode="decimal"
                  max={maxPct}
                  step="0.01"
                  value={
                    edit?.i === i && edit.field === "pct"
                      ? edit.value
                      : Number.isNaN(row.percentage)
                        ? ""
                        : row.percentage
                  }
                  onFocus={() =>
                    setEdit({
                      i,
                      field: "pct",
                      value: Number.isNaN(row.percentage)
                        ? ""
                        : String(row.percentage),
                    })
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    const n = e.target.valueAsNumber;
                    const capped =
                      !Number.isNaN(n) && n > maxPct ? maxPct : n;
                    setEdit({
                      i,
                      field: "pct",
                      value: Number.isNaN(capped) ? raw : String(capped),
                    });
                    commitPercentage(i, capped, maxPct);
                  }}
                  onBlur={() => setEdit(null)}
                  className="pr-6 text-right"
                  aria-label="Percentatge"
                />
                <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
              {withAmount && (
                <div className="relative w-32 shrink-0">
                  <Input
                    type="number"
                    inputMode="decimal"
                    max={maxAmount}
                    step={amountStep}
                    value={
                      edit?.i === i && edit.field === "amount"
                        ? edit.value
                        : Number.isNaN(row.percentage)
                          ? ""
                          : amount
                    }
                    onFocus={() =>
                      setEdit({
                        i,
                        field: "amount",
                        value: Number.isNaN(row.percentage)
                          ? ""
                          : String(amount),
                      })
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      const n = e.target.valueAsNumber;
                      const capped =
                        !Number.isNaN(n) && n > maxAmount ? maxAmount : n;
                      setEdit({
                        i,
                        field: "amount",
                        value: Number.isNaN(capped) ? raw : String(capped),
                      });
                      commitAmount(i, capped, maxPct);
                    }}
                    onBlur={() => setEdit(null)}
                    className="pr-6 text-right"
                    aria-label="Import"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
                    €
                  </span>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                aria-label="Elimina"
              >
                <Trash2Icon />
              </Button>
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange([
                ...value,
                {
                  id: "",
                  percentage: Math.max(
                    0,
                    round2((mode === "exact" ? 100 : 100) - sum),
                  ),
                  ...(withCostType ? { costType: "direct" as const } : {}),
                  ...(withCategories ? { categoryIds: [] } : {}),
                  ...(withActivities ? { activityId: null } : {}),
                },
              ])
            }
            disabled={value.length >= options.length}
          >
            <PlusIcon /> Afegeix {itemLabel}
          </Button>
          {value.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={distribute}
            >
              Reparteix a parts iguals
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : (
            mode === "max" &&
            sum < 100 && (
              <span className="text-muted-foreground">
                {round2(100 - sum)} % sense assignar
              </span>
            )
          )}
          <Badge variant={error ? "destructive" : "secondary"}>
            Total {sum} %
          </Badge>
        </div>
      </div>
    </div>
  );
}
