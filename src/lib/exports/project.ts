import { COST_TYPE_LABELS } from "@/lib/cost-type"
import { round2 } from "@/lib/format"
import { slugifyFilePart, type XlsxSheet } from "@/lib/xlsx"
import type { CategoryTotal, ProjectCosts } from "@/server/queries"

export type ProjectExportInvoice = {
  issueDate: string
  supplierName: string
  number: string
  costType: "direct" | "indirect"
  categories: { name: string }[]
  activityName: string | null
  description: string | null
  cost: number
  percentage: number
  imputed: number
}

export type ProjectExportPayrollEntry = {
  month: string
  amount: number
  percentage: number
  imputed: number
  costType: "direct" | "indirect"
  categories: { name: string }[]
  activityName: string | null
}

export type ProjectExportPayrollGroup = {
  personName: string
  role: string | null
  entries: ProjectExportPayrollEntry[]
}

export type ProjectExportActivity = {
  name: string
  budget: number | null
  spent: number
  progress: number
}

export type ProjectExportData = {
  name: string
  maxBudget: number
  costs: ProjectCosts
  categoryTotals: CategoryTotal[]
  activities: ProjectExportActivity[]
  invoices: ProjectExportInvoice[]
  payroll: ProjectExportPayrollGroup[]
}

function joinNames(items: { name: string }[]) {
  return items.map((c) => c.name).join(", ")
}

export function projectExportFilename(projectName: string) {
  return `projecte-${slugifyFilePart(projectName)}-export.xlsx`
}

export function projectInvoicesFilename(projectName: string) {
  return `projecte-${slugifyFilePart(projectName)}-factures.xlsx`
}

export function projectPayrollFilename(projectName: string) {
  return `projecte-${slugifyFilePart(projectName)}-nomines.xlsx`
}

export function buildProjectSheets(data: ProjectExportData): XlsxSheet[] {
  const available = round2(data.maxBudget - data.costs.total)
  return [
    {
      name: "Resum",
      rows: [
        ["Concepte", "Import"],
        ["Pressupost total", data.maxBudget],
        ["Pressupost consumit", data.costs.total],
        ["Pressupost disponible", available],
        ["Total factures directes", data.costs.invoicesDirect],
        ["Total factures indirectes", data.costs.invoicesIndirect],
        ["Total nòmines directes", data.costs.payrollDirect],
        ["Total nòmines indirectes", data.costs.payrollIndirect],
      ],
    },
    {
      name: "Categories",
      rows: [
        ["Categoria", "Import"],
        ...data.categoryTotals.map((c) => [c.name, c.amount]),
      ],
    },
    {
      name: "Activitats",
      rows: [
        ["Activitat", "Pressupost", "Consumit", "Progrés %"],
        ...data.activities.map((a) => [
          a.name,
          a.budget ?? "",
          a.spent,
          a.progress,
        ]),
      ],
    },
    {
      name: "Factures",
      rows: buildAssignedInvoiceRows(data.invoices),
    },
    {
      name: "Nòmines",
      rows: buildAssignedPayrollRows(data.payroll),
    },
  ]
}

export function buildAssignedInvoiceRows(invoices: ProjectExportInvoice[]) {
  return [
    [
      "Data",
      "Proveïdor",
      "Número",
      "Tipus",
      "Categories",
      "Activitat",
      "Descripció",
      "Cost",
      "%",
      "Imputat",
    ],
    ...invoices.map((i) => [
      i.issueDate,
      i.supplierName,
      i.number,
      COST_TYPE_LABELS[i.costType],
      joinNames(i.categories),
      i.activityName ?? "",
      i.description ?? "",
      i.cost,
      i.percentage,
      i.imputed,
    ]),
  ]
}

export function buildAssignedPayrollRows(groups: ProjectExportPayrollGroup[]) {
  return [
    [
      "Persona",
      "Rol",
      "Mes",
      "Tipus",
      "Categories",
      "Activitat",
      "Import",
      "%",
      "Imputat",
    ],
    ...groups.flatMap((g) =>
      g.entries.map((e) => [
        g.personName,
        g.role ?? "",
        e.month.slice(0, 7),
        COST_TYPE_LABELS[e.costType],
        joinNames(e.categories),
        e.activityName ?? "",
        e.amount,
        e.percentage,
        e.imputed,
      ])
    ),
  ]
}

export function buildAssignedInvoiceSheets(
  invoices: ProjectExportInvoice[]
): XlsxSheet[] {
  return [{ name: "Factures", rows: buildAssignedInvoiceRows(invoices) }]
}

export function buildAssignedPayrollSheets(
  groups: ProjectExportPayrollGroup[]
): XlsxSheet[] {
  return [{ name: "Nòmines", rows: buildAssignedPayrollRows(groups) }]
}
