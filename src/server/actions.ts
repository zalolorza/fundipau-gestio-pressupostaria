"use server"

import { del } from "@vercel/blob"
import { and, eq, gte, inArray, ne, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { db } from "@/db"
import {
  clients,
  costCategories,
  invoiceCategories,
  invoiceProjects,
  payrollEntries,
  payrollEntryProjectCategories,
  payrollEntryProjects,
  payrolls,
  projectActivities,
  projectClients,
  projectSubsidies,
  projects,
  subsidies,
  subsidyClients,
  supplierInvoices,
  suppliers,
} from "@/db/schema"
import { requireSession } from "@/lib/auth"
import type { CostType } from "@/lib/cost-type"
import { formatEuro, round2 } from "@/lib/format"
import { funderColumns, parseFunderKey } from "@/lib/funders"
import { computeInvoice } from "@/lib/invoice"
import { isInvoiceFilePathname } from "@/lib/invoice-file"
import { addMonths, endOfYear, monthRange, toMonth } from "@/lib/months"
import { recordRevision, recordRevisionsForIds } from "@/server/revisions"

async function deleteBlobQuietly(pathname: string | null | undefined) {
  if (!pathname || !isInvoiceFilePathname(pathname)) return
  try {
    await del(pathname)
  } catch (e) {
    console.error("No s'ha pogut eliminar l'arxiu del Blob:", e)
  }
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

const optText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
const optDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
const money = z.coerce.number({ error: "Import no vàlid" }).finite()
const pct = z.coerce.number().gt(0, "El percentatge ha de ser més gran que 0").lte(100, "Màxim 100 %")

const costTypeSchema = z.enum(["direct", "indirect"])
const categoryIdsSchema = z.array(z.string().uuid()).default([])
const optionalActivityId = z.string().uuid().nullable().optional()
const optionalFunderId = z
  .string()
  .nullable()
  .optional()
  .refine((v) => v == null || parseFunderKey(v) != null, "Finançador no vàlid")
const allocationSchema = z.array(
  z.object({
    id: z.string().uuid(),
    percentage: pct,
    activityId: optionalActivityId,
    funderId: optionalFunderId,
  })
)
/** Assignació a projecte amb tipus de cost, categories, activitat i finançador (nòmines). */
const payrollAllocationSchema = z.array(
  z.object({
    id: z.string().uuid(),
    percentage: pct,
    costType: costTypeSchema.default("direct"),
    categoryIds: categoryIdsSchema,
    activityId: optionalActivityId,
    funderId: optionalFunderId,
  })
)
type Allocation = z.infer<typeof allocationSchema>[number]
type PayrollAllocation = z.infer<typeof payrollAllocationSchema>[number]

/** Valida que l'activitat (si n'hi ha) pertanyi al projecte. */
async function resolveActivityId(
  projectId: string,
  activityId: string | null | undefined
): Promise<string | null | undefined> {
  if (activityId === undefined) return undefined
  if (activityId === null) return null
  const row = await db.query.projectActivities.findFirst({
    where: and(eq(projectActivities.id, activityId), eq(projectActivities.projectId, projectId)),
    columns: { id: true },
  })
  if (!row) throw new Error("L'activitat no pertany a aquest projecte")
  return row.id
}

/** Valida que el finançador (si n'hi ha) sigui del projecte. */
async function resolveFunder(
  projectId: string,
  funderId: string | null | undefined
): Promise<{ clientId: string | null; subsidyId: string | null } | undefined> {
  if (funderId === undefined) return undefined
  if (funderId === null || funderId === "") return { clientId: null, subsidyId: null }
  const cols = funderColumns(funderId)
  if (cols.clientId) {
    const row = await db.query.projectClients.findFirst({
      where: and(eq(projectClients.projectId, projectId), eq(projectClients.clientId, cols.clientId)),
      columns: { clientId: true },
    })
    if (!row) throw new Error("El finançador no finança aquest projecte")
  } else if (cols.subsidyId) {
    const row = await db.query.projectSubsidies.findFirst({
      where: and(
        eq(projectSubsidies.projectId, projectId),
        eq(projectSubsidies.subsidyId, cols.subsidyId)
      ),
      columns: { subsidyId: true },
    })
    if (!row) throw new Error("La subvenció no finança aquest projecte")
  }
  return cols
}

type ResolvedInvoiceAlloc = {
  projectId: string
  percentage: number
  activityId: string | null
  clientId: string | null
  subsidyId: string | null
}

async function resolveInvoiceAllocations(list: Allocation[]): Promise<ResolvedInvoiceAlloc[]> {
  return Promise.all(
    list.map(async (a) => {
      const activityId = (await resolveActivityId(a.id, a.activityId ?? null)) ?? null
      const funder = (await resolveFunder(a.id, a.funderId ?? null)) ?? {
        clientId: null,
        subsidyId: null,
      }
      return {
        projectId: a.id,
        percentage: a.percentage,
        activityId,
        ...funder,
      }
    })
  )
}

type ResolvedPayrollAlloc = {
  projectId: string
  percentage: number
  costType: CostType
  categoryIds: string[]
  activityId: string | null
  clientId: string | null
  subsidyId: string | null
}

/** Resol activitat i finançador de cada assignació de nòmina. */
async function resolvePayrollAllocations(list: PayrollAllocation[]): Promise<ResolvedPayrollAlloc[]> {
  return Promise.all(
    list.map(async (a) => {
      const activityId = (await resolveActivityId(a.id, a.activityId ?? null)) ?? null
      const funder = (await resolveFunder(a.id, a.funderId ?? null)) ?? {
        clientId: null,
        subsidyId: null,
      }
      return {
        projectId: a.id,
        percentage: a.percentage,
        costType: a.costType,
        categoryIds: a.categoryIds,
        activityId,
        ...funder,
      }
    })
  )
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids)]
}

async function replaceInvoiceCategories(invoiceId: string, categoryIds: string[]) {
  const ids = uniqueIds(categoryIds)
  await db.delete(invoiceCategories).where(eq(invoiceCategories.invoiceId, invoiceId))
  if (ids.length)
    await db.insert(invoiceCategories).values(ids.map((categoryId) => ({ invoiceId, categoryId })))
}

async function replacePayrollAllocationCategories(
  pairs: { allocationId: string; categoryIds: string[] }[]
) {
  if (!pairs.length) return
  const allocationIds = pairs.map((p) => p.allocationId)
  await db
    .delete(payrollEntryProjectCategories)
    .where(inArray(payrollEntryProjectCategories.allocationId, allocationIds))
  const rows = pairs.flatMap((p) =>
    uniqueIds(p.categoryIds).map((categoryId) => ({
      allocationId: p.allocationId,
      categoryId,
    }))
  )
  if (rows.length) await db.insert(payrollEntryProjectCategories).values(rows)
}

/** Insereix assignacions de nòmina i les seves categories; retorna els ids creats. */
async function insertPayrollAllocations(
  rows: {
    entryId: string
    projectId: string
    percentage: number
    costType: CostType
    activityId: string | null
    clientId: string | null
    subsidyId: string | null
    categoryIds: string[]
  }[]
) {
  if (!rows.length) return [] as string[]
  const inserted = await db
    .insert(payrollEntryProjects)
    .values(
      rows.map((r) => ({
        entryId: r.entryId,
        projectId: r.projectId,
        percentage: r.percentage,
        costType: r.costType,
        activityId: r.activityId,
        clientId: r.clientId,
        subsidyId: r.subsidyId,
      }))
    )
    .returning({ id: payrollEntryProjects.id })
  await replacePayrollAllocationCategories(
    inserted.map((row, i) => ({
      allocationId: row.id,
      categoryIds: rows[i]!.categoryIds,
    }))
  )
  return inserted.map((r) => r.id)
}

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Dades no vàlides" }
  console.error(e)
  return { ok: false, error: e instanceof Error ? e.message : "S'ha produït un error" }
}

function checkAllocations(
  list: { id: string; percentage: number }[],
  mode: "exact" | "max",
  opts?: { allowDuplicateIds?: boolean; allowOver100?: boolean }
) {
  if (!opts?.allowDuplicateIds) {
    const ids = new Set(list.map((a) => a.id))
    if (ids.size !== list.length) throw new Error("Hi ha elements repetits a l'assignació")
  }
  if (list.some((a) => a.percentage > 100))
    throw new Error("Cada percentatge ha de ser com a màxim 100 %")
  const sum = round2(list.reduce((s, a) => s + a.percentage, 0))
  if (mode === "exact" && list.length > 0 && sum !== 100)
    throw new Error(`Els percentatges han de sumar 100 % (ara sumen ${sum} %)`)
  if (!opts?.allowOver100 && sum > 100)
    throw new Error(`Els percentatges no poden superar el 100 % (ara sumen ${sum} %)`)
}

/* -------------------------------- Clients -------------------------------- */

const clientSchema = z.object({
  name: z.string().trim().min(1, "El nom és obligatori"),
  legalName: optText,
  taxId: optText,
  address: optText,
  postalCode: optText,
  city: optText,
  province: optText,
  country: optText,
  email: optText,
  notes: optText,
})
export type ClientInput = z.input<typeof clientSchema>

