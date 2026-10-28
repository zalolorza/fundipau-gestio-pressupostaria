"use client";

import { SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const payrollFilters = ["pendents", "actives"] as const;
export type PayrollFilter = (typeof payrollFilters)[number];

const activeFilterClass = "bg-muted border-muted-foreground/20";

export function PayrollFilters({
  q,
  onQChange,
  filtre,
  onFiltreChange,
}: {
  q: string;
  onQChange: (q: string) => void;
  filtre: PayrollFilter | "";
  onFiltreChange: (filtre: PayrollFilter | "") => void;
}) {
  const qActive = Boolean(q.trim());
  const hasFilters = qActive || Boolean(filtre);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-64 flex-1">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cerca"
          className={cn("pl-8", qActive && activeFilterClass)}
          value={q}
          onChange={(e) => onQChange(e.target.value)}
        />
      </div>
      <Select
        value={filtre || "all"}
        onValueChange={(v) =>
          onFiltreChange(v === "all" ? "" : (v as PayrollFilter))
        }
      >
        <SelectTrigger
          className={cn("w-56", filtre && activeFilterClass)}
          aria-label="Filtre"
        >
          <SelectValue placeholder="Filtre" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Totes les nòmines</SelectItem>
          <SelectSeparator />
          <SelectItem value="pendents">Pendents d&apos;assignar</SelectItem>
          <SelectItem value="actives">Actives el mes en curs</SelectItem>
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onQChange("");
            onFiltreChange("");
          }}
        >
          <XIcon /> Neteja
        </Button>
      )}
    </div>
  );
}
