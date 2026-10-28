/** Tipus de cost imputable (factura o assignació de nòmina a un projecte). */
export const COST_TYPES = ["direct", "indirect"] as const
export type CostType = (typeof COST_TYPES)[number]

export const COST_TYPE_LABELS: Record<CostType, string> = {
  direct: "Directe",
  indirect: "Indirecte",
}

/** Valors del param d'URL `tipus` (català). */
export const COST_TYPE_PARAMS = ["directe", "indirecte"] as const
export type CostTypeParam = (typeof COST_TYPE_PARAMS)[number]

export const costTypeFromParam = (v: string | undefined | null): CostType | undefined =>
  v === "directe" ? "direct" : v === "indirecte" ? "indirect" : undefined

export const costTypeToParam = (t: CostType): CostTypeParam =>
  t === "direct" ? "directe" : "indirecte"

export function isCostType(v: unknown): v is CostType {
  return v === "direct" || v === "indirect"
}
