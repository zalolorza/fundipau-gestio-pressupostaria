"use client"

import { SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export const projectBudgetFilters = ["superat", "remanent"] as const
export type ProjectBudgetFilter = (typeof projectBudgetFilters)[number]

const activeFilterClass = "bg-muted border-muted-foreground/20"

export function ProjectFilters({
  q,
  onQChange,
  filtre,
  onFiltreChange,
}: {
  q: string
  onQChange: (q: string) => void
  filtre: ProjectBudgetFilter | ""
  onFiltreChange: (filtre: ProjectBudgetFilter | "") => void
}) {
  const qActive = Boolean(q.trim())
  const hasFilters = qActive || Boolean(filtre)

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
        onValueChange={(v) => onFiltreChange(v === "all" ? "" : (v as ProjectBudgetFilter))}
      >
        <SelectTrigger className={cn("w-56", filtre && activeFilterClass)} aria-label="Filtre de pressupost">
          <SelectValue placeholder="Filtre" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tots els projectes</SelectItem>
          <SelectSeparator />
          <SelectItem value="superat">Pressupost superat</SelectItem>
          <SelectItem value="remanent">Pressupost remanent</SelectItem>
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onQChange("")
            onFiltreChange("")
          }}
        >
          <XIcon /> Neteja
        </Button>
      )}
    </div>
  )
}
