import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { BudgetProgress } from "@/components/app/budget-progress"
import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { SubsidyActions } from "@/components/subsidies/subsidy-actions"
import { SubsidyBilling } from "@/components/subsidies/subsidy-billing"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatEuro, formatPct, round2 } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  activitiesByProjectMap,
  fundersByProjectMap,
  getClientOptions,
  getProjectOptions,
  getSubsidy,
  getSubsidyBilling,
  getSupplierOptions,
  listCategories,
  listProjectActivities,
  listProjectFunders,
} from "@/server/queries"

export async function generateMetadata({
  params,
}: PageProps<"/subvencions/[id]">): Promise<Metadata> {
  const { id } = await params
  const s = await getSubsidy(id).catch(() => null)
  return { title: s?.name ?? "Subvenció" }
}

export default async function SubsidyPage({ params }: PageProps<"/subvencions/[id]">) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [
    subsidy,
    clientOptions,
    projectOptions,
    billing,
    suppliers,
    categories,
    activities,
    funders,
  ] = await Promise.all([
    getSubsidy(id),
    getClientOptions(),
    getProjectOptions(),
    getSubsidyBilling(id),
    getSupplierOptions(),
    listCategories(),
    listProjectActivities(),
    listProjectFunders(),
  ])
  if (!subsidy) notFound()

  const today = new Date().toISOString().slice(0, 10)
  const edit = {
    projectOptions: projectOptions.map((p) => ({
      id: p.id,
      name: p.name,
      hint: p.closedAt && p.closedAt < today ? "tancat" : undefined,
    })),
    activitiesByProject: activitiesByProjectMap(activities),
    fundersByProject: fundersByProjectMap(funders),
    suppliers,
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
  }

  const {
    clients,
    projects,
    allocated: _allocated,
    available: _available,
    ...subsidyRow
  } = subsidy
  const clientRows = clients.map((c) => ({ id: c.id, percentage: c.percentage }))
  const projectRows = projects.map((p) => ({ id: p.id, percentage: p.percentage }))
  const imputed = billing.total
  const remaining = round2(Math.max(0, subsidy.total - imputed))
  const progress =
    subsidy.total > 0 ? round2((imputed / subsidy.total) * 100) : 0

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Subvencions", href: "/subvencions" },
          { label: subsidy.name },
        ]}
      />
      <PageBody>
        <PageTitle
          title={subsidy.name}
          description={`${formatEuro(remaining)} pendents de ${formatEuro(subsidy.total)}`}
        >
          <SubsidyActions
            subsidy={subsidyRow}
            clients={clientRows}
            clientOptions={clientOptions}
            projects={projectRows}
            projectOptions={projectOptions.map((p) => ({
              id: p.id,
              name: p.name,
              maxBudget: p.maxBudget,
            }))}
          />
        </PageTitle>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Resum</CardTitle>
              <CardDescription>
                Costos imputats (factures + nòmines) respecte al total de la
                subvenció.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">
                      {formatEuro(imputed)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      de {formatEuro(subsidy.total)}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "text-xl font-semibold tabular-nums",
                      progress > 100 ? "text-destructive" : "text-primary",
                    )}
                  >
                    {formatPct(progress)}
                  </p>
                </div>
                <BudgetProgress
                  value={progress}
                  className="h-3"
                  maxBudget={subsidy.total}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {subsidy.notes || "Sense notes."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Projectes</CardTitle>
              <CardDescription>
                Import de la subvenció assignat a cada projecte.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {projects.length === 0 && (
                <p className="text-sm text-muted-foreground">Cap projecte assignat.</p>
              )}
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projectes/${p.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm hover:bg-muted"
                >
                  <span className="truncate">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{formatPct(p.percentage)}</Badge>
                    <Badge variant="tertiary">{formatEuro(p.amount)}</Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Clients finançadors</CardTitle>
            <CardDescription>Repartiment del total de la subvenció.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {clients.length === 0 && (
              <p className="text-sm text-muted-foreground">Encara no hi ha cap client assignat.</p>
            )}
            {clients.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <Link
                  href={`/clients/${c.id}`}
                  className="truncate hover:text-primary hover:underline"
                >
                  {c.name}
                </Link>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{formatPct(c.percentage)}</Badge>
                  <Badge variant="tertiary">
                    {formatEuro((subsidy.total * c.percentage) / 100)}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="py-6 space-y-6">
          <div>
            <h2 className="text-xl font-medium">Assignacions</h2>
            <p className="text-sm text-muted-foreground">
              Costos imputats als projectes finançats per aquesta subvenció,
              multiplicats pel seu percentatge (o el 100 % si el finançador és
              explícit).
            </p>
          </div>
          {billing.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aquesta subvenció no té cap projecte assignat.
            </p>
          ) : (
            <SubsidyBilling
              subsidyName={subsidy.name}
              projects={billing.projects}
              total={billing.total}
              edit={edit}
            />
          )}
        </div>
      </PageBody>
    </>
  )
}
