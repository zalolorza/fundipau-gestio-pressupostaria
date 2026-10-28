import { AlertTriangleIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { BudgetProgress } from "@/components/app/budget-progress";
import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatEuro, formatMonth } from "@/lib/format";
import { currentMonth } from "@/lib/months";
import { getDashboard } from "@/server/queries";

export default async function HomePage() {
  const month = currentMonth();
  const d = await getDashboard(month);
  const today = new Date().toISOString().slice(0, 10);
  const open = d.projects
    .filter((p) => !p.closedAt || p.closedAt >= today)
    .sort((a, b) => b.progress - a.progress);

  return (
    <>
      <PageHeader crumbs={[{ label: "Inici" }]} />
      <PageBody>
        <PageTitle
          title="Inici"
          description={`Resum a ${formatMonth(month).toLowerCase()}`}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Projectes oberts"
            value={String(d.openCount)}
            hint={`${d.clientCount} clients finançadors`}
          />
          <Kpi
            label="Pressupost dels projectes oberts"
            value={formatEuro(d.budget)}
            hint={`${formatEuro(d.spent)} ja imputats (${d.budget ? Math.round((d.spent / d.budget) * 100) : 0} %)`}
          />
          <Kpi
            label={`Factures de ${formatMonth(month).toLowerCase()}`}
            value={formatEuro(d.month.invoices.cost)}
            hint={`${d.month.invoices.n} factures rebudes`}
          />
          <Kpi
            label={`Nòmines de ${formatMonth(month).toLowerCase()}`}
            value={formatEuro(d.month.payroll.cost)}
            hint={`${d.month.payroll.n} persones`}
          />
        </div>

        {(d.unassigned.invoices.cost > 0 || d.unassigned.payroll.cost > 0) && (
          <Card className="bg-muted">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="size-4 text-amber-600" />
                <CardTitle>Costos pendents d&apos;assignar</CardTitle>
              </div>
              <CardDescription>
                Imports que encara no s&apos;han imputat a cap projecte i, per
                tant, no es poden facturar.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6 text-sm">
              <Link href="/factures?assignacio=parcial" className="group">
                <p className="text-muted-foreground">
                  Factures ({d.unassigned.invoices.n})
                </p>
                <p className="text-lg font-semibold tabular-nums group-hover:text-primary">
                  {formatEuro(d.unassigned.invoices.cost)}
                </p>
              </Link>
              <Link href="/nomines?filtre=pendents" className="group">
                <p className="text-muted-foreground">
                  Nòmines fins avui ({d.unassigned.payroll.n} mesos)
                </p>
                <p className="text-lg font-semibold tabular-nums group-hover:text-primary">
                  {formatEuro(d.unassigned.payroll.cost)}
                </p>
              </Link>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Execució pressupostària</CardTitle>
            <CardDescription>
              Projectes oberts, ordenats per percentatge consumit.
            </CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/projectes">
                  Tots els projectes <ArrowRightIcon />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5">
            {open.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hi ha projectes oberts.
              </p>
            )}
            {open.map((p) => (
              <div key={p.id} className="space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <Link
                    href={`/projectes/${p.id}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="text-muted-foreground tabular-nums">
                    {formatEuro(p.costs.total)} / {formatEuro(p.maxBudget)} ·{" "}
                    <span className="font-medium text-foreground">
                      {Math.round(p.progress)} %
                    </span>
                  </span>
                </div>
                <BudgetProgress value={p.progress} />
              </div>
            ))}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && (
        <CardContent className="px-4 text-xs text-muted-foreground">
          {hint}
        </CardContent>
      )}
    </Card>
  );
}
