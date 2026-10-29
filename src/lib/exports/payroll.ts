import { COST_TYPE_LABELS, type CostType } from "@/lib/cost-type"
import { slugifyFilePart, type XlsxSheet } from "@/lib/xlsx"

export type PayrollExportEntry = {
  month: string
  amount: number
  assigned: number
  allocations: {
    name: string
    percentage: number
    costType: CostType
    categories?: { name: string }[]
    activityId?: string | null
    activityName?: string | null
  }[]
}

export function payrollExportFilename(personName: string) {
  return `nomina-${slugifyFilePart(personName)}-mensualitats.xlsx`
}

export function buildPayrollSheets(
  entries: PayrollExportEntry[],
  activityNamesById?: Record<string, string>
): XlsxSheet[] {
  const rows: XlsxSheet["rows"] = [
    [
      "Mes",
      "Import",
      "% assignat",
      "Projecte",
      "% projecte",
      "Tipus",
      "Categories",
      "Activitat",
    ],
  ]

  for (const e of entries) {
    if (e.allocations.length === 0) {
      rows.push([
        e.month.slice(0, 7),
        e.amount,
        e.assigned,
        "",
        "",
        "",
        "",
        "",
      ])
      continue
    }
    for (const a of e.allocations) {
      const activity =
        a.activityName ??
        (a.activityId ? activityNamesById?.[a.activityId] ?? "" : "")
      rows.push([
        e.month.slice(0, 7),
        e.amount,
        e.assigned,
        a.name,
        a.percentage,
        COST_TYPE_LABELS[a.costType],
        (a.categories ?? []).map((c) => c.name).join(", "),
        activity,
      ])
    }
  }

  return [{ name: "Mensualitats", rows }]
}
