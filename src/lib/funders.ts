export type FunderKind = "client" | "subsidy"

/** Clau composta per a files de finançament mixt (client | subvenció). */
export function funderKey(kind: FunderKind, id: string) {
  return `${kind}:${id}` as const
}

export function parseFunderKey(
  key: string
): { kind: FunderKind; id: string } | null {
  const m = /^(client|subsidy):([0-9a-f-]{36})$/i.exec(key.trim())
  if (!m) return null
  return { kind: m[1] as FunderKind, id: m[2]! }
}

export function splitFunderAllocations(
  rows: { id: string; percentage: number }[]
): {
  clients: { id: string; percentage: number }[]
  subsidies: { id: string; percentage: number }[]
} {
  const clients: { id: string; percentage: number }[] = []
  const subsidies: { id: string; percentage: number }[] = []
  for (const row of rows) {
    const parsed = parseFunderKey(row.id)
    if (!parsed) throw new Error("Finançador no vàlid")
    const item = { id: parsed.id, percentage: row.percentage }
    if (parsed.kind === "client") clients.push(item)
    else subsidies.push(item)
  }
  return { clients, subsidies }
}

/** Columnes client/subvenció a partir d'una clau `client:` / `subsidy:` (o null). */
export function funderColumns(key: string | null | undefined): {
  clientId: string | null
  subsidyId: string | null
} {
  if (key == null || key === "") return { clientId: null, subsidyId: null }
  const parsed = parseFunderKey(key)
  if (!parsed) throw new Error("Finançador no vàlid")
  return parsed.kind === "client"
    ? { clientId: parsed.id, subsidyId: null }
    : { clientId: null, subsidyId: parsed.id }
}

export function funderKeyFromColumns(
  clientId: string | null | undefined,
  subsidyId: string | null | undefined
): string | null {
  if (clientId) return funderKey("client", clientId)
  if (subsidyId) return funderKey("subsidy", subsidyId)
  return null
}
