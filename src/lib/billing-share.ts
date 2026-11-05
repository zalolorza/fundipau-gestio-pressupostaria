import { round2 } from "@/lib/format"

export type ProjectAllocationShare = {
  projectId: string
  percentage: number
}

export type FunderAllocationShare = {
  clientId: string | null
  subsidyId: string | null
  percentage: number
}

/** Mix de finançament d'un projecte (clients + subvencions, suma 100). */
export type ProjectFunderMix = {
  clients: Map<string, number>
  subsidies: Map<string, number>
}

/**
 * % del cost atribuïble a un client dins d'un projecte del residu
 * (directe + via subvencions × subsidy_clients).
 */
export function clientEffectivePctOnProject(
  clientId: string,
  mix: ProjectFunderMix,
  subsidyClientPct: Map<string, number>
): number {
  let pct = mix.clients.get(clientId) ?? 0
  for (const [subsidyId, subsidyPct] of mix.subsidies) {
    const share = subsidyClientPct.get(subsidyId) ?? 0
    if (share > 0) pct = round2(pct + (subsidyPct * share) / 100)
  }
  return pct
}

/** Suma dels % explícits d'una capa de finançadors. */
export function explicitFunderSum(funders: FunderAllocationShare[]): number {
  return round2(funders.reduce((s, f) => s + f.percentage, 0))
}

/**
 * % del cost d'una factura/nòmina que va a un client, desglossat per projecte.
 *
 * - Explícit: % assignat al client (o via subvenció) repartit entre els projectes
 *   de l'assignació que inclouen aquell finançador, ponderat pel % de projecte.
 * - Residu: (100 − explícits) × pes_projecte × %_efectiu_client_al_projecte.
 */
export function clientShareByProject(params: {
  clientId: string
  projects: ProjectAllocationShare[]
  funders: FunderAllocationShare[]
  mixes: Map<string, ProjectFunderMix>
  /** Per cada subvenció explícita o del mix, % del client dins la subvenció. */
  subsidyClientPct: Map<string, number>
}): Map<string, { percentage: number; projectPct: number }> {
  const { clientId, projects, funders, mixes, subsidyClientPct } = params
  const result = new Map<string, { percentage: number; projectPct: number }>()
  const add = (projectId: string, projectPct: number, sharePct: number) => {
    if (sharePct <= 0) return
    const prev = result.get(projectId)
    if (prev) prev.percentage = round2(prev.percentage + sharePct)
    else result.set(projectId, { percentage: round2(sharePct), projectPct })
  }

  const projectSum = round2(projects.reduce((s, p) => s + p.percentage, 0))
  const explicitSum = explicitFunderSum(funders)
  const residual = round2(Math.max(0, 100 - explicitSum))

  // Explícit → projectes que tenen aquest finançador
  for (const f of funders) {
    let attributable = 0
    if (f.clientId === clientId) attributable = f.percentage
    else if (f.subsidyId) {
      const sc = subsidyClientPct.get(f.subsidyId) ?? 0
      if (sc > 0) attributable = round2((f.percentage * sc) / 100)
    }
    if (attributable <= 0) continue

    const eligible = projects.filter((p) => {
      const mix = mixes.get(p.projectId)
      if (!mix) return false
      if (f.clientId) return (mix.clients.get(f.clientId) ?? 0) > 0
      if (f.subsidyId) return (mix.subsidies.get(f.subsidyId) ?? 0) > 0
      return false
    })
    const eligibleSum = round2(eligible.reduce((s, p) => s + p.percentage, 0))
    if (eligibleSum <= 0) continue
    for (const p of eligible) {
      add(p.projectId, p.percentage, round2((attributable * p.percentage) / eligibleSum))
    }
  }

  // Residu → mix dels projectes assignats (pes normalitzat)
  if (residual > 0 && projectSum > 0) {
    for (const p of projects) {
      const mix = mixes.get(p.projectId)
      if (!mix) continue
      const weight = p.percentage / projectSum
      const eff = clientEffectivePctOnProject(clientId, mix, subsidyClientPct)
      add(p.projectId, p.percentage, round2((residual * weight * eff) / 100))
    }
  }

  return result
}

/**
 * % del cost d'una factura/nòmina que va a una subvenció, desglossat per projecte.
 */
export function subsidyShareByProject(params: {
  subsidyId: string
  projects: ProjectAllocationShare[]
  funders: FunderAllocationShare[]
  mixes: Map<string, ProjectFunderMix>
}): Map<string, { percentage: number; projectPct: number }> {
  const { subsidyId, projects, funders, mixes } = params
  const result = new Map<string, { percentage: number; projectPct: number }>()
  const add = (projectId: string, projectPct: number, sharePct: number) => {
    if (sharePct <= 0) return
    const prev = result.get(projectId)
    if (prev) prev.percentage = round2(prev.percentage + sharePct)
    else result.set(projectId, { percentage: round2(sharePct), projectPct })
  }

  const projectSum = round2(projects.reduce((s, p) => s + p.percentage, 0))
  const explicitSum = explicitFunderSum(funders)
  const residual = round2(Math.max(0, 100 - explicitSum))

  for (const f of funders) {
    if (f.subsidyId !== subsidyId) continue
    const eligible = projects.filter((p) => (mixes.get(p.projectId)?.subsidies.get(subsidyId) ?? 0) > 0)
    const eligibleSum = round2(eligible.reduce((s, p) => s + p.percentage, 0))
    if (eligibleSum <= 0) continue
    for (const p of eligible) {
      add(p.projectId, p.percentage, round2((f.percentage * p.percentage) / eligibleSum))
    }
  }

  if (residual > 0 && projectSum > 0) {
    for (const p of projects) {
      const mix = mixes.get(p.projectId)
      if (!mix) continue
      const weight = p.percentage / projectSum
      const subsidyPct = mix.subsidies.get(subsidyId) ?? 0
      add(p.projectId, p.percentage, round2((residual * weight * subsidyPct) / 100))
    }
  }

  return result
}
