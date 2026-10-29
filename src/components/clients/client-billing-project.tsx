"use client";

import { ChevronRightIcon } from "lucide-react";

import { InteractiveTableRow } from "@/components/app/interactive-table-row";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COST_TYPE_LABELS } from "@/lib/cost-type";
import { formatDate, formatEuro, formatMonth, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClientBillingProject } from "@/server/queries";

export function ClientBillingProjectPanel({
  group,
}: {
  group: ClientBillingProject;
}) {
  const showActivityTab =
    group.hasActivities && group.activityTotals.some((row) => row.id != null);

  return (
    <details className="group rounded-lg border" open={group.total > 0}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 p-3 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="font-medium">{group.project.name}</span>
        <Badge variant="outline">
          {formatPct(group.clientPct)} del projecte
        </Badge>
        <span className="ml-auto flex gap-4 text-sm tabular-nums">
          <span className="text-muted-foreground">
            Factures {formatEuro(group.invoices)}
          </span>
          <span className="text-muted-foreground">
            Nòmines {formatEuro(group.payroll)}
          </span>
          <span className="font-semibold">{formatEuro(group.total)}</span>
        </span>
      </summary>

      {group.lines.length === 0 ? (
        <p className="border-t p-3 text-sm text-muted-foreground">
          Cap cost en aquest període.
        </p>
      ) : (
        <Tabs defaultValue="partida" className="border-t">
          <div className="px-3 pt-2">
            <TabsList>
              <TabsTrigger value="partida">Per partida</TabsTrigger>
              <TabsTrigger value="tipus">Per tipus / categoria</TabsTrigger>
              {showActivityTab && (
                <TabsTrigger value="activitat">Per activitat</TabsTrigger>
              )}
            </TabsList>
          </div>
          <TabsContent value="partida">
            <Table className="border-t">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Data</TableHead>
                  <TableHead>Concepte</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">% projecte</TableHead>
                  <TableHead className="text-right">% client</TableHead>
                  <TableHead className="pr-4 text-right">A facturar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.lines.map((l, i) => (
                  <InteractiveTableRow key={i} href={l.href ?? undefined}>
                    <TableCell className="pl-4 whitespace-nowrap">
                      {l.kind === "nomina"
                        ? formatMonth(l.date, true)
                        : formatDate(l.date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            l.kind === "nomina" ? "secondary" : "outline"
                          }
                        >
                          {l.kind === "nomina" ? "Nòmina" : "Factura"}
                        </Badge>
                        <span>{l.concept}</span>
                      </div>
                      {l.detail && (
                        <p className="text-xs text-muted-foreground">
                          {l.detail}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatEuro(l.cost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPct(l.projectPct)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPct(l.clientPct)}
                    </TableCell>
                    <TableCell className="pr-4 text-right font-medium tabular-nums">
                      {formatEuro(l.amount)}
                    </TableCell>
                  </InteractiveTableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="tipus" className="space-y-0">
            <CostsByCostType costs={group.costs} />
            <CostsByCategory totals={group.categoryTotals} />
          </TabsContent>
          {showActivityTab && (
            <TabsContent value="activitat">
              <CostsByActivity totals={group.activityTotals} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </details>
  );
}

function CostsByCostType({ costs }: { costs: ClientBillingProject["costs"] }) {
  const rows = [
    {
      label: "Factures",
      direct: costs.invoicesDirect,
      indirect: costs.invoicesIndirect,
      total: costs.invoices,
    },
    {
      label: "Nòmines",
      direct: costs.payrollDirect,
      indirect: costs.payrollIndirect,
      total: costs.payroll,
    },
  ] as const;

  return (
    <div>
      <p className="border-b px-4 py-2 text-sm font-medium">Per tipus</p>
      <Table className="border-b">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4 w-[30%]">Origen</TableHead>
            <TableHead className="text-right">
              {COST_TYPE_LABELS.direct}
            </TableHead>
            <TableHead className="text-right">
              {COST_TYPE_LABELS.indirect}
            </TableHead>
            <TableHead className="pr-4 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="pl-4 font-medium">{row.label}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatEuro(row.direct)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatEuro(row.indirect)}
              </TableCell>
              <TableCell className="pr-4 text-right font-medium tabular-nums">
                {formatEuro(row.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="pl-4">Total</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatEuro(costs.direct)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatEuro(costs.indirect)}
            </TableCell>
            <TableCell className="pr-4 text-right tabular-nums">
              {formatEuro(costs.total)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

function CostsByCategory({
  totals,
}: {
  totals: ClientBillingProject["categoryTotals"];
}) {
  if (totals.length === 0) {
    return (
      <div className="mt-4">
        <p className="border-b px-4 py-2 text-sm font-medium">Per categoria</p>
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Cap cost amb categories en aquest període.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <p className="text-sm font-medium">Per categoria</p>
        <p className="text-xs text-muted-foreground">
          La suma pot superar el total a facturar.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Categoria</TableHead>
            <TableHead className="pr-4 text-right">A facturar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {totals.map((row) => (
            <TableRow key={row.id ?? "none"}>
              <TableCell
                className={cn(
                  "pl-4 font-medium",
                  row.id == null && "text-muted-foreground",
                )}
              >
                {row.name}
              </TableCell>
              <TableCell className="pr-4 text-right tabular-nums">
                {formatEuro(row.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CostsByActivity({
  totals,
}: {
  totals: ClientBillingProject["activityTotals"];
}) {
  if (totals.length === 0) {
    return (
      <div>
        <p className="border-b px-4 py-2 text-sm font-medium">Per activitat</p>
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Cap cost amb activitats en aquest període.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="border-b px-4 py-2 text-sm font-medium">Per activitat</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Activitat</TableHead>
            <TableHead className="pr-4 text-right">A facturar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {totals.map((row) => (
            <TableRow key={row.id ?? "none"}>
              <TableCell
                className={cn(
                  "pl-4 font-medium",
                  row.id == null && "text-muted-foreground",
                )}
              >
                {row.name}
              </TableCell>
              <TableCell className="pr-4 text-right tabular-nums">
                {formatEuro(row.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
