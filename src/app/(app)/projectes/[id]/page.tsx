import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BudgetProgress } from "@/components/app/budget-progress";
import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header";
import { AssignPayrollDialog } from "@/components/projects/assign-payroll-dialog";
import { ProjectInvoiceMenu } from "@/components/projects/project-invoice-menu";
import {
  AssignedInvoices,
  AssignedPayroll,
} from "@/components/projects/assigned-resources";
import { ProjectActions } from "@/components/projects/project-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDefaultVatDeductibleRate } from "@/lib/app-settings";
import { COST_TYPE_LABELS } from "@/lib/cost-type";
import { formatDate, formatEuro, formatPct, round2 } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getAssignableInvoices,
  getClientOptions,
  getPayrollOptions,
  getProject,
  getProjectOptions,
  getSupplierOptions,
} from "@/server/queries";

export async function generateMetadata({
  params,
}: PageProps<"/projectes/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Projecte" };
  const p = await getProject(id);
  return { title: p?.name ?? "Projecte" };
}

export default async function ProjectPage({
  params,
}: PageProps<"/projectes/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [
    project,
    clientOptions,
    invoices,
    payrolls,
    projects,
    suppliers,
    defaultVatDeductibleRate,
  ] = await Promise.all([
    getProject(id),
    getClientOptions(),
    getAssignableInvoices(),
    getPayrollOptions(),
    getProjectOptions(),
    getSupplierOptions(),
    getDefaultVatDeductibleRate(),
  ]);
  if (!project) notFound();

  const remaining = round2(project.maxBudget - project.costs.total);
  const budgetSplit =
    project.directBudget != null && project.indirectBudget != null
      ? {
          direct: project.directBudget,
          indirect: project.indirectBudget,
        }
      : null;
  const clientRows = project.clients.map((c) => ({
    id: c.id,
    percentage: c.percentage,
  }));
  const current = Object.fromEntries(
    project.invoices.map((i) => [i.id, i.percentage]),
  );
  const {
    clients: _c,
    invoices: _i,
    payroll: _p,
    costs: _co,
    progress: _pr,
    progressBreakdown: _pb,
    ...projectRow
  } = project;
  const today = new Date().toISOString().slice(0, 10);
  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    hint: p.closedAt && p.closedAt < today ? "tancat" : undefined,
  }));

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Projectes", href: "/projectes" },
          { label: project.name },
        ]}
      />
      <PageBody>
        <PageTitle
          title={project.name}
          description={
            <>
              {formatDate(project.openedAt)} –{" "}
              {project.closedAt ? formatDate(project.closedAt) : "obert"}
              {project.description && (
                <span className="mt-1 block max-w-3xl">
                  {project.description}
                </span>
              )}
            </>
          }
        >
          <ProjectActions
            project={projectRow}
            clients={clientRows}
            clientOptions={clientOptions}
          />
        </PageTitle>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Progrés del pressupost</CardTitle>
              <CardDescription>
                Costos imputats (factures + nòmines) respecte al pressupost
                màxim
                {budgetSplit ? ", desglossat en directe i indirecte" : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-3xl font-semibold tabular-nums">
                    {formatEuro(project.costs.total)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    de {formatEuro(project.maxBudget)}
                  </p>
                </div>
                <p
                  className={cn(
                    "text-2xl font-semibold tabular-nums",
                    project.progress > 100
                      ? "text-destructive"
                      : "text-primary",
                  )}
                >
                  {formatPct(round2(project.progress))}
                </p>
              </div>
              <BudgetProgress value={project.progress} className="h-3" />
              {budgetSplit && project.progressBreakdown && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <BudgetPart
                    label={COST_TYPE_LABELS.direct}
                    spent={project.costs.direct}
                    budget={budgetSplit.direct}
                    progress={project.progressBreakdown.direct}
                  />
                  <BudgetPart
                    label={COST_TYPE_LABELS.indirect}
                    spent={project.costs.indirect}
                    budget={budgetSplit.indirect}
                    progress={project.progressBreakdown.indirect}
                  />
                </div>
              )}
              <dl
                className={cn(
                  "grid gap-4 text-sm",
                  budgetSplit
                    ? "grid-cols-2 sm:grid-cols-4"
                    : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
                )}
              >
                <Stat
                  label="Factures"
                  value={formatEuro(project.costs.invoices)}
                />
                <Stat
                  label="Nòmines"
                  value={formatEuro(project.costs.payroll)}
                />
                {!budgetSplit && (
                  <>
                    <Stat
                      label="Directes"
                      value={formatEuro(project.costs.direct)}
                    />
                    <Stat
                      label="Indirectes"
                      value={formatEuro(project.costs.indirect)}
                    />
                  </>
                )}
                <Stat
                  label={remaining >= 0 ? "Disponible" : "Excés"}
                  value={formatEuro(Math.abs(remaining))}
                  className={remaining < 0 ? "text-destructive" : undefined}
                />
                <Stat
                  label="Pressupost"
                  value={formatEuro(project.maxBudget)}
                />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clients</CardTitle>
              <CardDescription>Repartiment del finançament</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.clients.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Encara no hi ha cap client assignat.
                </p>
              )}
              {project.clients.map((c) => (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <Link
                      href={`/clients/${c.id}`}
                      className="truncate hover:text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                    <Badge variant="secondary">{formatPct(c.percentage)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatEuro((project.costs.total * c.percentage) / 100)}{" "}
                    imputats
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="pb-0">
          <Tabs defaultValue="factures" className="gap-0">
            <CardHeader className="border-b pb-4">
              <CardTitle>Recursos assignats</CardTitle>
              <CardDescription>
                Factures i nòmines imputades a aquest projecte.
              </CardDescription>
              <CardAction className="flex flex-wrap gap-2">
                <ProjectInvoiceMenu
                  projectId={project.id}
                  invoices={invoices}
                  current={current}
                  projectOptions={projectOptions}
                  suppliers={suppliers}
                  defaultVatDeductibleRate={defaultVatDeductibleRate}
                />
                <AssignPayrollDialog
                  projectId={project.id}
                  payrolls={payrolls}
                  defaultFrom={project.openedAt}
                  defaultTo={project.closedAt}
                >
                  <Button size="sm">
                    <PlusIcon /> Nòmina
                  </Button>
                </AssignPayrollDialog>
              </CardAction>
              <TabsList className="mt-3">
                <TabsTrigger value="factures">
                  Factures{" "}
                  <Badge variant="secondary">{project.invoices.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="nomines">
                  Nòmines{" "}
                  <Badge variant="secondary">{project.payroll.length}</Badge>
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <TabsContent value="factures">
              <AssignedInvoices
                projectId={project.id}
                invoices={project.invoices}
                projectOptions={projectOptions}
                suppliers={suppliers}
              />
            </TabsContent>
            <TabsContent value="nomines">
              <AssignedPayroll
                projectId={project.id}
                groups={project.payroll}
                payrolls={payrolls}
                defaultFrom={project.openedAt}
                defaultTo={project.closedAt}
              />
            </TabsContent>
          </Tabs>
        </Card>
      </PageBody>
    </>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium tabular-nums", className)}>{value}</dd>
    </div>
  );
}

function BudgetPart({
  label,
  spent,
  budget,
  progress,
}: {
  label: string;
  spent: number;
  budget: number;
  progress: number;
}) {
  return (
    <div className="min-w-0 space-y-2 rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "tabular-nums",
            progress > 100 ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {formatPct(round2(progress))}
        </span>
      </div>
      <BudgetProgress value={progress} className="h-2" />
      <p className="text-sm tabular-nums">
        {formatEuro(spent)}
        <span className="text-muted-foreground"> / {formatEuro(budget)}</span>
      </p>
    </div>
  );
}