export async function saveClient(id: string | null, input: ClientInput): Promise<ActionResult<{ id: string }>> {
  await requireSession()
  try {
    const data = clientSchema.parse(input)
    let clientId = id
    if (id) await db.update(clients).set(data).where(eq(clients.id, id))
    else [{ id: clientId }] = await db.insert(clients).values(data).returning({ id: clients.id })
    revalidatePath("/financadors")
    revalidatePath(`/financadors/${clientId}`)
    return { ok: true, data: { id: clientId! } }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteClient(id: string) {
  const session = await requireSession()
  await recordRevision({
    entityType: "client",
    entityId: id,
    action: "delete",
    summary: "Eliminació del finançador (amb junctions i finançadors d'assignació)",
    actorUserId: session.user.id,
  })
  await db.delete(clients).where(eq(clients.id, id))
  revalidatePath("/financadors")
  revalidatePath("/subvencions", "layout")
  redirect("/financadors")
}

/* ------------------------------ Subvencions ------------------------------ */

const subsidySchema = z.object({
  name: z.string().trim().min(1, "El nom és obligatori"),
  total: money.min(0, "El total no pot ser negatiu"),
  notes: optText,
})
export type SubsidyInput = z.input<typeof subsidySchema>

export async function saveSubsidy(
  id: string | null,
  input: SubsidyInput,
  clientAllocations?: { id: string; percentage: number }[],
  projectAllocations?: { id: string; percentage: number }[]
): Promise<ActionResult<{ id: string }>> {
  await requireSession()
  try {
    const data = subsidySchema.parse(input)
    if (projectAllocations) {
      await assertProjectAllocationsFitSubsidy(data.total, projectAllocations)
    } else if (id) {
      await assertSubsidyTotalCoversProjects(id, data.total)
    }
    let subsidyId = id
    if (id) await db.update(subsidies).set(data).where(eq(subsidies.id, id))
    else [{ id: subsidyId }] = await db.insert(subsidies).values(data).returning({ id: subsidies.id })

    if (clientAllocations) {
      const res = await setSubsidyClients(subsidyId!, clientAllocations)
      if (!res.ok) return res
    }
    if (projectAllocations) {
      const res = await setSubsidyProjects(subsidyId!, projectAllocations)
      if (!res.ok) return res
    }
    revalidatePath("/subvencions")
    revalidatePath(`/subvencions/${subsidyId}`)
    revalidatePath("/projectes", "layout")
    return { ok: true, data: { id: subsidyId! } }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteSubsidy(id: string) {
  const session = await requireSession()
  await recordRevision({
    entityType: "subsidy",
    entityId: id,
    action: "delete",
    summary: "Eliminació de la subvenció (amb junctions i finançadors d'assignació)",
    actorUserId: session.user.id,
  })
  await db.delete(subsidies).where(eq(subsidies.id, id))
  revalidatePath("/subvencions")
  revalidatePath("/projectes", "layout")
  revalidatePath("/financadors", "layout")
  redirect("/subvencions")
}

/** Repartiment de la subvenció entre clients: no pot superar el 100 % (no cal arribar-hi). */
export async function setSubsidyClients(
  subsidyId: string,
  input: { id: string; percentage: number }[]
): Promise<ActionResult> {
  const session = await requireSession()
  try {
    const list = allocationSchema.parse(input)
    checkAllocations(list, "max")
    await recordRevision({
      entityType: "subsidy",
      entityId: subsidyId,
      action: "replace_relations",
      summary: "Reescriptura dels finançadors de la subvenció",
      actorUserId: session.user.id,
    })
    const del = db.delete(subsidyClients).where(eq(subsidyClients.subsidyId, subsidyId))
    if (list.length)
      await db.batch([
        del,
        db.insert(subsidyClients).values(
          list.map((a) => ({ subsidyId, clientId: a.id, percentage: a.percentage }))
        ),
      ])
    else await del
    revalidatePath(`/subvencions/${subsidyId}`)
    revalidatePath("/subvencions")
    revalidatePath("/financadors", "layout")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/**
 * Projectes finançats per la subvenció.
 * El % és sobre el pressupost de cada projecte; la suma d'imports no pot superar el total.
 * Els altres finançadors del projecte es reescalen per completar el 100 %.
 */
export async function setSubsidyProjects(
  subsidyId: string,
  input: { id: string; percentage: number }[]
): Promise<ActionResult> {
  const session = await requireSession()
  try {
    const list = allocationSchema.parse(input)
    const ids = new Set(list.map((a) => a.id))
    if (ids.size !== list.length) throw new Error("Hi ha projectes repetits a l'assignació")

    const subsidy = await db.query.subsidies.findFirst({
      where: eq(subsidies.id, subsidyId),
      columns: { id: true, total: true },
    })
    if (!subsidy) throw new Error("Subvenció no trobada")
    await assertProjectAllocationsFitSubsidy(subsidy.total, list)

    const current = await db
      .select({ projectId: projectSubsidies.projectId })
      .from(projectSubsidies)
      .where(eq(projectSubsidies.subsidyId, subsidyId))

    for (const row of current) {
      if (!ids.has(row.projectId)) {
        await applySubsidyShareOnProject(row.projectId, subsidyId, null, session.user.id)
      }
    }
    for (const a of list) {
      await applySubsidyShareOnProject(a.id, subsidyId, a.percentage, session.user.id)
    }

    revalidatePath(`/subvencions/${subsidyId}`)
    revalidatePath("/subvencions")
    revalidatePath("/projectes", "layout")
    revalidatePath("/financadors", "layout")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/** Reescriu els finançadors d'un projecte posant/treient aquesta subvenció i reescalant la resta. */
async function applySubsidyShareOnProject(
  projectId: string,
  subsidyId: string,
  percentage: number | null,
  actorUserId: string
) {
  const [clientRows, subsidyRows] = await Promise.all([
    db
      .select({ id: projectClients.clientId, percentage: projectClients.percentage })
      .from(projectClients)
      .where(eq(projectClients.projectId, projectId)),
    db
      .select({ id: projectSubsidies.subsidyId, percentage: projectSubsidies.percentage })
      .from(projectSubsidies)
      .where(eq(projectSubsidies.projectId, projectId)),
  ])

  type Funder = { kind: "client" | "subsidy"; id: string; percentage: number }
  const others: Funder[] = [
    ...clientRows.map((r) => ({ kind: "client" as const, id: r.id, percentage: r.percentage })),
    ...subsidyRows
      .filter((r) => r.id !== subsidyId)
      .map((r) => ({ kind: "subsidy" as const, id: r.id, percentage: r.percentage })),
  ]

  let next: Funder[]
  if (percentage == null) {
    next = scaleFunders(others, 100)
  } else if (others.length === 0) {
    next = [{ kind: "subsidy", id: subsidyId, percentage }]
  } else {
    next = [
      ...scaleFunders(others, round2(100 - percentage)),
      { kind: "subsidy", id: subsidyId, percentage },
    ]
  }

  await recordRevision({
    entityType: "project",
    entityId: projectId,
    action: "replace_relations",
    summary:
      percentage == null
        ? "Reescalat de finançadors en treure una subvenció del projecte"
        : "Reescalat de finançadors en assignar/canviar una subvenció del projecte",
    actorUserId,
  })
  await db.delete(projectClients).where(eq(projectClients.projectId, projectId))
  await db.delete(projectSubsidies).where(eq(projectSubsidies.projectId, projectId))
  const clientsList = next.filter((f) => f.kind === "client")
  const subsidiesList = next.filter((f) => f.kind === "subsidy")
  if (clientsList.length) {
    await db.insert(projectClients).values(
      clientsList.map((a) => ({
        projectId,
        clientId: a.id,
        percentage: a.percentage,
      }))
    )
  }
  if (subsidiesList.length) {
    await db.insert(projectSubsidies).values(
      subsidiesList.map((a) => ({
        projectId,
        subsidyId: a.id,
        percentage: a.percentage,
      }))
    )
  }
  revalidatePath(`/projectes/${projectId}`)
}

/** Reparteix els % perquè sumín exactament `target` (o llista buida si target ≤ 0). */
function scaleFunders<T extends { percentage: number }>(rows: T[], target: number): T[] {
  if (rows.length === 0 || target <= 0) return []
  const current = round2(rows.reduce((s, r) => s + r.percentage, 0))
  if (current <= 0) {
    const each = round2(target / rows.length)
    const out = rows.map((r, i) => ({
      ...r,
      percentage: i === rows.length - 1 ? 0 : each,
    }))
    const head = round2(out.slice(0, -1).reduce((s, r) => s + r.percentage, 0))
    out[out.length - 1]!.percentage = round2(target - head)
    return out.filter((r) => r.percentage > 0)
  }
  const out = rows.map((r) => ({
    ...r,
    percentage: round2((r.percentage / current) * target),
  }))
  const head = round2(out.slice(0, -1).reduce((s, r) => s + r.percentage, 0))
  out[out.length - 1]!.percentage = round2(target - head)
  return out.filter((r) => r.percentage > 0)
}

/* ------------------------------- Projectes ------------------------------- */

/** Import opcional: string buit / null → null. */
const optMoney = z
  .union([z.literal(""), z.null(), z.undefined(), money.min(0, "L'import no pot ser negatiu")])
  .transform((v) => (v === "" || v == null || v === undefined ? null : v))

const projectSchema = z
  .object({
    name: z.string().trim().min(1, "El nom és obligatori"),
    description: optText,
    openedAt: optDate,
    closedAt: optDate,
    maxBudget: money.min(0, "El pressupost no pot ser negatiu"),
    directBudget: optMoney,
    indirectBudget: optMoney,
  })
  .refine((p) => !p.openedAt || !p.closedAt || p.closedAt >= p.openedAt, {
    message: "La data de tancament ha de ser posterior a la d'obertura",
  })
  .superRefine((p, ctx) => {
    const hasD = p.directBudget != null
    const hasI = p.indirectBudget != null
    if (!hasD && !hasI) return
    if (!hasD || !hasI) {
      ctx.addIssue({
        code: "custom",
        message: "Indica tant el pressupost directe com l'indirecte, o cap dels dos",
        path: ["directBudget"],
      })
      return
    }
    if (round2(p.directBudget! + p.indirectBudget!) !== round2(p.maxBudget)) {
      ctx.addIssue({
        code: "custom",
        message: "El pressupost directe i l'indirecte han de sumar el pressupost màxim",
        path: ["directBudget"],
      })
    }
  })
export type ProjectInput = z.input<typeof projectSchema>

export async function saveProject(
  id: string | null,
  input: ProjectInput,
  funderAllocations?: {
    clients?: { id: string; percentage: number }[]
    subsidies?: { id: string; percentage: number }[]
  }
): Promise<ActionResult<{ id: string }>> {
  await requireSession()
  try {
    const data = projectSchema.parse(input)
    if (id) await assertActivityBudgetsFit(id, data.maxBudget)
    if (funderAllocations) {
      await assertSubsidiesCoverProject(
        id,
        data.maxBudget,
        funderAllocations.subsidies ?? []
      )
    } else if (id) {
      await assertExistingProjectSubsidiesFit(id, data.maxBudget)
    }
    let projectId = id
    if (id) await db.update(projects).set(data).where(eq(projects.id, id))
    else [{ id: projectId }] = await db.insert(projects).values(data).returning({ id: projects.id })

    if (funderAllocations) {
      const res = await setProjectFunders(projectId!, funderAllocations)
      if (!res.ok) return res
    }
    revalidatePath("/projectes")
    revalidatePath(`/projectes/${projectId}`)
    revalidatePath("/subvencions", "layout")
    revalidatePath("/")
    return { ok: true, data: { id: projectId! } }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteProject(id: string) {
  const session = await requireSession()
  await recordRevision({
    entityType: "project",
    entityId: id,
    action: "delete",
    summary:
      "Eliminació del projecte (amb finançadors, activitats i assignacions de factures/nòmines)",
    actorUserId: session.user.id,
  })
  await db.delete(projects).where(eq(projects.id, id))
  revalidatePath("/projectes")
  revalidatePath("/")
  redirect("/projectes")
}

/** Repartiment del projecte entre clients i/o subvencions: ha de sumar exactament 100 %. */
export async function setProjectFunders(
  projectId: string,
  input: {
    clients?: { id: string; percentage: number }[]
    subsidies?: { id: string; percentage: number }[]
  }
): Promise<ActionResult> {
  const session = await requireSession()
  try {
    const clientsList = allocationSchema.parse(input.clients ?? [])
    const subsidiesList = allocationSchema.parse(input.subsidies ?? [])
    const combined = [...clientsList, ...subsidiesList]
    const allIds = new Set(combined.map((a) => a.id))
    if (allIds.size !== combined.length)
      throw new Error("Hi ha elements repetits a l'assignació")
    checkAllocations(combined, "exact")

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { maxBudget: true },
    })
    if (!project) throw new Error("Projecte no trobat")
    await assertSubsidiesCoverProject(projectId, project.maxBudget, subsidiesList)

    await recordRevision({
      entityType: "project",
      entityId: projectId,
      action: "replace_relations",
      summary: "Reescriptura dels finançadors del projecte",
      actorUserId: session.user.id,
    })
    await db.delete(projectClients).where(eq(projectClients.projectId, projectId))
    await db.delete(projectSubsidies).where(eq(projectSubsidies.projectId, projectId))
    if (clientsList.length)
      await db.insert(projectClients).values(
        clientsList.map((a) => ({
          projectId,
          clientId: a.id,
          percentage: a.percentage,
        }))
      )
    if (subsidiesList.length)
      await db.insert(projectSubsidies).values(
        subsidiesList.map((a) => ({
          projectId,
          subsidyId: a.id,
          percentage: a.percentage,
        }))
      )
    revalidatePath(`/projectes/${projectId}`)
    revalidatePath("/projectes")
    revalidatePath("/financadors", "layout")
    revalidatePath("/subvencions", "layout")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/** Import que una subvenció aporta a un projecte a partir del % del pressupost. */
function subsidyShareOfProject(projectMaxBudget: number, percentage: number) {
  return round2((projectMaxBudget * percentage) / 100)
}

/** Suma dels imports ja assignats d'una subvenció a projectes (opcionalment excloent-ne un). */
async function subsidyAllocatedAmount(subsidyId: string, excludeProjectId?: string | null) {
  const rows = await db
    .select({
      maxBudget: projects.maxBudget,
      percentage: projectSubsidies.percentage,
    })
    .from(projectSubsidies)
    .innerJoin(projects, eq(projects.id, projectSubsidies.projectId))
    .where(
      and(
        eq(projectSubsidies.subsidyId, subsidyId),
        excludeProjectId ? ne(projectSubsidies.projectId, excludeProjectId) : undefined
      )
    )
  return round2(rows.reduce((s, r) => s + subsidyShareOfProject(r.maxBudget, r.percentage), 0))
}

/** El total de la subvenció ha de cobrir els imports ja assignats als projectes. */
async function assertSubsidyTotalCoversProjects(subsidyId: string, total: number) {
  const allocated = await subsidyAllocatedAmount(subsidyId)
  if (allocated > round2(total)) {
    throw new Error(
      `El total no pot ser inferior a ${formatEuro(allocated)} ja assignats a projectes`
    )
  }
}

/** La suma d'imports (pressupost × %) dels projectes no pot superar el total de la subvenció. */
async function assertProjectAllocationsFitSubsidy(
  total: number,
  allocations: { id: string; percentage: number }[]
) {
  if (!allocations.length) return
  const rows = await db
    .select({ id: projects.id, name: projects.name, maxBudget: projects.maxBudget })
    .from(projects)
    .where(inArray(projects.id, allocations.map((a) => a.id)))
  const byId = new Map(rows.map((r) => [r.id, r]))
  let allocated = 0
  for (const a of allocations) {
    const p = byId.get(a.id)
    if (!p) throw new Error("Projecte no trobat")
    if (a.percentage > 100) {
      throw new Error(`El percentatge del projecte «${p.name}» no pot superar el 100 %`)
    }
    const share = subsidyShareOfProject(p.maxBudget, a.percentage)
    if (share > round2(p.maxBudget)) {
      throw new Error(
        `L'import assignat a «${p.name}» (${formatEuro(share)}) supera el seu pressupost (${formatEuro(p.maxBudget)})`
      )
    }
    allocated = round2(allocated + share)
  }
  if (allocated > round2(total)) {
    throw new Error(
      `Els projectes sumen ${formatEuro(allocated)}, superior al total de la subvenció (${formatEuro(total)})`
    )
  }
}

/** Les subvencions d'aquest projecte no poden superar el seu total restant. */
async function assertSubsidiesCoverProject(
  projectId: string | null,
  projectMaxBudget: number,
  subsidyAllocations: { id: string; percentage: number }[]
) {
  if (!subsidyAllocations.length) return
  for (const a of subsidyAllocations) {
    const subsidy = await db.query.subsidies.findFirst({
      where: eq(subsidies.id, a.id),
      columns: { id: true, name: true, total: true },
    })
    if (!subsidy) throw new Error("Subvenció no trobada")
    const elsewhere = await subsidyAllocatedAmount(subsidy.id, projectId)
    const share = subsidyShareOfProject(projectMaxBudget, a.percentage)
    const needed = round2(elsewhere + share)
    if (needed > round2(subsidy.total)) {
      const available = round2(Math.max(0, subsidy.total - elsewhere))
      throw new Error(
        available > 0
          ? `La subvenció «${subsidy.name}» només té ${formatEuro(available)} disponibles (total ${formatEuro(subsidy.total)})`
          : `La subvenció «${subsidy.name}» ja té tot el total assignat a altres projectes`
      )
    }
  }
}

/** En canviar el pressupost, les subvencions ja assignades encara han de cabre. */
async function assertExistingProjectSubsidiesFit(projectId: string, projectMaxBudget: number) {
  const rows = await db
    .select({
      subsidyId: projectSubsidies.subsidyId,
      percentage: projectSubsidies.percentage,
    })
    .from(projectSubsidies)
    .where(eq(projectSubsidies.projectId, projectId))
  await assertSubsidiesCoverProject(
    projectId,
    projectMaxBudget,
    rows.map((r) => ({ id: r.subsidyId, percentage: r.percentage }))
  )
}

/** @deprecated Usa setProjectFunders. Mantingut per compatibilitat amb l'agent. */
export async function setProjectClients(
  projectId: string,
  input: { id: string; percentage: number }[]
): Promise<ActionResult> {
  return setProjectFunders(projectId, { clients: input, subsidies: [] })
}

/** Afegeix una assignació d'una factura a un projecte (pot haver-n'hi diverses). */
export async function assignInvoiceToProject(
  projectId: string,
  invoiceId: string,
  percentage: number,
  activityId?: string | null,
  funderId?: string | null
): Promise<ActionResult<{ id: string }>> {
  await requireSession()
  try {
    const p = pct.parse(percentage)
    const activity = (await resolveActivityId(projectId, optionalActivityId.parse(activityId) ?? null)) ?? null
    const funder =
      (await resolveFunder(projectId, optionalFunderId.parse(funderId) ?? null)) ?? {
        clientId: null,
        subsidyId: null,
      }
    const [row] = await db
      .insert(invoiceProjects)
      .values({
        invoiceId,
        projectId,
        percentage: p,
        activityId: activity,
        clientId: funder.clientId,
        subsidyId: funder.subsidyId,
      })
      .returning({ id: invoiceProjects.id })
    revalidatePath(`/projectes/${projectId}`)
    revalidatePath("/factures")
    return { ok: true, data: { id: row.id } }
  } catch (e) {
    return fail(e)
  }
}

/** Canvia (o treu) l'activitat d'una assignació de factura. */
export async function setInvoiceProjectActivity(
  allocationId: string,
  activityId: string | null
): Promise<ActionResult> {
  const session = await requireSession()
  try {
    const row = await db.query.invoiceProjects.findFirst({
      where: eq(invoiceProjects.id, allocationId),
      columns: { id: true, projectId: true, invoiceId: true },
    })
    if (!row) throw new Error("Assignació no trobada")
    await recordRevision({
      entityType: "invoice",
      entityId: row.invoiceId,
      action: "replace_relations",
      summary: "Canvi d'activitat d'una assignació de factura",
      actorUserId: session.user.id,
    })
    const activity = (await resolveActivityId(row.projectId, optionalActivityId.parse(activityId) ?? null)) ?? null
    await db.update(invoiceProjects).set({ activityId: activity }).where(eq(invoiceProjects.id, allocationId))
    revalidatePath(`/projectes/${row.projectId}`)
    revalidatePath("/factures")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/** Canvia (o treu) el finançador d'una assignació de factura. */
export async function setInvoiceProjectFunder(
  allocationId: string,
  funderId: string | null
): Promise<ActionResult> {
  const session = await requireSession()
  try {
    const row = await db.query.invoiceProjects.findFirst({
      where: eq(invoiceProjects.id, allocationId),
      columns: { id: true, projectId: true, invoiceId: true },
    })
    if (!row) throw new Error("Assignació no trobada")
    await recordRevision({
      entityType: "invoice",
      entityId: row.invoiceId,
      action: "replace_relations",
      summary: "Canvi de finançador d'una assignació de factura",
      actorUserId: session.user.id,
    })
    const funder =
      (await resolveFunder(row.projectId, optionalFunderId.parse(funderId) ?? null)) ?? {
        clientId: null,
        subsidyId: null,
      }
    await db
      .update(invoiceProjects)
      .set({ clientId: funder.clientId, subsidyId: funder.subsidyId })
      .where(eq(invoiceProjects.id, allocationId))
    revalidatePath(`/projectes/${row.projectId}`)
    revalidatePath("/factures")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

export async function unassignInvoiceAllocation(allocationId: string): Promise<ActionResult> {
  const session = await requireSession()
  const row = await db.query.invoiceProjects.findFirst({
    where: eq(invoiceProjects.id, allocationId),
    columns: { invoiceId: true, projectId: true },
  })
  if (row) {
    await recordRevision({
      entityType: "invoice",
      entityId: row.invoiceId,
      action: "replace_relations",
      summary: "Desassignació d'una llesca de factura a projecte",
      actorUserId: session.user.id,
    })
  }
  const [deleted] = await db
    .delete(invoiceProjects)
    .where(eq(invoiceProjects.id, allocationId))
    .returning({ projectId: invoiceProjects.projectId })
  if (deleted) revalidatePath(`/projectes/${deleted.projectId}`)
  revalidatePath("/factures")
  return { ok: true }
}

/** @deprecated Prefer unassignInvoiceAllocation */
export async function unassignInvoiceFromProject(projectId: string, invoiceId: string): Promise<ActionResult> {
  const session = await requireSession()
  await recordRevision({
    entityType: "invoice",
    entityId: invoiceId,
    action: "replace_relations",
    summary: "Desassignació de factura d'un projecte",
    actorUserId: session.user.id,
  })
  await db
    .delete(invoiceProjects)
    .where(and(eq(invoiceProjects.invoiceId, invoiceId), eq(invoiceProjects.projectId, projectId)))
  revalidatePath(`/projectes/${projectId}`)
  revalidatePath("/factures")
  return { ok: true }
}

/**
 * Assigna una nòmina a un projecte per a un rang de mesos (afegeix files noves).
 * Si manquen registres mensuals, els crea amb l'import del mes més proper
 * (o la quantitat per defecte de la nòmina si encara no n'hi ha cap).
 * Valida que cap mes superi el 100 % assignat.
 */
export async function assignPayrollToProject(
  projectId: string,
  payrollId: string,
  fromMonth: string,
  toMonthValue: string,
  percentage: number,
  costType: CostType = "direct",
  categoryIds: string[] = [],
  activityId?: string | null,
  funderId?: string | null
): Promise<ActionResult<{ count: number }>> {
  await requireSession()
  try {
    const p = pct.parse(percentage)
    const kind = costTypeSchema.parse(costType)
    const cats = categoryIdsSchema.parse(categoryIds)
    const activity = (await resolveActivityId(projectId, optionalActivityId.parse(activityId) ?? null)) ?? null
    const funder =
      (await resolveFunder(projectId, optionalFunderId.parse(funderId) ?? null)) ?? {
        clientId: null,
        subsidyId: null,
      }
    const months = monthRange(fromMonth, toMonthValue)
    if (!months.length) throw new Error("El rang de mesos no és vàlid")

    const payroll = await db.query.payrolls.findFirst({
      where: eq(payrolls.id, payrollId),
      columns: { id: true, monthlyAmount: true },
    })
    if (!payroll) throw new Error("Nòmina no trobada")

    const existing = await db
      .select({ id: payrollEntries.id, month: payrollEntries.month, amount: payrollEntries.amount })
      .from(payrollEntries)
      .where(eq(payrollEntries.payrollId, payrollId))
    const byMonth = new Map(existing.map((e) => [e.month, e]))
    const missing = months.filter((m) => !byMonth.has(m))

    if (missing.length) {
      const monthIndex = (m: string) => {
        const [y, mo] = m.split("-").map(Number)
        return y * 12 + (mo - 1)
      }
      const nearestAmount = (month: string) => {
        if (!existing.length) return payroll.monthlyAmount
        const target = monthIndex(month)
        let best = existing[0]!
        let bestDist = Math.abs(monthIndex(best.month) - target)
        for (let i = 1; i < existing.length; i++) {
          const e = existing[i]!
          const dist = Math.abs(monthIndex(e.month) - target)
          if (dist < bestDist || (dist === bestDist && e.month < best.month)) {
            best = e
            bestDist = dist
          }
        }
        return best.amount
      }
      await db
        .insert(payrollEntries)
        .values(missing.map((month) => ({ payrollId, month, amount: nearestAmount(month) })))
        .onConflictDoNothing()
    }

    const entries = await db
      .select({ id: payrollEntries.id, month: payrollEntries.month })
      .from(payrollEntries)
      .where(and(eq(payrollEntries.payrollId, payrollId), inArray(payrollEntries.month, months)))
    if (!entries.length) throw new Error("No s'han pogut crear els registres mensuals")

    await insertPayrollAllocations(
      entries.map((e) => ({
        entryId: e.id,
        projectId,
        percentage: p,
        costType: kind,
        activityId: activity,
        clientId: funder.clientId,
        subsidyId: funder.subsidyId,
        categoryIds: cats,
      }))
    )
    revalidatePath(`/projectes/${projectId}`)
    revalidatePath(`/nomines/${payrollId}`)
    revalidatePath("/nomines")
    return { ok: true, data: { count: entries.length } }
  } catch (e) {
    return fail(e)
  }
}

export async function unassignPayrollAllocations(allocationIds: string[]): Promise<ActionResult> {
  const session = await requireSession()
  if (!allocationIds.length) return { ok: true }
  const before = await db
    .select({
      entryId: payrollEntryProjects.entryId,
      projectId: payrollEntryProjects.projectId,
    })
    .from(payrollEntryProjects)
    .where(inArray(payrollEntryProjects.id, allocationIds))
  await recordRevisionsForIds({
    entityType: "payroll_entry",
    entityIds: before.map((r) => r.entryId),
    action: "replace_relations",
    summary: "Desassignació d'assignacions de nòmina",
    actorUserId: session.user.id,
  })
  const deleted = await db
    .delete(payrollEntryProjects)
    .where(inArray(payrollEntryProjects.id, allocationIds))
    .returning({ projectId: payrollEntryProjects.projectId })
  for (const p of new Set(deleted.map((d) => d.projectId))) revalidatePath(`/projectes/${p}`)
  revalidatePath("/nomines", "layout")
  return { ok: true }
}

/** @deprecated Prefer unassignPayrollAllocations */
export async function unassignPayrollEntries(projectId: string, entryIds: string[]): Promise<ActionResult> {
  const session = await requireSession()
  if (entryIds.length) {
    await recordRevisionsForIds({
      entityType: "payroll_entry",
      entityIds: entryIds,
      action: "replace_relations",
      summary: "Desassignació d'entrades de nòmina d'un projecte",
      actorUserId: session.user.id,
    })
    await db
      .delete(payrollEntryProjects)
      .where(and(eq(payrollEntryProjects.projectId, projectId), inArray(payrollEntryProjects.entryId, entryIds)))
  }
  revalidatePath(`/projectes/${projectId}`)
  revalidatePath("/nomines", "layout")
  return { ok: true }
}

/** Canvia (o treu) l'activitat d'una assignació de nòmina. */
export async function setPayrollEntryProjectActivity(
  allocationId: string,
  activityId: string | null
): Promise<ActionResult> {
  const session = await requireSession()
  try {
    const row = await db.query.payrollEntryProjects.findFirst({
      where: eq(payrollEntryProjects.id, allocationId),
      columns: { id: true, projectId: true, entryId: true },
    })
    if (!row) throw new Error("Assignació no trobada")
    await recordRevision({
      entityType: "payroll_entry",
      entityId: row.entryId,
      action: "replace_relations",
      summary: "Canvi d'activitat d'una assignació de nòmina",
      actorUserId: session.user.id,
    })
    const activity = (await resolveActivityId(row.projectId, optionalActivityId.parse(activityId) ?? null)) ?? null
    await db
      .update(payrollEntryProjects)
      .set({ activityId: activity })
      .where(eq(payrollEntryProjects.id, allocationId))
    revalidatePath(`/projectes/${row.projectId}`)
    revalidatePath("/nomines", "layout")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/** Canvia (o treu) el finançador d'una assignació de nòmina. */
export async function setPayrollEntryProjectFunder(
  allocationId: string,
  funderId: string | null
): Promise<ActionResult> {
  const session = await requireSession()
  try {
    const row = await db.query.payrollEntryProjects.findFirst({
      where: eq(payrollEntryProjects.id, allocationId),
      columns: { id: true, projectId: true, entryId: true },
    })
    if (!row) throw new Error("Assignació no trobada")
    await recordRevision({
      entityType: "payroll_entry",
      entityId: row.entryId,
      action: "replace_relations",
      summary: "Canvi de finançador d'una assignació de nòmina",
      actorUserId: session.user.id,
    })
    const funder =
      (await resolveFunder(row.projectId, optionalFunderId.parse(funderId) ?? null)) ?? {
        clientId: null,
        subsidyId: null,
      }
    await db
      .update(payrollEntryProjects)
      .set({ clientId: funder.clientId, subsidyId: funder.subsidyId })
      .where(eq(payrollEntryProjects.id, allocationId))
    revalidatePath(`/projectes/${row.projectId}`)
    revalidatePath("/nomines", "layout")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/* ------------------------------- Proveïdors ------------------------------ */

const supplierSchema = z.object({
  name: z.string().trim().min(1, "El nom és obligatori"),
  taxId: optText,
  address: optText,
  postalCode: optText,
  city: optText,
  province: optText,
  country: optText,
  email: optText,
  phone: optText,
  iban: optText,
  defaultVatRate: z.coerce.number().min(0).max(100).default(21),
  defaultIrpfRate: z.coerce.number().min(0).max(100).default(0),
  notes: optText,
})
export type SupplierInput = z.input<typeof supplierSchema>

export async function saveSupplier(
  id: string | null,
  input: SupplierInput
): Promise<ActionResult<{ id: string }>> {
  await requireSession()
  try {
    const data = supplierSchema.parse(input)
    let supplierId = id
    if (id) await db.update(suppliers).set(data).where(eq(suppliers.id, id))
    else [{ id: supplierId }] = await db.insert(suppliers).values(data).returning({ id: suppliers.id })
    revalidatePath("/proveidors")
    revalidatePath(`/proveidors/${supplierId}`)
    revalidatePath("/factures")
    return { ok: true, data: { id: supplierId! } }
  } catch (e) {
    return fail(e)
  }
}

/** Elimina un proveïdor. Les factures es conserven (amb les dades fiscals copiades) però queden sense enllaçar. */
export async function deleteSupplier(id: string) {
  await requireSession()
  await db.delete(suppliers).where(eq(suppliers.id, id))
  revalidatePath("/proveidors")
  revalidatePath("/factures")
  redirect("/proveidors")
}

/* -------------------------------- Factures ------------------------------- */

const invoiceFileSchema = z
  .object({
    filePathname: z.string().min(1),
    fileName: z.string().trim().min(1),
  })
  .nullable()
  .optional()
  .transform((v) => v ?? null)
  .refine((v) => v == null || isInvoiceFilePathname(v.filePathname), {
    message: "Arxiu no vàlid",
  })

const invoiceSchema = z.object({
  number: z.string().trim().min(1, "El número és obligatori"),
  issueDate: z.string().min(1, "La data és obligatòria"),
  description: optText,
  supplierId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  supplierName: z.string().trim().min(1, "El nom del proveïdor és obligatori"),
  supplierTaxId: optText,
  supplierAddress: optText,
  supplierPostalCode: optText,
  supplierCity: optText,
  baseAmount: money,
  vatRate: z.coerce.number().min(0).max(100),
  vatDeductibleRate: z.coerce.number().min(0).max(100),
  irpfRate: z.coerce.number().min(0).max(100),
  costType: costTypeSchema.default("direct"),
  file: invoiceFileSchema,
})
export type InvoiceInput = z.input<typeof invoiceSchema>

export async function saveInvoice(
  id: string | null,
  input: InvoiceInput,
  allocations: {
    id: string
    percentage: number
    activityId?: string | null
    funderId?: string | null
  }[],
  options?: { createSupplier?: boolean; categoryIds?: string[] }
): Promise<ActionResult<{ id: string; supplierId: string | null }>> {
  const session = await requireSession()
  try {
    const parsed = invoiceSchema.parse(input)
    const { file, ...data } = parsed
    const list = allocationSchema.parse(allocations)
    checkAllocations(list, "max", { allowDuplicateIds: true, allowOver100: true })
    const categoryIds = categoryIdsSchema.parse(options?.categoryIds ?? [])
    const resolved = await resolveInvoiceAllocations(list)

    // Crear el proveïdor a partir de les dades de la factura, si es demana
    if (!data.supplierId && options?.createSupplier) {
      const [created] = await db
        .insert(suppliers)
        .values({
          name: data.supplierName,
          taxId: data.supplierTaxId,
          address: data.supplierAddress,
          postalCode: data.supplierPostalCode,
          city: data.supplierCity,
          defaultVatRate: data.vatRate,
          defaultIrpfRate: data.irpfRate,
        })
        .returning({ id: suppliers.id })
      data.supplierId = created.id
      revalidatePath("/proveidors")
    }

    const prev = id
      ? await db.query.supplierInvoices.findFirst({
          where: eq(supplierInvoices.id, id),
          columns: { filePathname: true },
        })
      : undefined

    const values = {
      ...data,
      ...computeInvoice(data.baseAmount, data.vatRate, data.irpfRate),
      filePathname: file?.filePathname ?? null,
      fileName: file?.fileName ?? null,
    }

    let invoiceId = id
    if (id) {
      await recordRevision({
        entityType: "invoice",
        entityId: id,
        action: "replace_relations",
        summary: "Desament de factura (capçalera, categories i assignacions)",
        actorUserId: session.user.id,
      })
      await db.update(supplierInvoices).set(values).where(eq(supplierInvoices.id, id))
    } else {
      ;[{ id: invoiceId }] = await db
        .insert(supplierInvoices)
        .values(values)
        .returning({ id: supplierInvoices.id })
    }

    const clearAlloc = db.delete(invoiceProjects).where(eq(invoiceProjects.invoiceId, invoiceId!))
    if (resolved.length)
      await db.batch([
        clearAlloc,
        db.insert(invoiceProjects).values(
          resolved.map((a) => ({
            invoiceId: invoiceId!,
            projectId: a.projectId,
            percentage: a.percentage,
            activityId: a.activityId,
            clientId: a.clientId,
            subsidyId: a.subsidyId,
          }))
        ),
      ])
    else await clearAlloc

    await replaceInvoiceCategories(invoiceId!, categoryIds)

    if (prev?.filePathname && prev.filePathname !== values.filePathname) {
      await deleteBlobQuietly(prev.filePathname)
    }

    revalidatePath("/factures")
    revalidatePath("/proveidors", "layout")
    revalidatePath("/projectes", "layout")
    revalidatePath("/")
    return { ok: true, data: { id: invoiceId!, supplierId: data.supplierId } }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteInvoice(id: string): Promise<ActionResult> {
  const session = await requireSession()
  await recordRevision({
    entityType: "invoice",
    entityId: id,
    action: "delete",
    summary: "Eliminació de factura (amb categories i assignacions)",
    actorUserId: session.user.id,
  })
  const row = await db.query.supplierInvoices.findFirst({
    where: eq(supplierInvoices.id, id),
    columns: { filePathname: true },
  })
  await db.delete(supplierInvoices).where(eq(supplierInvoices.id, id))
  await deleteBlobQuietly(row?.filePathname)
  revalidatePath("/factures")
  revalidatePath("/proveidors", "layout")
  revalidatePath("/projectes", "layout")
  revalidatePath("/")
  return { ok: true }
}

const invoiceIdsSchema = z.array(z.string().uuid()).min(1, "Selecciona almenys una factura")

const bulkInvoiceSupplierSchema = z.object({
  supplierId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  supplierName: z.string().trim().min(1, "El nom del proveïdor és obligatori"),
  supplierTaxId: optText,
  supplierAddress: optText,
  supplierPostalCode: optText,
  supplierCity: optText,
})

const bulkInvoicePatchSchema = z
  .object({
    supplier: bulkInvoiceSupplierSchema.optional(),
    allocations: allocationSchema.optional(),
    vatRate: z.coerce.number().min(0).max(100).optional(),
    vatDeductibleRate: z.coerce.number().min(0).max(100).optional(),
    irpfRate: z.coerce.number().min(0).max(100).optional(),
    costType: costTypeSchema.optional(),
    categoryIds: categoryIdsSchema.optional(),
  })
  .refine(
    (p) =>
      p.supplier !== undefined ||
      p.allocations !== undefined ||
      p.vatRate !== undefined ||
      p.vatDeductibleRate !== undefined ||
      p.irpfRate !== undefined ||
      p.costType !== undefined ||
      p.categoryIds !== undefined,
    { message: "Indica què vols canviar" }
  )
export type BulkInvoicePatch = z.input<typeof bulkInvoicePatchSchema>

/** Actualitza proveïdor, tipus IVA/IRPF i/o assignació a projectes de diverses factures */
export async function bulkUpdateInvoices(
  ids: string[],
  patch: BulkInvoicePatch
): Promise<ActionResult<{ count: number }>> {
  const session = await requireSession()
  try {
    const invoiceIds = invoiceIdsSchema.parse(ids)
    const data = bulkInvoicePatchSchema.parse(patch)
    if (data.allocations)
      checkAllocations(data.allocations, "max", { allowDuplicateIds: true, allowOver100: true })

    if (data.allocations !== undefined || data.categoryIds !== undefined) {
      await recordRevisionsForIds({
        entityType: "invoice",
        entityIds: invoiceIds,
        action: "replace_relations",
        summary: "Actualització massiva de factures (categories i/o assignacions)",
        actorUserId: session.user.id,
      })
    }

    if (data.supplier) {
      await db
        .update(supplierInvoices)
        .set({
          supplierId: data.supplier.supplierId,
          supplierName: data.supplier.supplierName,
          supplierTaxId: data.supplier.supplierTaxId,
          supplierAddress: data.supplier.supplierAddress,
          supplierPostalCode: data.supplier.supplierPostalCode,
          supplierCity: data.supplier.supplierCity,
        })
        .where(inArray(supplierInvoices.id, invoiceIds))
    }

    if (data.vatDeductibleRate !== undefined) {
      await db
        .update(supplierInvoices)
        .set({ vatDeductibleRate: data.vatDeductibleRate })
        .where(inArray(supplierInvoices.id, invoiceIds))
    }

    if (data.vatRate !== undefined || data.irpfRate !== undefined) {
      const rows = await db
        .select({
          id: supplierInvoices.id,
          baseAmount: supplierInvoices.baseAmount,
          vatRate: supplierInvoices.vatRate,
          irpfRate: supplierInvoices.irpfRate,
        })
        .from(supplierInvoices)
        .where(inArray(supplierInvoices.id, invoiceIds))

      if (rows.length) {
        const updates = rows.map((row) => {
          const vatRate = data.vatRate ?? row.vatRate
          const irpfRate = data.irpfRate ?? row.irpfRate
          return db
            .update(supplierInvoices)
            .set({
              vatRate,
              irpfRate,
              ...computeInvoice(row.baseAmount, vatRate, irpfRate),
            })
            .where(eq(supplierInvoices.id, row.id))
        })
        await db.batch(updates as [typeof updates[number], ...typeof updates[number][]])
      }
    }

    if (data.costType !== undefined) {
      await db
        .update(supplierInvoices)
        .set({ costType: data.costType })
        .where(inArray(supplierInvoices.id, invoiceIds))
    }

    if (data.categoryIds !== undefined) {
      await db.delete(invoiceCategories).where(inArray(invoiceCategories.invoiceId, invoiceIds))
      const ids = uniqueIds(data.categoryIds)
      if (ids.length) {
        await db.insert(invoiceCategories).values(
          invoiceIds.flatMap((invoiceId) => ids.map((categoryId) => ({ invoiceId, categoryId })))
        )
      }
    }

    if (data.allocations) {
      const resolved = await resolveInvoiceAllocations(data.allocations)
      const clear = db.delete(invoiceProjects).where(inArray(invoiceProjects.invoiceId, invoiceIds))
      if (resolved.length) {
        await db.batch([
          clear,
          db.insert(invoiceProjects).values(
            invoiceIds.flatMap((invoiceId) =>
              resolved.map((a) => ({
                invoiceId,
                projectId: a.projectId,
                percentage: a.percentage,
                activityId: a.activityId,
                clientId: a.clientId,
                subsidyId: a.subsidyId,
              }))
            )
          ),
        ])
      } else {
        await clear
      }
    }

    revalidatePath("/factures")
    revalidatePath("/proveidors", "layout")
    revalidatePath("/projectes", "layout")
    revalidatePath("/")
    return { ok: true, data: { count: invoiceIds.length } }
  } catch (e) {
    return fail(e)
  }
}

export async function bulkDeleteInvoices(ids: string[]): Promise<ActionResult<{ count: number }>> {
  const session = await requireSession()
  try {
    const invoiceIds = invoiceIdsSchema.parse(ids)
    await recordRevisionsForIds({
      entityType: "invoice",
      entityIds: invoiceIds,
      action: "delete",
      summary: "Eliminació massiva de factures",
      actorUserId: session.user.id,
    })
    const rows = await db
      .select({ filePathname: supplierInvoices.filePathname })
      .from(supplierInvoices)
      .where(inArray(supplierInvoices.id, invoiceIds))
    await db.delete(supplierInvoices).where(inArray(supplierInvoices.id, invoiceIds))
    await Promise.all(rows.map((r) => deleteBlobQuietly(r.filePathname)))
    revalidatePath("/factures")
    revalidatePath("/proveidors", "layout")
    revalidatePath("/projectes", "layout")
    revalidatePath("/")
    return { ok: true, data: { count: invoiceIds.length } }
  } catch (e) {
    return fail(e)
  }
}

/* -------------------------------- Nòmines -------------------------------- */

export type ChangeScope = "current" | "future" | "all"

const payrollSchema = z
  .object({
    personName: z.string().trim().min(1, "El nom de la persona és obligatori"),
    personTaxId: optText,
    role: optText,
    monthlyAmount: money.min(0, "L'import no pot ser negatiu"),
    startMonth: z.string().min(7, "Indica el mes d'inici"),
    endMonth: optDate,
    notes: optText,
  })
  .transform((p) => ({
    ...p,
    startMonth: toMonth(p.startMonth),
    endMonth: p.endMonth ? toMonth(p.endMonth) : null,
  }))
  .refine((p) => !p.endMonth || p.endMonth >= p.startMonth, {
    message: "El mes final ha de ser posterior al d'inici",
  })
export type PayrollInput = z.input<typeof payrollSchema>

export async function createPayroll(
  input: PayrollInput,
  allocations: {
    id: string
    percentage: number
    costType?: CostType
    categoryIds?: string[]
    activityId?: string | null
    funderId?: string | null
  }[]
): Promise<ActionResult<{ id: string }>> {
  await requireSession()
  try {
    const data = payrollSchema.parse(input)
    const list = await resolvePayrollAllocations(payrollAllocationSchema.parse(allocations))
    checkAllocations(
      list.map((a) => ({ id: a.projectId, percentage: a.percentage })),
      "max",
      { allowDuplicateIds: true, allowOver100: true }
    )
    const [{ id }] = await db.insert(payrolls).values(data).returning({ id: payrolls.id })

    // Generem els registres mensuals: fins al mes final o fins a desembre de l'any d'inici/actual
    const until = data.endMonth ?? endOfYear(data.startMonth > toMonth(new Date()) ? data.startMonth : toMonth(new Date()))
    const months = monthRange(data.startMonth, until)
    const entries = await db
      .insert(payrollEntries)
      .values(months.map((month) => ({ payrollId: id, month, amount: data.monthlyAmount })))
      .returning({ id: payrollEntries.id })
    if (list.length && entries.length) {
      await insertPayrollAllocations(
        entries.flatMap((e) =>
          list.map((a) => ({
            entryId: e.id,
            projectId: a.projectId,
            percentage: a.percentage,
            costType: a.costType,
            activityId: a.activityId,
            clientId: a.clientId,
            subsidyId: a.subsidyId,
            categoryIds: a.categoryIds,
          }))
        )
      )
    }

    revalidatePath("/nomines")
    revalidatePath("/projectes", "layout")
    return { ok: true, data: { id } }
  } catch (e) {
    return fail(e)
  }
}

const payrollInfoSchema = z.object({
  personName: z.string().trim().min(1, "El nom de la persona és obligatori"),
  personTaxId: optText,
  role: optText,
  endMonth: optDate,
  notes: optText,
})

/** Actualitza les dades que no afecten els imports */
export async function updatePayrollInfo(id: string, input: z.input<typeof payrollInfoSchema>): Promise<ActionResult> {
  await requireSession()
  try {
    const data = payrollInfoSchema.parse(input)
    await db
      .update(payrolls)
      .set({ ...data, endMonth: data.endMonth ? toMonth(data.endMonth) : null })
      .where(eq(payrolls.id, id))
    revalidatePath(`/nomines/${id}`)
    revalidatePath("/nomines")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/**
 * Canvia la quantitat mensual d'una nòmina.
 * scope:
 *  - current: només el mes de referència
 *  - future:  el mes de referència i tots els següents (i la quantitat per defecte)
 *  - all:     tots els mesos (i la quantitat per defecte)
 */
export async function changePayrollAmount(
  payrollId: string,
  amountInput: number,
  scope: ChangeScope,
  referenceMonth: string
): Promise<ActionResult<{ count: number }>> {
  await requireSession()
  try {
    const amount = money.min(0).parse(amountInput)
    const ref = toMonth(referenceMonth)
    let count = 0
    if (scope === "current") {
      const r = await db
        .update(payrollEntries)
        .set({ amount })
        .where(and(eq(payrollEntries.payrollId, payrollId), eq(payrollEntries.month, ref)))
        .returning({ id: payrollEntries.id })
      count = r.length
      if (!count) {
        await db.insert(payrollEntries).values({ payrollId, month: ref, amount })
        count = 1
      }
    } else {
      const where =
        scope === "future"
          ? and(eq(payrollEntries.payrollId, payrollId), gte(payrollEntries.month, ref))
          : eq(payrollEntries.payrollId, payrollId)
      const [r] = await db.batch([
        db.update(payrollEntries).set({ amount }).where(where).returning({ id: payrollEntries.id }),
        db.update(payrolls).set({ monthlyAmount: amount }).where(eq(payrolls.id, payrollId)),
      ])
      count = r.length
    }
    revalidatePath(`/nomines/${payrollId}`)
    revalidatePath("/nomines")
    revalidatePath("/projectes", "layout")
    revalidatePath("/financadors", "layout")
    return { ok: true, data: { count } }
  } catch (e) {
    return fail(e)
  }
}

/** Assignació a projectes d'un registre mensual, amb abast */
export async function setPayrollEntryProjects(
  payrollId: string,
  referenceMonth: string,
  scope: ChangeScope,
  input: {
    id: string
    percentage: number
    costType?: CostType
    categoryIds?: string[]
    activityId?: string | null
    funderId?: string | null
  }[]
): Promise<ActionResult<{ count: number }>> {
  const session = await requireSession()
  try {
    const list = await resolvePayrollAllocations(payrollAllocationSchema.parse(input))
    checkAllocations(
      list.map((a) => ({ id: a.projectId, percentage: a.percentage })),
      "max",
      { allowDuplicateIds: true, allowOver100: true }
    )
    const ref = toMonth(referenceMonth)
    const where =
      scope === "current"
        ? and(eq(payrollEntries.payrollId, payrollId), eq(payrollEntries.month, ref))
        : scope === "future"
          ? and(eq(payrollEntries.payrollId, payrollId), gte(payrollEntries.month, ref))
          : eq(payrollEntries.payrollId, payrollId)
    const entries = await db.select({ id: payrollEntries.id }).from(payrollEntries).where(where)
    if (!entries.length) return { ok: true, data: { count: 0 } }
    const ids = entries.map((e) => e.id)

    await recordRevisionsForIds({
      entityType: "payroll_entry",
      entityIds: ids,
      action: "replace_relations",
      summary: `Reescriptura d'assignacions de nòmina (abast: ${scope})`,
      actorUserId: session.user.id,
    })
    await db.delete(payrollEntryProjects).where(inArray(payrollEntryProjects.entryId, ids))
    if (list.length) {
      await insertPayrollAllocations(
        ids.flatMap((entryId) =>
          list.map((a) => ({
            entryId,
            projectId: a.projectId,
            percentage: a.percentage,
            costType: a.costType,
            activityId: a.activityId,
            clientId: a.clientId,
            subsidyId: a.subsidyId,
            categoryIds: a.categoryIds,
          }))
        )
      )
    }

    revalidatePath(`/nomines/${payrollId}`)
    revalidatePath("/nomines")
    revalidatePath("/projectes", "layout")
    return { ok: true, data: { count: ids.length } }
  } catch (e) {
    return fail(e)
  }
}

/** Afegeix registres mensuals fins al mes indicat (copiant l'assignació de l'últim mes) */
export async function extendPayroll(payrollId: string, untilMonth: string): Promise<ActionResult<{ count: number }>> {
  await requireSession()
  try {
    const p = await db.query.payrolls.findFirst({
      where: eq(payrolls.id, payrollId),
      with: {
        entries: {
          orderBy: (e, { desc }) => [desc(e.month)],
          limit: 1,
          with: { projects: { with: { categories: true } } },
        },
      },
    })
    if (!p) throw new Error("Nòmina no trobada")
    const last = p.entries[0]
    const start = last ? addMonths(last.month, 1) : p.startMonth
    const months = monthRange(start, untilMonth)
    if (!months.length) return { ok: true, data: { count: 0 } }

    const created = await db
      .insert(payrollEntries)
      .values(months.map((month) => ({ payrollId, month, amount: p.monthlyAmount })))
      .onConflictDoNothing()
      .returning({ id: payrollEntries.id })
    if (last?.projects.length && created.length) {
      await insertPayrollAllocations(
        created.flatMap((e) =>
          last.projects.map((a) => ({
            entryId: e.id,
            projectId: a.projectId,
            percentage: a.percentage,
            costType: a.costType,
            activityId: a.activityId,
            clientId: a.clientId,
            subsidyId: a.subsidyId,
            categoryIds: a.categories.map((c) => c.categoryId),
          }))
        )
      )
    }
    revalidatePath(`/nomines/${payrollId}`)
    revalidatePath("/nomines")
    return { ok: true, data: { count: created.length } }
  } catch (e) {
    return fail(e)
  }
}

export async function deletePayrollEntry(payrollId: string, entryId: string): Promise<ActionResult> {
  const session = await requireSession()
  await recordRevision({
    entityType: "payroll_entry",
    entityId: entryId,
    action: "delete",
    summary: "Eliminació d'un registre mensual de nòmina",
    actorUserId: session.user.id,
  })
  await db.delete(payrollEntries).where(eq(payrollEntries.id, entryId))
  revalidatePath(`/nomines/${payrollId}`)
  revalidatePath("/nomines")
  revalidatePath("/projectes", "layout")
  return { ok: true }
}

const payrollEntryIdsSchema = z.array(z.string().uuid()).min(1, "Selecciona almenys un mes")

const bulkPayrollEntryPatchSchema = z
  .object({
    amount: money.min(0).optional(),
    allocations: payrollAllocationSchema.optional(),
  })
  .refine((p) => p.amount !== undefined || p.allocations !== undefined, {
    message: "Indica què vols canviar",
  })
export type BulkPayrollEntryPatch = z.input<typeof bulkPayrollEntryPatchSchema>

/** Actualitza quantitat i/o assignació de diversos registres mensuals d'una nòmina */
export async function bulkUpdatePayrollEntries(
  payrollId: string,
  entryIds: string[],
  patch: BulkPayrollEntryPatch
): Promise<ActionResult<{ count: number }>> {
  const session = await requireSession()
  try {
    const ids = payrollEntryIdsSchema.parse(entryIds)
    const data = bulkPayrollEntryPatchSchema.parse(patch)
    if (data.allocations)
      checkAllocations(data.allocations, "max", { allowDuplicateIds: true, allowOver100: true })

    const owned = await db
      .select({ id: payrollEntries.id })
      .from(payrollEntries)
      .where(and(eq(payrollEntries.payrollId, payrollId), inArray(payrollEntries.id, ids)))
    if (owned.length !== ids.length) throw new Error("Algun registre no pertany a aquesta nòmina")
    const ownedIds = owned.map((e) => e.id)

    if (data.allocations) {
      await recordRevisionsForIds({
        entityType: "payroll_entry",
        entityIds: ownedIds,
        action: "replace_relations",
        summary: "Actualització massiva d'assignacions de registres de nòmina",
        actorUserId: session.user.id,
      })
    }

    if (data.amount !== undefined) {
      await db
        .update(payrollEntries)
        .set({ amount: data.amount })
        .where(inArray(payrollEntries.id, ownedIds))
    }

    if (data.allocations) {
      const list = await resolvePayrollAllocations(data.allocations)
      await db.delete(payrollEntryProjects).where(inArray(payrollEntryProjects.entryId, ownedIds))
      if (list.length) {
        await insertPayrollAllocations(
          ownedIds.flatMap((entryId) =>
            list.map((a) => ({
              entryId,
              projectId: a.projectId,
              percentage: a.percentage,
              costType: a.costType,
              activityId: a.activityId,
              clientId: a.clientId,
              subsidyId: a.subsidyId,
              categoryIds: a.categoryIds,
            }))
          )
        )
      }
    }

    revalidatePath(`/nomines/${payrollId}`)
    revalidatePath("/nomines")
    revalidatePath("/projectes", "layout")
    revalidatePath("/financadors", "layout")
    return { ok: true, data: { count: ownedIds.length } }
  } catch (e) {
    return fail(e)
  }
}

export async function bulkDeletePayrollEntries(
  payrollId: string,
  entryIds: string[]
): Promise<ActionResult<{ count: number }>> {
  const session = await requireSession()
  try {
    const ids = payrollEntryIdsSchema.parse(entryIds)
    await recordRevisionsForIds({
      entityType: "payroll_entry",
      entityIds: ids,
      action: "delete",
      summary: "Eliminació massiva de registres mensuals de nòmina",
      actorUserId: session.user.id,
    })
    const deleted = await db
      .delete(payrollEntries)
      .where(and(eq(payrollEntries.payrollId, payrollId), inArray(payrollEntries.id, ids)))
      .returning({ id: payrollEntries.id })
    revalidatePath(`/nomines/${payrollId}`)
    revalidatePath("/nomines")
    revalidatePath("/projectes", "layout")
    revalidatePath("/financadors", "layout")
    return { ok: true, data: { count: deleted.length } }
  } catch (e) {
    return fail(e)
  }
}

export async function deletePayroll(id: string) {
  const session = await requireSession()
  await recordRevision({
    entityType: "payroll",
    entityId: id,
    action: "delete",
    summary: "Eliminació de nòmina (amb tots els registres i assignacions)",
    actorUserId: session.user.id,
  })
  await db.delete(payrolls).where(eq(payrolls.id, id))
  revalidatePath("/nomines")
  revalidatePath("/projectes", "layout")
  redirect("/nomines")
}

/* ------------------------------ Categories ------------------------------- */

const categoryNameSchema = z.string().trim().min(1, "El nom és obligatori").max(80, "Màxim 80 caràcters")

function revalidateCategories() {
  revalidatePath("/ajustos")
  revalidatePath("/factures")
  revalidatePath("/projectes", "layout")
  revalidatePath("/nomines", "layout")
  revalidatePath("/")
}

/** Crea una categoria des del picker (desplegable). */
export async function createCategory(name: string): Promise<ActionResult<{ id: string; name: string }>> {
  await requireSession()
  try {
    const n = categoryNameSchema.parse(name)
    const [max] = await db
      .select({ n: sql<number>`coalesce(max(${costCategories.sortOrder}), 0)::int` })
      .from(costCategories)
    const [row] = await db
      .insert(costCategories)
      .values({ name: n, sortOrder: (max?.n ?? 0) + 1 })
      .returning({ id: costCategories.id, name: costCategories.name })
    revalidateCategories()
    return { ok: true, data: row }
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "23505")
      return { ok: false, error: "Ja existeix una categoria amb aquest nom" }
    return fail(e)
  }
}

export async function renameCategory(
  categoryId: string,
  name: string
): Promise<ActionResult<{ id: string; name: string }>> {
  await requireSession()
  try {
    const n = categoryNameSchema.parse(name)
    const [row] = await db
      .update(costCategories)
      .set({ name: n })
      .where(eq(costCategories.id, categoryId))
      .returning({ id: costCategories.id, name: costCategories.name })
    if (!row) throw new Error("Categoria no trobada")
    revalidateCategories()
    return { ok: true, data: row }
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "23505")
      return { ok: false, error: "Ja existeix una categoria amb aquest nom" }
    return fail(e)
  }
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  await requireSession()
  try {
    const deleted = await db
      .delete(costCategories)
      .where(eq(costCategories.id, categoryId))
      .returning({ id: costCategories.id })
    if (!deleted.length) throw new Error("Categoria no trobada")
    revalidateCategories()
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/* ------------------------------ Activitats ------------------------------- */

const activityNameSchema = z
  .string()
  .trim()
  .min(1, "El nom és obligatori")
  .max(80, "Màxim 80 caràcters")

const activityInputSchema = z.object({
  name: activityNameSchema,
  budget: optMoney,
})
export type ProjectActivityInput = z.input<typeof activityInputSchema>

/** La suma de pressupostos d'activitats no pot superar el del projecte. */
async function assertActivityBudgetsFit(
  projectId: string,
  maxBudget: number,
  opts?: { excludeActivityId?: string; nextBudget?: number | null }
) {
  const [{ sum }] = await db
    .select({
      sum: sql<string>`coalesce(sum(${projectActivities.budget}), 0)`,
    })
    .from(projectActivities)
    .where(
      and(
        eq(projectActivities.projectId, projectId),
        opts?.excludeActivityId
          ? ne(projectActivities.id, opts.excludeActivityId)
          : undefined
      )
    )
  const others = Number(sum)
  const next = opts?.nextBudget ?? 0
  const total = round2(others + (next ?? 0))
  if (total > round2(maxBudget)) {
    const available = round2(Math.max(0, maxBudget - others))
    throw new Error(
      available > 0
        ? `El pressupost de les activitats no pot superar el del projecte (queden ${available} € disponibles)`
        : "El pressupost de les activitats ja cobreix tot el pressupost del projecte"
    )
  }
}

export async function createProjectActivity(
  projectId: string,
  input: ProjectActivityInput
): Promise<ActionResult<{ id: string; name: string; budget: number | null }>> {
  await requireSession()
  try {
    const data = activityInputSchema.parse(input)
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { id: true, maxBudget: true },
    })
    if (!project) throw new Error("Projecte no trobat")
    if (data.budget != null)
      await assertActivityBudgetsFit(projectId, project.maxBudget, { nextBudget: data.budget })
    const [max] = await db
      .select({ n: sql<number>`coalesce(max(${projectActivities.sortOrder}), 0)::int` })
      .from(projectActivities)
      .where(eq(projectActivities.projectId, projectId))
    const [row] = await db
      .insert(projectActivities)
      .values({
        projectId,
        name: data.name,
        budget: data.budget,
        sortOrder: (max?.n ?? 0) + 1,
      })
      .returning({
        id: projectActivities.id,
        name: projectActivities.name,
        budget: projectActivities.budget,
      })
    revalidatePath(`/projectes/${projectId}`)
    return { ok: true, data: row }
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "23505")
      return { ok: false, error: "Ja existeix una activitat amb aquest nom" }
    return fail(e)
  }
}

export async function updateProjectActivity(
  projectId: string,
  activityId: string,
  input: ProjectActivityInput
): Promise<ActionResult<{ id: string; name: string; budget: number | null }>> {
  await requireSession()
  try {
    const data = activityInputSchema.parse(input)
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { id: true, maxBudget: true },
    })
    if (!project) throw new Error("Projecte no trobat")
    if (data.budget != null)
      await assertActivityBudgetsFit(projectId, project.maxBudget, {
        excludeActivityId: activityId,
        nextBudget: data.budget,
      })
    const [row] = await db
      .update(projectActivities)
      .set({ name: data.name, budget: data.budget })
      .where(and(eq(projectActivities.id, activityId), eq(projectActivities.projectId, projectId)))
      .returning({
        id: projectActivities.id,
        name: projectActivities.name,
        budget: projectActivities.budget,
      })
    if (!row) throw new Error("Activitat no trobada")
    revalidatePath(`/projectes/${projectId}`)
    return { ok: true, data: row }
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "23505")
      return { ok: false, error: "Ja existeix una activitat amb aquest nom" }
    return fail(e)
  }
}

export async function deleteProjectActivity(
  projectId: string,
  activityId: string
): Promise<ActionResult> {
  await requireSession()
  try {
    const deleted = await db
      .delete(projectActivities)
      .where(and(eq(projectActivities.id, activityId), eq(projectActivities.projectId, projectId)))
      .returning({ id: projectActivities.id })
    if (!deleted.length) throw new Error("Activitat no trobada")
    revalidatePath(`/projectes/${projectId}`)
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}
