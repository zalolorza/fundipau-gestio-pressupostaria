"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { AllocationEditor, allocationError, type AllocationRow } from "@/components/app/allocation-editor"
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
import { formatMonth } from "@/lib/format"
import { setPayrollEntryProjects } from "@/server/actions"

export function EntryAllocationDialog({
  payrollId,
  month,
  allocations,
  projectOptions,
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  payrollId: string
  month: string
  allocations: AllocationRow[]
  projectOptions: { id: string; name: string; hint?: string }[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const [scopeOpen, setScopeOpen] = useState(false)
  const [alloc, setAlloc] = useState<AllocationRow[]>(allocations)
  const [pending, start] = useTransition()

  function apply(scope: "current" | "future" | "all") {
    start(async () => {
      const res = await setPayrollEntryProjects(payrollId, month, scope, alloc)
      if (!res.ok) return void toast.error(res.error)
      toast.success(`Assignació aplicada a ${res.data?.count} ${res.data?.count === 1 ? "mes" : "mesos"}`)
      setScopeOpen(false)
    })
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (o) setAlloc(allocations)
        }}
      >
        {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Projectes · {formatMonth(month)}</DialogTitle>
            <DialogDescription>Percentatge de la nòmina imputat a cada projecte.</DialogDescription>
          </DialogHeader>
          <AllocationEditor
            value={alloc}
            onChange={setAlloc}
            options={projectOptions}
            mode="max"
            itemLabel="projecte"
            emptyText="Sense assignar a cap projecte"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel·la
            </Button>
            <Button
              onClick={() => {
                const err = allocationError(alloc, "max")
                if (err) return void toast.error(err)
                setOpen(false)
                setScopeOpen(true)
              }}
            >
              Continua
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ScopeDialog
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        title="A quins mesos s'aplica aquesta assignació?"
        referenceMonth={month}
        onConfirm={apply}
        pending={pending}
      />
    </>
  )
}
