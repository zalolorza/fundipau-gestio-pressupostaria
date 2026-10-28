"use client"

import { CheckIcon, CopyIcon, LinkIcon, UserPlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createInvitation } from "@/server/user-actions"

export function InviteDialog({ smtpReady }: { smtpReady: boolean }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [asAdmin, setAsAdmin] = useState(false)
  const router = useRouter()

  function reset() {
    setInviteUrl(null)
    setCopied(false)
    setAsAdmin(false)
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    start(async () => {
      const res = await createInvitation({
        email: String(f.get("email")),
        sendEmail: smtpReady,
        role: asAdmin ? "admin" : "user",
      })
      if (!res.ok) return void toast.error(res.error)
      setInviteUrl(res.data!.url)
      router.refresh()
      if (res.data!.emailSent) toast.success("Invitació creada i correu enviat")
      else
        toast.success(
          smtpReady
            ? "Invitació creada (no s’ha pogut enviar el correu; copia l’enllaç)"
            : "Invitació creada",
        )
    })
  }

  async function copyLink() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success("Enllaç copiat")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("No s’ha pogut copiar l’enllaç")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon /> Convida
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convida una usuària</DialogTitle>
          <DialogDescription>
            Genera un enllaç d’un sol ús perquè creï el compte. Caduca en 7 dies.
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-3">
            <Field>
              <FieldLabel htmlFor="invite-url">Enllaç d’invitació</FieldLabel>
              <div className="flex gap-2">
                <Input id="invite-url" readOnly value={inviteUrl} className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copyLink} title="Copia">
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </Button>
              </div>
              <FieldDescription>
                Comparteix aquest enllaç de forma segura. Només es pot fer servir un cop.
              </FieldDescription>
            </Field>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Fet</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <form id="invite-form" onSubmit={onSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Correu electrònic *</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="nom@fundipau.org"
                    autoComplete="off"
                  />
                  <FieldDescription>
                    {smtpReady
                      ? "S’enviarà un correu amb l’enllaç i també el podràs copiar."
                      : "L’SMTP no està configurat: només es generarà l’enllaç per copiar."}
                  </FieldDescription>
                </Field>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="as-admin"
                    checked={asAdmin}
                    onCheckedChange={(v) => setAsAdmin(v === true)}
                  />
                  <Label htmlFor="as-admin" className="font-normal">
                    Fer-la administradora
                  </Label>
                </div>
              </FieldGroup>
            </form>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel·la
              </Button>
              <Button type="submit" form="invite-form" disabled={pending}>
                <LinkIcon />
                {pending ? "Creant…" : "Genera l’enllaç"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
