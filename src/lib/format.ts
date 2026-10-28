const eur = new Intl.NumberFormat("ca-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const pctFmt = new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 2 })

export function formatEuro(n: number | null | undefined) {
  return eur.format(n ?? 0)
}

export function formatPct(n: number | null | undefined) {
  return `${pctFmt.format(n ?? 0)} %`
}

const dateFmt = new Intl.DateTimeFormat("ca-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
})
const monthFmt = new Intl.DateTimeFormat("ca-ES", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})
const monthShortFmt = new Intl.DateTimeFormat("ca-ES", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

/** "2026-03-15" -> "15/03/2026" */
export function formatDate(d: string | null | undefined) {
  if (!d) return "—"
  return dateFmt.format(new Date(`${d.slice(0, 10)}T00:00:00Z`))
}

/** "2026-03-01" -> "març de 2026" */
export function formatMonth(d: string | null | undefined, short = false) {
  if (!d) return "—"
  const s = (short ? monthShortFmt : monthFmt).format(new Date(`${d.slice(0, 7)}-01T00:00:00Z`))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
