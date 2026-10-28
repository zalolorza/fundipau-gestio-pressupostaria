"use client"

import { useRouter } from "next/navigation"

import { TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      "a, button, input, textarea, select, label, [role='checkbox'], [role='combobox'], [role='menuitem'], [data-row-ignore]"
    )
  )
}

type Props = React.ComponentProps<typeof TableRow> & {
  /** Navega a aquesta ruta quan es clica la fila (si no hi ha `onActivate`). */
  href?: string
  /** Acció alternativa al clic (p. ex. obrir un diàleg). */
  onActivate?: () => void
}

/** Fila de taula amb navegació o acció al clic; ignora clics en controls fills. */
export function InteractiveTableRow({
  href,
  onActivate,
  className,
  onClick,
  onKeyDown,
  children,
  ...props
}: Props) {
  const router = useRouter()
  const interactive = Boolean(href || onActivate)

  function activate() {
    if (onActivate) onActivate()
    else if (href) router.push(href)
  }

  return (
    <TableRow
      className={cn(interactive && "cursor-pointer", className)}
      tabIndex={interactive ? 0 : undefined}
      role={href ? "link" : interactive ? "button" : undefined}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || !interactive || isInteractiveTarget(e.target)) return
        activate()
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e)
        if (e.defaultPrevented || !interactive || isInteractiveTarget(e.target)) return
        if (e.key !== "Enter" && e.key !== " ") return
        e.preventDefault()
        activate()
      }}
      {...props}
    >
      {children}
    </TableRow>
  )
}
