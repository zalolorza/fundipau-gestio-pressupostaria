import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BudgetProgress } from "@/components/app/budget-progress"
import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { AssignPayrollDialog } from "@/components/projects/assign-payroll-dialog"
import { ProjectInvoiceMenu } from "@/components/projects/project-invoice-menu"
import { AssignedInvoices, AssignedPayroll } from "@/components/projects/assigned-resources"
import { ProjectActions } from "@/components/projects/project-actions"
import { ProjectDialog } from "@/components/projects/project-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate, formatEuro, formatPct, round2 } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  getAssignableInvoices,
  getClientOptions,
  getPayrollOptions,
  getProject,
  getProjectOptions,
  getSupplierOptions,
} from "@/server/queries"

export async function generateMetadata({ params }: PageProps<"/projectes/[id]">): Promise<Metadata> {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Projecte" }
  const p = await getProject(id)
  return { title: p?.name ?? "Projecte" }
}

export default async function ProjectPage({ params }: PageProps<"/projectes/[id]">) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [project, clientOptions, invoices, payrolls, projects, suppliers] = await Promise.all([
    getProject(id),
    getClientOptions(),
    getAssignableInvoices(),
    getPayrollOptions(),
    getProjectOptions(),
    getSupplierOptions(),
  ])
  if (!project) notFound()

  const remaining = round2(project.maxBudget - project.costs.total)
  const clientRows = project.clients.map((c) => ({ id: c.id, percentage: c.percentage }))
  const current = Object.fromEntries(project.invoices.map((i) => [i.id, i.percentage]))
  const { clients: _c, invoices: _i, payroll: _p, costs: _co, progress: _pr, ...projectRow } = project
  const today = new Date().toISOString().slice(0, 10)
  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    hint: p.closedAt && p.closedAt < today ? "tancat" : undefined,
  }))

  return (
    <>
      <PageHeader crumbs={[{ label: "Projectes", href: "/projectes" }, { label: project.name }]} />
      <PageBody>
        <PageTitle
          title={project.name}
          description={
            <>
              {formatDate(project.openedAt)} – {project.closedAt ? formatDate(project.closedAt) : "obert"}
              {project.description && <span className="mt-1 block max-w-3xl">{project.description}</span>}
            </>
          }
        >
          <ProjectActions project={projectRow} clients={clientRows} clientOptions={clientOptions} />
        </PageTitle>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Progrés del pressupost</CardTitle>
              <CardDescription>Costos imputats (factures + nòmines) respecte al pressupost màxim.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-3xl font-semibold tabular-nums">{formatEuro(project.costs.total)}</p>
                  <p className="text-sm text-muted-foreground">de {formatEuro(project.maxBudget)}</p>
                </div>
                <p
                  className={cn(
                    "text-2xl font-semibold tabular-nums",
                    project.progress > 100 ? "text-destructive" : "text-primary"
                  )}
                >
                  {formatPct(round2(project.progress))}
                </p>
              </div>
              <BudgetProgress value={project.progress} className="h-3" />
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <Stat label="Factures" value={formatEuro(project.costs.invoices)} />
                <Stat label="Nòmines" value={formatEuro(project.costs.payroll)} />
                <Stat
                  label={remaining >= 0 ? "Disponible" : "Excés"}
                  value={formatEuro(Math.abs(remaining))}
                  className={remaining < 0 ? "text-destructive" : undefined}
                />
                <Stat label="Pressupost" value={formatEuro(project.maxBudget)} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clients</CardTitle>
              <CardDescription>Repartiment del finançament</CardDescription>
              <CardAction>
                <ProjectDialog project={projectRow} clients={clientRows} clientOptions={clientOptions}>
                  <Button variant="outline" size="sm">
                    Edita
                  </Button>
                </ProjectDialog>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.clients.length === 0 && (
                <p className="text-sm text-muted-foreground">Encara no hi ha cap client assignat.</p>
              )}
              {project.clients.map((c) => (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/clients/${c.id}`} className="truncate hover:text-primary hover:underline">
                      {c.name}
                    </Link>
                    <Badge variant="secondary">{formatPct(c.percentage)}</Badge>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${c.percentage}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatEuro((project.costs.total * c.percentage) / 100)} imputats
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
              <CardDescription>Factures i nòmines imputades a aquest projecte.</CardDescription>
              <CardAction className="flex flex-wrap gap-2">
                <ProjectInvoiceMenu
                  projectId={project.id}
                  invoices={invoices}
                  current={current}
                  projectOptions={projectOptions}
                  suppliers={suppliers}
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
                  Factures <Badge variant="secondary">{project.invoices.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="nomines">
                  Nòmines <Badge variant="secondary">{project.payroll.length}</Badge>
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
              <AssignedPayroll projectId={project.id} groups={project.payroll} />
            </TabsContent>
          </Tabs>
        </Card>
      </PageBody>
    </>
  )
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium tabular-nums", className)}>{value}</dd>
    </div>
  )
}
