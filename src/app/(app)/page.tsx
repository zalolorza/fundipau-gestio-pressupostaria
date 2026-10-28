import {
  AlertTriangleIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";

import { BudgetProgress } from "@/components/app/budget-progress";
import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header";
import { InvoiceDialog } from "@/components/invoices/invoice-dialog";
import { PayrollCreateDialog } from "@/components/payroll/payroll-create-dialog";
import { ProjectDialog } from "@/components/projects/project-dialog";
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
import { currentMonth, endOfMonth } from "@/lib/months";
import {
  getClientOptions,
  getDashboard,
  getProjectOptions,
  getSupplierOptions,
} from "@/server/queries";

export default async function HomePage() {
  const month = currentMonth();
  const [d, clientOptions, projects, suppliers] = await Promise.all([
    getDashboard(month),
    getClientOptions(),
    getProjectOptions(),
    getSupplierOptions(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const open = d.projects
    .filter((p) => !p.closedAt || p.closedAt >= today)
    .sort((a, b) => b.progress - a.progress);
  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    hint: p.closedAt && p.closedAt < today ? "tancat" : undefined,
  }));
  const monthInvoicesHref = `/factures?des=${month}&fins=${endOfMonth(month)}`;

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
            href="/projectes"
            action={
              <ProjectDialog clientOptions={clientOptions}>
                <Button variant="default" size="sm">
                  <PlusIcon /> Afegir nou
                </Button>
              </ProjectDialog>
            }
          />
          <Kpi
            label="Pressupost dels projectes oberts"
            value={formatEuro(d.budget)}
            hint={`${formatEuro(d.spent)} ja imputats (${d.budget ? Math.round((d.spent / d.budget) * 100) : 0} %)`}
            href="/projectes"
          />
          <Kpi
            label={`Factures de ${formatMonth(month).toLowerCase()}`}
            value={formatEuro(d.month.invoices.cost)}
            hint={`${d.month.invoices.n} factures rebudes`}
            href={monthInvoicesHref}
            action={
              <InvoiceDialog
                projectOptions={projectOptions}
                suppliers={suppliers}
              >
                <Button variant="default" size="sm">
                  <PlusIcon /> Afegir nova
                </Button>
              </InvoiceDialog>
            }
          />
          <Kpi
            label={`Nòmines de ${formatMonth(month).toLowerCase()}`}
            value={formatEuro(d.month.payroll.cost)}
            hint={`${d.month.payroll.n} persones`}
            href="/nomines?filtre=actives"
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
  href,
  action,
}: {
  label: string;
  value: string;
  hint?: string;
  href: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="group/kpi relative gap-1 pt-4 transition-colors hover:bg-muted">
      <Link href={href} className="absolute inset-0 z-0" aria-label={label} />
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums transition-colors group-hover/kpi:text-primary">
          {value}
        </CardTitle>
        <CardAction>
          <ChevronRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover/kpi:opacity-100" />
        </CardAction>
      </CardHeader>
      {(hint || action) && (
        <CardContent className="relative z-10 flex items-center justify-between gap-2 px-4">
          {hint ? (
            <p className="min-w-0 text-xs text-muted-foreground">{hint}</p>
          ) : (
            <span />
          )}
          {action}
        </CardContent>
      )}
    </Card>
  );
}
