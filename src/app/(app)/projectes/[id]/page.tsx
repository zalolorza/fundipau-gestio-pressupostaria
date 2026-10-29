import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BudgetProgress } from "@/components/app/budget-progress";
import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header";
import { AssignPayrollDialog } from "@/components/projects/assign-payroll-dialog";
import {
  AssignedInvoices,
  AssignedPayroll,
} from "@/components/projects/assigned-resources";
import { ProjectActions } from "@/components/projects/project-actions";
import { ProjectActivities } from "@/components/projects/project-activities";
import { ProjectInvoiceMenu } from "@/components/projects/project-invoice-menu";
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
import { getDefaultVatDeductibleRate } from "@/lib/app-settings";
import { COST_TYPE_LABELS } from "@/lib/cost-type";
import { formatDate, formatEuro, formatPct, round2 } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  activitiesByProjectMap,
  getAssignableInvoices,
  getClientOptions,
  getPayrollOptions,
  getProject,
  getProjectOptions,
  getSupplierOptions,
  listCategories,
  listProjectActivities,
  type CategoryTotal,
  type ProjectCosts,
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
    categories,
    allActivities,
    defaultVatDeductibleRate,
  ] = await Promise.all([
    getProject(id),
    getClientOptions(),
    getAssignableInvoices(),
    getPayrollOptions(),
    getProjectOptions(),
    getSupplierOptions(),
    listCategories(),
    listProjectActivities(),
    getDefaultVatDeductibleRate(),
  ]);
  if (!project) notFound();

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
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));
  const activityOptions = project.activities.map((a) => ({
    id: a.id,
    name: a.name,
  }));
  const activitiesWithBudget = project.activities.map((a) => ({
    id: a.id,
    name: a.name,
    budget: a.budget,
    spent: a.spent,
    progress: a.progress,
  }));
  const activitiesByProject = activitiesByProjectMap(allActivities);
  const {
    clients: _c,
    invoices: _i,
    payroll: _p,
    activities: _a,
    costs: _co,
    categoryTotals: _ct,
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
            exportData={{
              name: project.name,
              maxBudget: project.maxBudget,
              costs: project.costs,
              categoryTotals: project.categoryTotals,
              activities: project.activities.map((a) => ({
                name: a.name,
                budget: a.budget,
                spent: a.spent,
                progress: a.progress,
              })),
              invoices: project.invoices,
              payroll: project.payroll,
            }}
          />
        </PageTitle>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 outline-none! shadow-none! border-none!">
            <CardHeader>
              <CardTitle>Progrés del pressupost</CardTitle>
              <CardDescription>
                Costos imputats (factures + nòmines) respecte al pressupost
                màxim
                {budgetSplit ? ", desglossat en directe i indirecte" : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-3xl w-full font-semibold tabular-nums flex items-center gap-2 justify-between">
                      <span>{formatEuro(project.costs.total)}</span>
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
                <BudgetProgress
                  value={project.progress}
                  className="h-3"
                  maxBudget={project.maxBudget}
                />
              </div>
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
              <CostsByCostType costs={project.costs} />
              <CostsByUserCategory totals={project.categoryTotals} />
            </CardContent>
          </Card>

          <div className="space-y-4">
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
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {formatPct(c.percentage)}
                        </Badge>
                        <Badge variant="tertiary">
                          {formatEuro(project.maxBudget * c.percentage)}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatEuro((project.costs.total * c.percentage) / 100)}{" "}
                      imputats
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activitats</CardTitle>
                <CardDescription>
                  Classificació opcional; amb pressupost es mostra el progrés
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProjectActivities
                  projectId={project.id}
                  maxBudget={project.maxBudget}
                  activities={activitiesWithBudget}
                />
              </CardContent>
            </Card>
          </div>
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
                  activitiesByProject={activitiesByProject}
                  suppliers={suppliers}
                  categories={categoryOptions}
                  activities={activityOptions}
                  defaultVatDeductibleRate={defaultVatDeductibleRate}
                />
                <AssignPayrollDialog
                  projectId={project.id}
                  payrolls={payrolls}
                  categories={categoryOptions}
                  activities={activityOptions}
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
                projectName={project.name}
                invoices={project.invoices}
                projectOptions={projectOptions}
                activitiesByProject={activitiesByProject}
                suppliers={suppliers}
                categories={categoryOptions}
                activities={activityOptions}
              />
            </TabsContent>
            <TabsContent value="nomines">
              <AssignedPayroll
                projectId={project.id}
                projectName={project.name}
                groups={project.payroll}
                payrolls={payrolls}
                categories={categoryOptions}
                activities={activityOptions}
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

function CostsByUserCategory({ totals }: { totals: CategoryTotal[] }) {
  if (totals.length === 1 && totals[0].id == null) return null;
  if (totals.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Costos per categoria</p>
        <p className="text-sm text-muted-foreground">
          Encara no hi ha costos imputats amb categories.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Costos per categoria</p>
        <p className="text-xs text-muted-foreground">
          La suma pot superar el total del projecte.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Import</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {totals.map((row) => (
              <TableRow key={row.id ?? "none"}>
                <TableCell
                  className={cn(
                    "font-medium",
                    row.id == null && "text-muted-foreground",
                  )}
                >
                  {row.name}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatEuro(row.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CostsByCostType({ costs }: { costs: ProjectCosts }) {
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
    <div className="space-y-2">
      <p className="text-sm font-medium">Costos per tipus</p>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Origen</TableHead>
              <TableHead className="text-right">
                {COST_TYPE_LABELS.direct}
              </TableHead>
              <TableHead className="text-right">
                {COST_TYPE_LABELS.indirect}
              </TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatEuro(row.direct)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatEuro(row.indirect)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatEuro(row.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatEuro(costs.direct)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatEuro(costs.indirect)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatEuro(costs.total)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
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
