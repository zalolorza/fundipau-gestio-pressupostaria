import { COST_TYPE_LABELS } from "@/lib/cost-type"
import { slugifyFilePart, type XlsxSheet } from "@/lib/xlsx"
import type { InvoiceListItem } from "@/server/queries"

export function supplierInvoicesFilename(supplierName: string) {
  return `proveidor-${slugifyFilePart(supplierName)}-factures.xlsx`
}

export function invoicesListFilename(opts: {
  supplierName?: string | null
  des?: string | null
  fins?: string | null
}) {
  const parts: string[] = []
  if (opts.supplierName) {
    parts.push(`proveidor-${slugifyFilePart(opts.supplierName)}`)
  } else {
    parts.push("factures-proveidors")
  }
  if (opts.des || opts.fins) {
    const a = (opts.des ?? opts.fins ?? "").slice(0, 10)
    const b = (opts.fins ?? opts.des ?? "").slice(0, 10)
    parts.push(a === b ? a : `${a}_${b}`)
  }
  return `${parts.join("-")}.xlsx`
}

export function buildInvoicesSheet(invoices: InvoiceListItem[]): XlsxSheet[] {
  return [
    {
      name: "Factures",
      rows: [
        [
          "Data",
          "Número",
          "Tipus",
          "Proveïdor",
          "NIF",
          "Descripció",
          "Base",
          "IVA",
          "IRPF",
          "Total",
          "% assignat",
          "Total assignat",
          "Projectes",
          "Categories",
        ],
        ...invoices.map((i) => [
          i.issueDate,
          i.number,
          COST_TYPE_LABELS[i.costType],
          i.supplierName,
          i.supplierTaxId ?? "",
          i.description ?? "",
          i.baseAmount,
          i.vatAmount,
          i.irpfAmount,
          i.total,
          i.assigned,
          i.assignedTotal,
          i.allocations.map((a) => `${a.name} (${a.percentage}%)`).join(", "),
          i.categories.map((c) => c.name).join(", "),
        ]),
      ],
    },
  ]
}
