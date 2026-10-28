"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { formatMonth } from "@/lib/format"
import type { ChangeScope } from "@/server/actions"

/** Pregunta a quins mesos s'ha d'aplicar un canvi d'una nòmina */
export function ScopeDialog({
  open,
  onOpenChange,
  title,
  description,
  referenceMonth,
  onConfirm,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  referenceMonth: string
  onConfirm: (scope: ChangeScope) => void
  pending?: boolean
}) {
  const [scope, setScope] = useState<ChangeScope>("future")
  const month = formatMonth(referenceMonth)
  const options: { value: ChangeScope; label: string; help: string }[] = [
    { value: "current", label: `Només ${month}`, help: "La resta de mesos no canvien." },
    {
      value: "future",
      label: `${month} i els mesos següents`,
      help: "Els mesos anteriors es mantenen com estaven.",
    },
    { value: "all", label: "Tots els mesos", help: "També els mesos passats." },
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <RadioGroup value={scope} onValueChange={(v) => setScope(v as ChangeScope)} className="gap-2">
          {options.map((o) => (
            <Label
              key={o.value}
              htmlFor={`scope-${o.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
            >
              <RadioGroupItem id={`scope-${o.value}`} value={o.value} className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="block font-medium">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.help}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel·la
          </Button>
          <Button onClick={() => onConfirm(scope)} disabled={pending}>
            {pending ? "Aplicant…" : "Aplica el canvi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
