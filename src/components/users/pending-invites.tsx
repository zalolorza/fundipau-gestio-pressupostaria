"use client"

import { CopyIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { ConfirmButton } from "@/components/app/confirm-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { revokeInvitation } from "@/server/user-actions"

type PendingInvite = {
  id: string
  email: string
  token: string
  expiresAt: Date | string
  createdAt: Date | string
  invitedByName: string
  url: string
}

const dateTimeFmt = new Intl.DateTimeFormat("ca-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

export function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  const router = useRouter()
  const [, start] = useTransition()

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Enllaç copiat")
    } catch {
      toast.error("No s’ha pogut copiar l’enllaç")
    }
  }

  if (invites.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-heading text-lg font-semibold">Invitacions pendents</h2>
        <Badge variant="secondary">{invites.length}</Badge>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Correu</TableHead>
              <TableHead>Convidada per</TableHead>
              <TableHead>Caduca</TableHead>
              <TableHead className="pr-4 text-right">Accions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="pl-4 font-medium">{inv.email}</TableCell>
                <TableCell>{inv.invitedByName}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {dateTimeFmt.format(new Date(inv.expiresAt))}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Copia l’enllaç"
                      onClick={() => copy(inv.url)}
                    >
                      <CopyIcon />
                    </Button>
                    <ConfirmButton
                      title="Revoca la invitació?"
                      description={`S’invalidarà l’enllaç enviat a ${inv.email}.`}
                      confirmLabel="Revoca"
                      onConfirm={() =>
                        start(async () => {
                          const res = await revokeInvitation(inv.id)
                          if (!res.ok) return void toast.error(res.error)
                          toast.success("Invitació revocada")
                          router.refresh()
                        })
                      }
                    >
                      <Button type="button" variant="ghost" size="icon" title="Revoca">
                        <Trash2Icon />
                      </Button>
                    </ConfirmButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
