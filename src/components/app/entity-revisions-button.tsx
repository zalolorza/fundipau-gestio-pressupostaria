"use client"

import { HistoryIcon, RotateCcwIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { listRevisions, restoreRevision } from "@/server/actions"

type RevisionEntityType =
  | "invoice"
  | "payroll_entry"
  | "payroll"
  | "project"
  | "subsidy"
  | "client"

const ACTION_LABEL: Record<string, string> = {
  replace_relations: "Canvi",
  delete: "Eliminació",
  update: "Actualització",
  restore: "Restauració",
}

const datetimeFmt = new Intl.DateTimeFormat("ca-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

type RevisionRow = Awaited<ReturnType<typeof listRevisions>>[number]

export function EntityRevisionsButton({
  entityType,
  entityId,
}: {
  entityType: RevisionEntityType
  entityId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<RevisionRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listRevisions({ entityType, entityId, limit: 40 })
      setRows(list)
    } catch (e) {
      console.error(e)
      toast.error("No s'ha pogut carregar l'historial")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) void load()
  }

  const confirmRow = rows?.find((r) => r.id === confirmId)

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          <Button variant="outline">
            <HistoryIcon /> Historial
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md" side="right">
          <SheetHeader>
            <SheetTitle>Historial de revisions</SheetTitle>
            <SheetDescription>
              Pots restaurar un estat anterior. Les assignacions regeneren els
              identificadors; els PDFs de factura no es recuperen si ja s&apos;han
              esborrat.
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
            {loading && (
              <p className="text-sm text-muted-foreground">Carregant…</p>
            )}
            {!loading && rows?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Encara no hi ha revisions desades per a aquesta fitxa.
              </p>
            )}
            {!loading &&
              rows?.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">
                        {ACTION_LABEL[r.action] ?? r.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {datetimeFmt.format(new Date(r.createdAt))}
                      </span>
                    </div>
                    <p className="text-sm leading-snug">{r.summary}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.actorName ?? r.actorEmail ?? "Usuària"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setConfirmId(r.id)}
                  >
                    <RotateCcwIcon /> Restaura
                  </Button>
                </div>
              ))}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={confirmId != null}
        onOpenChange={(o) => {
          if (!o) setConfirmId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar aquesta revisió?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRow
                ? `Es tornarà a l'estat de «${confirmRow.summary}» (${datetimeFmt.format(new Date(confirmRow.createdAt))}). L'estat actual es desarà a l'historial per si cal desfer-ho.`
                : "Es substituirà l'estat actual pel de la revisió seleccionada."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel·la</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || !confirmId}
              onClick={(e) => {
                e.preventDefault()
                const id = confirmId
                if (!id) return
                start(async () => {
                  const res = await restoreRevision(id)
                  if (!res.ok) {
                    toast.error(res.error)
                    return
                  }
                  const warnings = res.data?.warnings ?? []
                  if (warnings.length) {
                    toast.warning(
                      `Restaurat amb avisos: ${warnings.slice(0, 3).join(" · ")}`
                    )
                  } else {
                    toast.success("Estat restaurat")
                  }
                  setConfirmId(null)
                  setOpen(false)
                  router.refresh()
                })
              }}
            >
              {pending ? "Restaurant…" : "Restaura"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
