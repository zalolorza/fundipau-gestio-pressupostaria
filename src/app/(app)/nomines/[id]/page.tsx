import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageBody, PageHeader, PageTitle } from "@/components/app/page-header";
import { EntriesTable } from "@/components/payroll/entries-table";
import { PayrollHeaderActions } from "@/components/payroll/payroll-header-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatEuro, formatMonth, round2 } from "@/lib/format";
import { currentMonth } from "@/lib/months";
import { getPayroll, getProjectOptions } from "@/server/queries";

export async function generateMetadata({
  params,
}: PageProps<"/nomines/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Nòmina" };
  const p = await getPayroll(id);
  return { title: p ? `Nòmina · ${p.personName}` : "Nòmina" };
}

export default async function PayrollPage({
  params,
}: PageProps<"/nomines/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [payroll, projects] = await Promise.all([
    getPayroll(id),
    getProjectOptions(),
  ]);
  if (!payroll) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const projectOptions = projects.map((p) => ({
    id: p.id,
    name: p.name,
    hint: p.closedAt && p.closedAt < today ? "tancat" : undefined,
  }));
  const now = currentMonth();
  const months = payroll.entries.map((e) => e.month).sort();
  const first = months[0] ?? null;
  const last = months[months.length - 1] ?? null;
  // Mes de referència per als canvis generals: l'actual, o el més proper dins del rang
  const reference = !first
    ? now
    : now < first
      ? first
      : last && now > last
        ? last
        : now;

  const past = payroll.entries.filter((e) => e.month <= now);
  const totalPast = round2(past.reduce((s, e) => s + e.amount, 0));
  const assignedPast = round2(
    past.reduce((s, e) => s + (e.amount * e.assigned) / 100, 0),
  );
  const { entries: _e, ...row } = payroll;

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Nòmines", href: "/nomines" },
          { label: payroll.personName },
        ]}
      />
      <PageBody>
        <PageTitle
          title={payroll.personName}
          description={
            [payroll.role, payroll.personTaxId].filter(Boolean).join(" · ") ||
            undefined
          }
        >
          <PayrollHeaderActions
            payroll={row}
            referenceMonth={reference}
            lastMonth={last}
          />
        </PageTitle>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Quantitat mensual"
            value={formatEuro(payroll.monthlyAmount)}
          />
          <Kpi
            label="Període"
            value={`${formatMonth(first, true)} – ${formatMonth(payroll.endMonth ?? last, true)}`}
            hint={`${payroll.entries.length} registres mensuals`}
          />
          <Kpi
            label="Acumulat fins avui"
            value={formatEuro(totalPast)}
            hint={`${past.length} mesos`}
          />
          <Kpi
            label="Imputat a projectes"
            value={formatEuro(assignedPast)}
            hint={`${formatEuro(round2(totalPast - assignedPast))} sense assignar`}
          />
        </div>

        {payroll.notes && (
          <Card>
            <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
              {payroll.notes}
            </CardContent>
          </Card>
        )}

        <div>
          <div className="border-b pb-4">
            <h2 className="text-xl font-medium">Registres mensuals</h2>
            <p className="text-sm text-muted-foreground">
              Selecciona diversos mesos per editar-ne la mensualitat o
              l&apos;assignació en bloc, o per eliminar-los. També pots clicar
              una quantitat o els projectes d&apos;un mes concret i triar si
              s&apos;aplica només a aquell, als següents o a tots.
            </p>
          </div>
          <div className="border border-t-0">
            <EntriesTable
              payrollId={payroll.id}
              entries={payroll.entries}
              projectOptions={projectOptions}
              current={now}
            />
          </div>
        </div>
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
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && (
        <CardContent className="px-4 text-xs text-muted-foreground">
          {hint}
        </CardContent>
      )}
    </Card>
  );
}
