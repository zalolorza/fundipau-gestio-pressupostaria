import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export function budgetTone(progress: number) {
  if (progress > 100) return "danger"
  if (progress >= 85) return "warning"
  return "ok"
}

export function BudgetProgress({ value, className }: { value: number; className?: string }) {
  const tone = budgetTone(value)
  return (
    <Progress
      value={Math.min(100, value)}
      className={cn(
        "h-2",
        tone === "danger" && "[&>[data-slot=progress-indicator]]:bg-destructive",
        tone === "warning" && "[&>[data-slot=progress-indicator]]:bg-amber-500",
        className
      )}
    />
  )
}
