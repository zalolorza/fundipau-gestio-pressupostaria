"use client"

import { PencilIcon, Trash2Icon } from "lucide-react"

import type { AllocationRow } from "@/components/app/allocation-editor"
import { ConfirmButton } from "@/components/app/confirm-button"
import {
  SubsidyDialog,
  type SubsidyProjectOption,
} from "@/components/subsidies/subsidy-dialog"
import { Button } from "@/components/ui/button"
import type { Subsidy } from "@/db/schema"
import { deleteSubsidy } from "@/server/actions"

export function SubsidyActions({
  subsidy,
  clients,
  clientOptions,
  projects,
  projectOptions,
}: {
  subsidy: Subsidy
  clients: AllocationRow[]
  clientOptions: { id: string; name: string }[]
  projects: AllocationRow[]
  projectOptions: SubsidyProjectOption[]
}) {
  return (
    <>
      <SubsidyDialog
        subsidy={subsidy}
        clients={clients}
        clientOptions={clientOptions}
        projects={projects}
        projectOptions={projectOptions}
      >
        <Button variant="outline">
          <PencilIcon /> Edita
        </Button>
      </SubsidyDialog>
      <ConfirmButton
        title="Eliminar la subvenció?"
        description="S'eliminaran també les seves assignacions a projectes i clients. Aquesta acció no es pot desfer."
        onConfirm={() => deleteSubsidy(subsidy.id)}
      >
        <Button variant="outline" className="text-destructive">
          <Trash2Icon /> Elimina
        </Button>
      </ConfirmButton>
    </>
  )
}
