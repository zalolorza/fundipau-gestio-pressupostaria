"use client"

import { DownloadIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { downloadWorkbook, type XlsxSheet } from "@/lib/xlsx"
import { cn } from "@/lib/utils"

export function DownloadXlsxButton({
  filename,
  getSheets,
  label = "Descarrega",
  variant = "outline",
  size,
  className,
  disabled,
}: {
  filename: string
  getSheets: () => XlsxSheet[] | Promise<XlsxSheet[]>
  label?: string
  variant?: "outline" | "ghost" | "secondary" | "default"
  size?: "default" | "sm" | "icon" | "icon-sm"
  className?: string
  disabled?: boolean
}) {
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState(false)

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      disabled={disabled || pending || busy}
      onClick={() => {
        start(async () => {
          setBusy(true)
          try {
            const sheets = await getSheets()
            if (!sheets.length || sheets.every((s) => s.rows.length <= 1)) {
              toast.message("No hi ha dades per descarregar")
              return
            }
            await downloadWorkbook({ filename, sheets })
          } catch (e) {
            console.error(e)
            toast.error("No s'ha pogut generar l'Excel")
          } finally {
            setBusy(false)
          }
        })
      }}
    >
      <DownloadIcon />
      {label}
    </Button>
  )
}
