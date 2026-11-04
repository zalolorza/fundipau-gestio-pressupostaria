"use client"

import { DownloadXlsxButton } from "@/components/app/download-xlsx-button"
import type { BillingEditOptions } from "@/components/clients/billing-partida-row"
import { ClientBillingProjectPanel } from "@/components/clients/client-billing-project"
import {
  buildSubsidyBillingSheets,
  subsidyBillingFilename,
} from "@/lib/exports/billing"
import { formatEuro } from "@/lib/format"
import type { SubsidyBillingProject } from "@/server/queries"

export function SubsidyBilling({
  subsidyName,
  projects,
  total,
  edit,
}: {
  subsidyName: string
  projects: SubsidyBillingProject[]
  total: number
  edit: BillingEditOptions
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-primary/5 p-4">
        <div>
          <p className="text-sm text-muted-foreground">Total imputat</p>
          <p className="text-3xl font-semibold text-primary tabular-nums">
            {formatEuro(total)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="text-xs text-muted-foreground">
            Costos assignats a aquesta subvenció (sense filtre temporal).
          </p>
          <DownloadXlsxButton
            size="sm"
            filename={subsidyBillingFilename(subsidyName)}
            getSheets={() =>
              buildSubsidyBillingSheets(projects, { withProjectColumn: true })
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
            clientName={subsidyName}
            shareColumnLabel="% subvenció"
            amountColumnLabel="Imputat"
            emptyLinesMessage="Cap cost assignat."
            emptyCategoryMessage="Cap cost amb categories."
            emptyActivityMessage="Cap cost amb activitats."
            filename={subsidyBillingFilename(subsidyName, g.project.name)}
            getSheets={() =>
              buildSubsidyBillingSheets([g], { withProjectColumn: false })
            }
            edit={edit}
          />
        ))}
      </div>
    </div>
  )
}
