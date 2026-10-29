"use client"

import { DownloadXlsxButton } from "@/components/app/download-xlsx-button"
import { buildInvoicesSheet } from "@/lib/exports/invoices"
import type { InvoiceListItem } from "@/server/queries"

export function InvoicesXlsxButton({
  invoices,
  filename,
  size = "sm",
}: {
  invoices: InvoiceListItem[]
  filename: string
  size?: "default" | "sm" | "icon" | "icon-sm"
}) {
  return (
    <DownloadXlsxButton
      size={size}
      filename={filename}
      getSheets={() => buildInvoicesSheet(invoices)}
      disabled={invoices.length === 0}
    />
  )
}
