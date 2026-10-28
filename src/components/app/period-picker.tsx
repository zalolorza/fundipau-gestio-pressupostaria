"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { MonthPicker } from "@/components/ui/month-picker"
import { addMonths, currentMonth } from "@/lib/months"

function quarterStart(m: string) {
  const month = Number(m.slice(5, 7))
  const q = Math.floor((month - 1) / 3) * 3 + 1
  return `${m.slice(0, 4)}-${String(q).padStart(2, "0")}-01`
}

export function PeriodPicker({ from, to }: { from: string; to: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const go = (f: string, t: string) => {
    const sp = new URLSearchParams(params)
    sp.set("des", f.slice(0, 7))
    sp.set("fins", t.slice(0, 7))
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }

  const now = currentMonth()
  const qs = quarterStart(now)
  const presets = [
    { label: "Aquest mes", f: now, t: now },
    { label: "Mes anterior", f: addMonths(now, -1), t: addMonths(now, -1) },
    { label: "Trimestre actual", f: qs, t: addMonths(qs, 2) },
    { label: "Trimestre anterior", f: addMonths(qs, -3), t: addMonths(qs, -1) },
    { label: "Aquest any", f: `${now.slice(0, 4)}-01-01`, t: `${now.slice(0, 4)}-12-01` },
    {
      label: "Any anterior",
      f: `${Number(now.slice(0, 4)) - 1}-01-01`,
      t: `${Number(now.slice(0, 4)) - 1}-12-01`,
    },
  ]

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="des" className="text-xs text-muted-foreground">
          Des de
        </Label>
        <MonthPicker
          id="des"
          value={from.slice(0, 7)}
          onChange={(v) => v && go(`${v}-01`, to)}
          className="w-44"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="fins" className="text-xs text-muted-foreground">
          Fins a
        </Label>
        <MonthPicker
          id="fins"
          value={to.slice(0, 7)}
          onChange={(v) => v && go(from, `${v}-01`)}
          className="w-44"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => {
          const active = p.f.slice(0, 7) === from.slice(0, 7) && p.t.slice(0, 7) === to.slice(0, 7)
          return (
            <Button
              key={p.label}
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => go(p.f, p.t)}
            >
              {p.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
