/** Utilitats per treballar amb mesos en format "YYYY-MM-01" (UTC, sense zones horàries) */

export function toMonth(d: string | Date): string {
  if (typeof d === "string") return `${d.slice(0, 7)}-01`
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

export function currentMonth(): string {
  return toMonth(new Date())
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, "0")}-01`
}

/** Llista de mesos entre from i to (inclosos) */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = []
  let m = toMonth(from)
  const end = toMonth(to)
  while (m <= end && out.length < 600) {
    out.push(m)
    m = addMonths(m, 1)
  }
  return out
}

/** Últim dia del mes, "YYYY-MM-DD" */
export function endOfMonth(month: string): string {
  const next = addMonths(month, 1)
  const d = new Date(`${next}T00:00:00Z`)
  d.setUTCDate(0)
  return d.toISOString().slice(0, 10)
}

export function endOfYear(month: string): string {
  return `${month.slice(0, 4)}-12-01`
}
