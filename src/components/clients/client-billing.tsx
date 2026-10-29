"use client"

import { DownloadXlsxButton } from "@/components/app/download-xlsx-button"
import { ClientBillingProjectPanel } from "@/components/clients/client-billing-project"
import {
  buildClientBillingSheets,
  clientBillingFilename,
} from "@/lib/exports/billing"
import { formatEuro, formatMonth } from "@/lib/format"
import type { ClientBillingProject } from "@/server/queries"

export function ClientBilling({
  clientName,
  from,
  to,
  projects,
  total,
}: {
  clientName: string
  from: string
  to: string
  projects: ClientBillingProject[]
  total: number
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-primary/5 p-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Total a facturar · {formatMonth(from)} – {formatMonth(to)}
          </p>
          <p className="text-3xl font-semibold text-primary tabular-nums">
            {formatEuro(total)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="text-xs text-muted-foreground">
            Imports sense IVA de la factura a emetre.
          </p>
          <DownloadXlsxButton
            size="sm"
            filename={clientBillingFilename(clientName, from, to)}
            getSheets={() =>
              buildClientBillingSheets(projects, { withProjectColumn: true })
            }
            disabled={projects.every((p) => p.lines.length === 0)}
          />
        </div>
      </div>

      <div className="space-y-2">
        {projects.map((g) => (
          <ClientBillingProjectPanel
            key={g.project.id}
            group={g}
            clientName={clientName}
            from={from}
            to={to}
          />
        ))}
      </div>
    </div>
  )
}
