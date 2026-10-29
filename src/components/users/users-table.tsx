"use client"

import { CopyIcon, MailIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { ConfirmButton } from "@/components/app/confirm-button"
import { InteractiveTableRow } from "@/components/app/interactive-table-row"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { isAdminRole } from "@/lib/auth-roles"
import { createPasswordResetLink, removeUser, setUserRole } from "@/server/user-actions"

type UserRow = {
  id: string
  name: string
  email: string
  role: string
  createdAt: Date | string
}

const dateFmt = new Intl.DateTimeFormat("ca-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

export function UsersTable({
  users,
  currentUserId,
  smtpReady,
}: {
  users: UserRow[]
  currentUserId: string
  smtpReady: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function changeRole(userId: string, role: "user" | "admin") {
    start(async () => {
      const res = await setUserRole(userId, role)
      if (!res.ok) return void toast.error(res.error)
      toast.success(role === "admin" ? "Rol d’administradora assignat" : "Rol actualitzat")
      router.refresh()
    })
  }

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email)
      toast.success("Correu copiat")
    } catch {
      toast.error("No s’ha pogut copiar el correu")
    }
  }

  function sendResetEmail(userId: string, name: string) {
    start(async () => {
      const res = await createPasswordResetLink({ userId, sendEmail: true })
      if (!res.ok) return void toast.error(res.error)
      toast.success(`Correu de recuperació enviat a ${name}`)
    })
  }

  function copyResetLink(userId: string) {
    start(async () => {
      const res = await createPasswordResetLink({ userId, sendEmail: false })
      if (!res.ok) return void toast.error(res.error)
      try {
        await navigator.clipboard.writeText(res.data!.url)
        toast.success("Enllaç de recuperació copiat (caduca en 1 h)")
      } catch {
        toast.error("No s’ha pogut copiar l’enllaç")
      }
    })
  }

  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Nom</TableHead>
            <TableHead>Correu</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Alta</TableHead>
            <TableHead className="pr-4 text-right">Accions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                Encara no hi ha cap usuària.
              </TableCell>
            </TableRow>
          )}
          {users.map((u) => {
            const admin = isAdminRole(u.role)
            const isSelf = u.id === currentUserId
            return (
              <InteractiveTableRow key={u.id} onActivate={() => void copyEmail(u.email)}>
                <TableCell className="pl-4 font-medium">
                  <div className="flex items-center gap-2">
                    {u.name}
                    {isSelf && <Badge variant="secondary">Tu</Badge>}
                  </div>
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Select
                    value={admin ? "admin" : "user"}
                    disabled={pending || isSelf}
                    onValueChange={(v) => changeRole(u.id, v as "user" | "admin")}
                  >
                    <SelectTrigger className="w-48" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuària</SelectItem>
                      <SelectItem value="admin">Administradora</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {dateFmt.format(new Date(u.createdAt))}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1" data-row-ignore>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={pending || !smtpReady}
                            aria-label={`Enviar correu de recuperació a ${u.name}`}
                            onClick={() => sendResetEmail(u.id, u.name)}
                          >
                            <MailIcon />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {smtpReady
                          ? "Enviar correu de recuperació de contrasenya"
                          : "SMTP no configurat"}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={pending}
                          aria-label={`Copiar enllaç de recuperació de ${u.name}`}
                          onClick={() => copyResetLink(u.id)}
                        >
                          <CopyIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copiar enllaç de recuperació</TooltipContent>
                    </Tooltip>
                    {!isSelf && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <ConfirmButton
                              title="Elimina la usuària?"
                              description={`S’eliminarà el compte de ${u.name} (${u.email}). Aquesta acció no es pot desfer.`}
                              confirmLabel="Elimina"
                              onConfirm={() =>
                                start(async () => {
                                  const res = await removeUser(u.id)
                                  if (!res.ok) return void toast.error(res.error)
                                  toast.success("Usuària eliminada")
                                  router.refresh()
                                })
                              }
                            >
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`Elimina ${u.name}`}
                              >
                                <Trash2Icon />
                              </Button>
                            </ConfirmButton>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Elimina</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
              </InteractiveTableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}
