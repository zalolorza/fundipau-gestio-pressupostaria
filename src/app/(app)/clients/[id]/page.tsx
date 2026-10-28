import { ChevronRightIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header"
import { PeriodPicker } from "@/components/app/period-picker"
import { ClientActions } from "@/components/clients/client-actions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatEuro, formatMonth, formatPct } from "@/lib/format"
import { addMonths, currentMonth } from "@/lib/months"
import { getClient, getClientBilling } from "@/server/queries"

export async function generateMetadata({ params }: PageProps<"/clients/[id]">): Promise<Metadata> {
  const { id } = await params
  const c = await getClient(id).catch(() => null)
  return { title: c?.name ?? "Client" }
}

function parseMonth(v: string | string[] | undefined, fallback: string) {
  return typeof v === "string" && /^\d{4}-\d{2}$/.test(v) ? `${v}-01` : fallback
}

export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const { id } = await params
  const sp = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const client = await getClient(id)
  if (!client) notFound()

  const now = currentMonth()
  const from = parseMonth(sp.des, addMonths(now, -2))
  const to = parseMonth(sp.fins, now)

  const fiscal = [
    ["Raó social", client.legalName],
    ["NIF / CIF", client.taxId],
    ["Adreça", client.address],
    ["Població", [client.postalCode, client.city].filter(Boolean).join(" ")],
    ["Província", client.province],
    ["País", client.country],
    ["Correu", client.email],
  ] as const

  return (
    <>
      <PageHeader crumbs={[{ label: "Clients", href: "/clients" }, { label: client.name }]} />
      <PageBody>
        <PageTitle title={client.name} description={client.legalName ?? undefined}>
          <ClientActions client={client} />
        </PageTitle>

        <div className="grid gap-4 lg:grid-cols-3">
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
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{client.notes || "Sense notes."}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Projectes</CardTitle>
              <CardDescription>Percentatge que finança d&apos;aquest client.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {client.projects.length === 0 && <p className="text-sm text-muted-foreground">Cap projecte assignat.</p>}
              {client.projects.map((p) => (
                <Link
                  key={p.projectId}
                  href={`/projectes/${p.projectId}`}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm hover:bg-muted"
                >
                  <span className="truncate">{p.project.name}</span>
                  <Badge variant="secondary">{formatPct(p.percentage)}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Factures a emetre</CardTitle>
            <CardDescription>
              Costos imputats als projectes del client en el període, multiplicats pel seu percentatge de
              finançament.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <PeriodPicker from={from} to={to} />
            <Suspense key={`${from}-${to}`} fallback={<p className="text-sm text-muted-foreground">Calculant…</p>}>
              <Billing clientId={client.id} from={from} to={to} />
            </Suspense>
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}

async function Billing({ clientId, from, to }: { clientId: string; from: string; to: string }) {
  const billing = await getClientBilling(clientId, from, to)
  if (billing.projects.length === 0)
    return <p className="text-sm text-muted-foreground">Aquest client no té cap projecte assignat.</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-primary/5 p-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Total a facturar · {formatMonth(from)} – {formatMonth(to)}
          </p>
          <p className="text-3xl font-semibold text-primary tabular-nums">{formatEuro(billing.total)}</p>
        </div>
        <p className="text-xs text-muted-foreground">Imports sense IVA de la factura a emetre.</p>
      </div>

      <div className="space-y-2">
        {billing.projects.map((g) => (
          <details key={g.project.id} className="group rounded-lg border" open={g.total > 0}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 p-3 [&::-webkit-details-marker]:hidden">
              <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
              <span className="font-medium">{g.project.name}</span>
              <Badge variant="outline">{formatPct(g.clientPct)} del projecte</Badge>
              <span className="ml-auto flex gap-4 text-sm tabular-nums">
                <span className="text-muted-foreground">Factures {formatEuro(g.invoices)}</span>
                <span className="text-muted-foreground">Nòmines {formatEuro(g.payroll)}</span>
                <span className="font-semibold">{formatEuro(g.total)}</span>
              </span>
            </summary>
            {g.lines.length === 0 ? (
              <p className="border-t p-3 text-sm text-muted-foreground">Cap cost en aquest període.</p>
            ) : (
              <div className="border-t">
                <Table>
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
                    {g.lines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-4 whitespace-nowrap">
                          {l.kind === "nomina" ? formatMonth(l.date, true) : formatDate(l.date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={l.kind === "nomina" ? "secondary" : "outline"}>
                              {l.kind === "nomina" ? "Nòmina" : "Factura"}
                            </Badge>
                            <span>{l.concept}</span>
                          </div>
                          {l.detail && <p className="text-xs text-muted-foreground">{l.detail}</p>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatEuro(l.cost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPct(l.projectPct)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPct(l.clientPct)}</TableCell>
                        <TableCell className="pr-4 text-right font-medium tabular-nums">{formatEuro(l.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </details>
        ))}
      </div>
    </div>
  )
}
