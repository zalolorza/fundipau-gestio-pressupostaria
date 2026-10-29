import {
  periodFilePart,
  slugifyFilePart,
  type XlsxSheet,
} from "@/lib/xlsx"
import type { ClientBillingProject } from "@/server/queries"

export function clientBillingFilename(
  clientName: string,
  from: string,
  to: string,
  projectName?: string
) {
  const base = `client-${slugifyFilePart(clientName)}`
  const period = periodFilePart(from, to)
  if (projectName) {
    return `${base}-projecte-${slugifyFilePart(projectName)}-factures-a-emetre-${period}.xlsx`
  }
  return `${base}-factures-a-emetre-${period}.xlsx`
}

function lineKindLabel(kind: "factura" | "nomina") {
  return kind === "nomina" ? "Nòmina" : "Factura"
}

function partidaRows(
  groups: ClientBillingProject[],
  withProject: boolean
): XlsxSheet["rows"] {
  const header = withProject
    ? [
        "Projecte",
        "Data",
        "Tipus",
        "Concepte",
        "Detall",
        "Cost",
        "% projecte",
        "% client",
        "A facturar",
      ]
    : [
        "Data",
        "Tipus",
        "Concepte",
        "Detall",
        "Cost",
        "% projecte",
        "% client",
        "A facturar",
      ]

  const rows: XlsxSheet["rows"] = [header]
  for (const g of groups) {
    for (const l of g.lines) {
      const common = [
        l.date.slice(0, l.kind === "nomina" ? 7 : 10),
        lineKindLabel(l.kind),
        l.concept,
        l.detail,
        l.cost,
        l.projectPct,
        l.clientPct,
        l.amount,
      ]
      rows.push(withProject ? [g.project.name, ...common] : common)
    }
  }
  return rows
}

function tipusCategoriaRows(
  groups: ClientBillingProject[],
  withProject: boolean
): XlsxSheet["rows"] {
  const header = withProject
    ? ["Projecte", "Secció", "Concepte", "Directe", "Indirecte", "Total"]
    : ["Secció", "Concepte", "Directe", "Indirecte", "Total"]

  const rows: XlsxSheet["rows"] = [header]

  for (const g of groups) {
    const push = (
      section: string,
      concept: string,
      d: string | number,
      i: string | number,
      t: number
    ) => {
      rows.push(
        withProject
          ? [g.project.name, section, concept, d, i, t]
          : [section, concept, d, i, t]
      )
    }
    const c = g.costs
    push("Tipus", "Factures", c.invoicesDirect, c.invoicesIndirect, c.invoices)
    push("Tipus", "Nòmines", c.payrollDirect, c.payrollIndirect, c.payroll)
    push("Tipus", "Total", c.direct, c.indirect, c.total)
    for (const cat of g.categoryTotals) {
      push("Categoria", cat.name, "", "", cat.amount)
    }
  }
  return rows
}

function activitatRows(
  groups: ClientBillingProject[],
  withProject: boolean
): XlsxSheet["rows"] {
  const header = withProject
    ? ["Projecte", "Activitat", "A facturar"]
    : ["Activitat", "A facturar"]
  const rows: XlsxSheet["rows"] = [header]
  for (const g of groups) {
    for (const a of g.activityTotals) {
      rows.push(withProject ? [g.project.name, a.name, a.amount] : [a.name, a.amount])
    }
    if (g.activityTotals.length === 0) {
      rows.push(withProject ? [g.project.name, "Sense activitat", 0] : ["Sense activitat", 0])
    }
  }
  return rows
}

export function buildClientBillingSheets(
  groups: ClientBillingProject[],
  opts: { withProjectColumn: boolean }
): XlsxSheet[] {
  return [
    {
      name: "Per partida",
      rows: partidaRows(groups, opts.withProjectColumn),
    },
    {
      name: "Per tipus categoria",
      rows: tipusCategoriaRows(groups, opts.withProjectColumn),
    },
    {
      name: "Per activitat",
      rows: activitatRows(groups, opts.withProjectColumn),
    },
  ]
}
