import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header";
import { PeriodPicker } from "@/components/app/period-picker";
import { ClientActions } from "@/components/clients/client-actions";
import { ClientBilling } from "@/components/clients/client-billing";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPct } from "@/lib/format";
import { addMonths, currentMonth } from "@/lib/months";
import {
  activitiesByProjectMap,
  fundersByProjectMap,
  getClient,
  getClientBilling,
  getClientProjectLinks,
  getProjectOptions,
  getSupplierOptions,
  listCategories,
  listProjectActivities,
  listProjectFunders,
} from "@/server/queries";

export async function generateMetadata({
  params,
}: PageProps<"/financadors/[id]">): Promise<Metadata> {
  const { id } = await params;
  const c = await getClient(id).catch(() => null);
  return { title: c?.name ?? "Finançador" };
}

function parseMonth(v: string | string[] | undefined, fallback: string) {
  return typeof v === "string" && /^\d{4}-\d{2}$/.test(v)
    ? `${v}-01`
    : fallback;
}

export default async function ClientPage({
  params,
  searchParams,
}: PageProps<"/financadors/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [client, projectLinks] = await Promise.all([
    getClient(id),
    getClientProjectLinks(id),
  ]);
  if (!client) notFound();

  const now = currentMonth();
  const from = parseMonth(sp.des, addMonths(now, -2));
  const to = parseMonth(sp.fins, now);

  const fiscal = [
    ["Raó social", client.legalName],
    ["NIF / CIF", client.taxId],
    ["Adreça", client.address],
    ["Població", [client.postalCode, client.city].filter(Boolean).join(" ")],
    ["Província", client.province],
    ["País", client.country],
    ["Correu", client.email],
  ] as const;

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Finançadors", href: "/financadors" },
          { label: client.name },
        ]}
      />
      <PageBody>
        <PageTitle
          title={client.name}
          description={client.legalName ?? undefined}
        >
          <ClientActions client={client} />
        </PageTitle>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Dades fiscals</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {fiscal.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="break-words">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {client.notes || "Sense notes."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Projectes</CardTitle>
              <CardDescription>
                Percentatge efectiu (directe i via subvencions).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {projectLinks.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Cap projecte assignat.
                </p>
              )}
              {projectLinks.map((p) => (
                <Link
                  key={p.project.id}
                  href={`/projectes/${p.project.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm hover:bg-muted"
                >
                  <span className="truncate">{p.project.name}</span>
                  <Badge variant="secondary">{formatPct(p.percentage)}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Subvencions</CardTitle>
              <CardDescription>
                Percentatge que finança d&apos;aquest finançador.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {client.subsidies.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Cap subvenció assignada.
                </p>
              )}
              {client.subsidies.map((s) => (
                <Link
                  key={s.subsidyId}
                  href={`/subvencions/${s.subsidyId}`}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm hover:bg-muted"
                >
                  <span className="truncate">{s.subsidy.name}</span>
                  <Badge variant="secondary">{formatPct(s.percentage)}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="py-6 space-y-6">
          <div>
            <h2 className="text-xl font-medium">Factures a emetre</h2>
            <p className="text-sm text-muted-foreground">
              Costos imputats als projectes del finançador en el període,
              multiplicats pel seu percentatge efectiu (directe i via
              subvencions).
            </p>
          </div>
          <div className="space-y-6">
            <PeriodPicker from={from} to={to} />
            <Suspense
              key={`${from}-${to}`}
              fallback={
                <p className="text-sm text-muted-foreground">Calculant…</p>
              }
            >
              <Billing
                clientId={client.id}
                clientName={client.name}
                from={from}
                to={to}
              />
            </Suspense>
          </div>
        </div>
      </PageBody>
    </>
  );
}

async function Billing({
  clientId,
  clientName,
  from,
  to,
}: {
  clientId: string;
  clientName: string;
  from: string;
  to: string;
}) {
  const [billing, projects, suppliers, categories, activities, funders] =
    await Promise.all([
      getClientBilling(clientId, from, to),
      getProjectOptions(),
      getSupplierOptions(),
      listCategories(),
      listProjectActivities(),
      listProjectFunders(),
    ]);
  if (billing.projects.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Aquest finançador no té cap projecte assignat.
      </p>
    );

  const today = new Date().toISOString().slice(0, 10);
  const edit = {
    projectOptions: projects.map((p) => ({
      id: p.id,
      name: p.name,
      hint: p.closedAt && p.closedAt < today ? "tancat" : undefined,
    })),
    activitiesByProject: activitiesByProjectMap(activities),
    fundersByProject: fundersByProjectMap(funders),
    suppliers,
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
  };

  return (
    <ClientBilling
      clientName={clientName}
      from={from}
      to={to}
      projects={billing.projects}
      total={billing.total}
      edit={edit}
    />
  );
}
