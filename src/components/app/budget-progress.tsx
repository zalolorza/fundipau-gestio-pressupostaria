import { Progress } from "@/components/ui/progress";
import { COST_TYPE_LABELS } from "@/lib/cost-type";
import { cn } from "@/lib/utils";

export function budgetTone(progress: number) {
  if (progress > 100) return "danger";
  if (progress >= 85) return "warning";
  return "ok";
}

function toneClass(progress: number) {
  const tone = budgetTone(progress);
  return cn(
    tone === "danger" && "[&>[data-slot=progress-indicator]]:bg-destructive",
    tone === "warning" && "[&>[data-slot=progress-indicator]]:bg-amber-500",
  );
}

export type BudgetProgressBreakdown = {
  direct: number;
  indirect: number;
};

export function BudgetProgress({
  value,
  className,
  breakdown,
}: {
  value: number;
  className?: string;
  /** Progrés % directe / indirecte quan el projecte té pressupost desglossat. */
  breakdown?: BudgetProgressBreakdown;
}) {
  return (
    <div className={cn("space-y-5", breakdown && "min-w-0")}>
      <Progress
        value={Math.min(100, value)}
        className={cn("h-2", toneClass(value), className)}
      />
      {breakdown && (
        <div className="grid gap-5 sm:grid-cols-2">
          <BreakdownBar
            label={COST_TYPE_LABELS.direct}
            value={breakdown.direct}
            className={className}
          />
          <BreakdownBar
            label={COST_TYPE_LABELS.indirect}
            value={breakdown.indirect}
            className={className}
          />
        </div>
      )}
    </div>
  );
}

function BreakdownBar({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="flex items-baseline justify-between gap-2 text-[11px] leading-none text-muted-foreground">
        <span className="truncate">{label}</span>
        <span
          className={cn(
            "tabular-nums",
            value > 100 ? "text-destructive" : undefined,
          )}
        >
          {Math.round(value)} %
        </span>
      </div>
      <Progress
        value={Math.min(100, value)}
        className={cn("h-2", toneClass(value), className)}
      />
    </div>
  );
}
