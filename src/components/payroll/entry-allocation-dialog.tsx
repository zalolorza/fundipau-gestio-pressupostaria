"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AllocationEditor,
  allocationError,
  type AllocationRow,
} from "@/components/app/allocation-editor";
import { ScopeDialog } from "@/components/app/scope-dialog";
import type { CategoryRef } from "@/components/categories/category-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { formatMonth } from "@/lib/format";
import { unionFundersFromProjects } from "@/lib/funders";
import { setPayrollEntryProjects } from "@/server/actions";

export function EntryAllocationDialog({
  payrollId,
  month,
  allocations,
  funderAllocations = [],
  projectOptions,
  activitiesByProject = {},
  fundersByProject = {},
  categories: initialCategories = [],
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  payrollId: string;
  month: string;
  allocations: AllocationRow[];
  funderAllocations?: AllocationRow[];
  projectOptions: { id: string; name: string; hint?: string }[];
  activitiesByProject?: Record<string, { id: string; name: string }[]>;
  fundersByProject?: Record<string, { id: string; name: string }[]>;
  categories?: CategoryRef[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [scopeOpen, setScopeOpen] = useState(false);
  const [alloc, setAlloc] = useState<AllocationRow[]>(allocations);
  const [funderAlloc, setFunderAlloc] =
    useState<AllocationRow[]>(funderAllocations);
  const [catalog, setCatalog] = useState(initialCategories);
  const [pending, start] = useTransition();
  const funderOptions = unionFundersFromProjects(
    alloc.map((a) => a.id),
    fundersByProject,
  );

  function apply(scope: "current" | "future" | "all") {
    start(async () => {
      const res = await setPayrollEntryProjects(
        payrollId,
        month,
        scope,
        alloc,
        funderAlloc,
      );
      if (!res.ok) return void toast.error(res.error);
      toast.success(
        `Assignació aplicada a ${res.data?.count} ${res.data?.count === 1 ? "mes" : "mesos"}`,
      );
      setScopeOpen(false);
    });
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) {
            setAlloc(allocations);
            setFunderAlloc(funderAllocations);
            setCatalog(initialCategories);
          }
        }}
      >
        {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Projectes · {formatMonth(month)}</DialogTitle>
            <DialogDescription>
              Percentatge de la nòmina imputat a cada projecte i, opcionalment,
              l&apos;activitat i els finançadors.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <FieldSet>
              <FieldLegend>Projectes</FieldLegend>
              <AllocationEditor
                value={alloc}
                onChange={setAlloc}
                options={projectOptions}
                mode="max"
                itemLabel="projecte"
                emptyText="Sense assignar a cap projecte"
                withCostType
                categories={catalog}
                onCatalogChange={setCatalog}
                activitiesByProject={activitiesByProject}
                allowDuplicateIds
                allowOver100
              />
            </FieldSet>
            <FieldSet>
              <FieldLegend>Finançadors</FieldLegend>
              <FieldDescription>
                Capa opcional de finançadors explícits. El residual es reparteix
                segons el mix dels projectes assignats.
              </FieldDescription>
              <AllocationEditor
                value={funderAlloc}
                onChange={setFunderAlloc}
                options={funderOptions}
                mode="max"
                itemLabel="finançador"
                emptyText="Sense finançadors explícits · la financiació es reparteix segons els finançadors assignats als projectes"
                funderOptions
              />
            </FieldSet>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel·la
            </Button>
            <Button
              onClick={() => {
                const err = allocationError(alloc, "max", {
                  allowDuplicateIds: true,
                  allowOver100: true,
                });
                if (err) return void toast.error(`Projectes: ${err}`);
                const funderErr = allocationError(funderAlloc, "max");
                if (funderErr)
                  return void toast.error(`Finançadors: ${funderErr}`);
                setOpen(false);
                setScopeOpen(true);
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
  );
}
