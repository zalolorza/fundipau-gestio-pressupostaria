"use client"

import { PencilIcon, Trash2Icon } from "lucide-react"

import { ConfirmButton } from "@/components/app/confirm-button"
import type { AllocationRow } from "@/components/app/allocation-editor"
import { ProjectDialog } from "@/components/projects/project-dialog"
import { Button } from "@/components/ui/button"
import type { Project } from "@/db/schema"
import { deleteProject } from "@/server/actions"

export function ProjectActions({
  project,
  clients,
  clientOptions,
}: {
  project: Project
  clients: AllocationRow[]
  clientOptions: { id: string; name: string }[]
}) {
  return (
    <>
      <ProjectDialog project={project} clients={clients} clientOptions={clientOptions}>
        <Button variant="outline">
          <PencilIcon /> Edita
        </Button>
      </ProjectDialog>
      <ConfirmButton
        title="Eliminar el projecte?"
        description="Les factures i nòmines no s'eliminen, però perdran l'assignació a aquest projecte."
        onConfirm={() => deleteProject(project.id)}
      >
        <Button variant="outline" className="text-destructive">
          <Trash2Icon /> Elimina
        </Button>
      </ConfirmButton>
    </>
  )
}
