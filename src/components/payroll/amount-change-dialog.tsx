"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { ScopeDialog } from "@/components/app/scope-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatEuro, formatMonth } from "@/lib/format"
import { changePayrollAmount } from "@/server/actions"

/**
 * Canvi de quantitat d'una nòmina en dos passos:
 * 1) nova quantitat  2) a quins mesos s'aplica (actual / futurs / tots)
 */
export function AmountChangeDialog({
  payrollId,
  referenceMonth,
  currentAmount,
  children,
}: {
  payrollId: string
  referenceMonth: string
  currentAmount: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [amount, setAmount] = useState(currentAmount)
  const [pending, start] = useTransition()

  function apply(scope: "current" | "future" | "all") {
    start(async () => {
      const res = await changePayrollAmount(payrollId, amount, scope, referenceMonth)
      if (!res.ok) return void toast.error(res.error)
      toast.success(
        `Quantitat actualitzada a ${res.data?.count} ${res.data?.count === 1 ? "mes" : "mesos"}`
      )
      setScopeOpen(false)
    })
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (o) setAmount(currentAmount)
        }}
      >
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Modificar la quantitat</DialogTitle>
            <DialogDescription>
              Mes de referència: {formatMonth(referenceMonth)}. Quantitat actual: {formatEuro(currentAmount)}.
            </DialogDescription>
          </DialogHeader>
          <form
            id="amount-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (!(amount >= 0)) return
              setOpen(false)
              setScopeOpen(true)
            }}
          >
            <Field>
              <FieldLabel htmlFor="amount">Nova quantitat mensual (€)</FieldLabel>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min={0}
                required
                autoFocus
                value={Number.isNaN(amount) ? "" : amount}
                onChange={(e) => setAmount(e.target.valueAsNumber)}
              />
            </Field>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel·la
            </Button>
            <Button type="submit" form="amount-form" disabled={amount === currentAmount || !(amount >= 0)}>
              Continua
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ScopeDialog
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        title="A quines nòmines s'aplica el canvi?"
        description={`Nova quantitat: ${formatEuro(amount)} (abans ${formatEuro(currentAmount)}).`}
        referenceMonth={referenceMonth}
        onConfirm={apply}
        pending={pending}
      />
    </>
  )
}
