"use client"

import { SearchIcon, XIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"

export function InvoiceFilters({
  suppliers,
  projects,
}: {
  suppliers: { id: string; name: string }[]
  projects: { id: string; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = useState(params.get("q") ?? "")

  const set = (key: string, value: string) => {
    const sp = new URLSearchParams(params)
    if (value) sp.set(key, value)
    else sp.delete(key)
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) set("q", q)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const hasFilters =
    params.get("q") || params.get("des") || params.get("fins") || params.get("proveidor") || params.get("projecte")

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-64 flex-1">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cerca per número, proveïdor, NIF o descripció…"
          className="pl-8"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Select value={params.get("proveidor") ?? "all"} onValueChange={(v) => set("proveidor", v === "all" ? "" : v)}>
        <SelectTrigger className="w-56" aria-label="Proveïdor">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tots els proveïdors</SelectItem>
          <SelectSeparator />
          {suppliers.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={params.get("projecte") ?? "all"} onValueChange={(v) => set("projecte", v === "all" ? "" : v)}>
        <SelectTrigger className="w-56" aria-label="Projecte">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tots els projectes</SelectItem>
          <SelectSeparator />
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DatePicker
        className="w-40"
        aria-label="Des de"
        placeholder="Des de"
        value={params.get("des") ?? ""}
        onChange={(v) => set("des", v)}
      />
      <span className="text-sm text-muted-foreground">–</span>
      <DatePicker
        className="w-40"
        aria-label="Fins a"
        placeholder="Fins a"
        value={params.get("fins") ?? ""}
        onChange={(v) => set("fins", v)}
      />
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("")
            router.replace(pathname)
          }}
        >
          <XIcon /> Neteja
        </Button>
      )}
    </div>
  )
}
