/** Limita arrays i omet camps pesats dels resultats de tools. */

export function take<T>(items: T[], limit = 15): { items: T[]; truncated: boolean; total: number } {
  const total = items.length
  if (total <= limit) return { items, truncated: false, total }
  return { items: items.slice(0, limit), truncated: true, total }
}

export function omitKeys<T extends Record<string, unknown>>(
  obj: T,
  keys: string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (keys.includes(k)) continue
    out[k] = v
  }
  return out
}
