"use client"

import { PencilIcon, Trash2Icon } from "lucide-react"

import { ConfirmButton } from "@/components/app/confirm-button"
import { ClientDialog } from "@/components/clients/client-dialog"
import { Button } from "@/components/ui/button"
import type { Client } from "@/db/schema"
import { deleteClient } from "@/server/actions"

export function ClientActions({ client }: { client: Client }) {
  return (
    <>
      <ClientDialog client={client}>
        <Button variant="outline">
          <PencilIcon /> Edita
        </Button>
      </ClientDialog>
      <ConfirmButton
        title="Eliminar el client?"
        description="S'eliminaran també les seves assignacions a projectes. Aquesta acció no es pot desfer."
        onConfirm={() => deleteClient(client.id)}
      >
        <Button variant="outline" className="text-destructive">
          <Trash2Icon /> Elimina
        </Button>
      </ConfirmButton>
    </>
  )
}
