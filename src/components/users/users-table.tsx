"use client"

import { Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { ConfirmButton } from "@/components/app/confirm-button"
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
import { isAdminRole } from "@/lib/auth-roles"
import { removeUser, setUserRole } from "@/server/user-actions"

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
}: {
  users: UserRow[]
  currentUserId: string
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
              <TableRow key={u.id}>
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
                    <SelectTrigger className="w-42" size="sm">
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
                <TableCell className="pr-4 text-right">
                  {!isSelf && (
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
                      <Button type="button" variant="ghost" size="icon" title="Elimina">
                        <Trash2Icon />
                      </Button>
                    </ConfirmButton>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}
