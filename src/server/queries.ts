import "server-only"

import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm"

import { db } from "@/db"
import {
  clients,
  costCategories,
  invitations,
  invoiceCategories,
  invoiceFunders,
  invoiceProjects,
  payrollEntries,
  payrollEntryFunders,
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
  user,
} from "@/db/schema"
import {
  clientShareByProject,
  subsidyShareByProject,
  type FunderAllocationShare,
  type ProjectAllocationShare,
  type ProjectFunderMix,
} from "@/lib/billing-share"
import type { CostType } from "@/lib/cost-type"
import { round2 } from "@/lib/format"
import { funderKey, funderKeyFromColumns } from "@/lib/funders"
import { invoiceCost } from "@/lib/invoice"
import { endOfMonth, toMonth } from "@/lib/months"

async function loadProjectFunderMixes(projectIds: string[]): Promise<Map<string, ProjectFunderMix>> {
  const mixes = new Map<string, ProjectFunderMix>()
  for (const id of projectIds) {
    mixes.set(id, { clients: new Map(), subsidies: new Map() })
  }
  if (!projectIds.length) return mixes
  const [clientRows, subsidyRows] = await Promise.all([
    db
      .select({
        projectId: projectClients.projectId,
        clientId: projectClients.clientId,
        percentage: projectClients.percentage,
      })
      .from(projectClients)
      .where(inArray(projectClients.projectId, projectIds)),
    db
      .select({
        projectId: projectSubsidies.projectId,
        subsidyId: projectSubsidies.subsidyId,
        percentage: projectSubsidies.percentage,
      })
      .from(projectSubsidies)
      .where(inArray(projectSubsidies.projectId, projectIds)),
  ])
  for (const r of clientRows) {
    mixes.get(r.projectId)?.clients.set(r.clientId, r.percentage)
  }
  for (const r of subsidyRows) {
    mixes.get(r.projectId)?.subsidies.set(r.subsidyId, r.percentage)
  }
  return mixes
}

export type ProjectCosts = {
  invoices: number
  payroll: number
  total: number
  direct: number
  indirect: number
  invoicesDirect: number
  invoicesIndirect: number
  payrollDirect: number
  payrollIndirect: number
}

export type BudgetProgressBreakdown = {
  direct: number
  indirect: number
}

/** True si el projecte té pressupost desglossat en directe / indirecte. */
export function hasBudgetSplit(p: {
  directBudget: number | null
  indirectBudget: number | null
}): p is { directBudget: number; indirectBudget: number } {
  return p.directBudget != null && p.indirectBudget != null
}

function progressPct(spent: number, budget: number) {
  return budget > 0 ? (spent / budget) * 100 : 0
}

function projectProgress(
  costs: ProjectCosts,
  p: { maxBudget: number; directBudget: number | null; indirectBudget: number | null }
) {
  return {
    progress: progressPct(costs.total, p.maxBudget),
    progressBreakdown: hasBudgetSplit(p)
      ? {
          direct: progressPct(costs.direct, p.directBudget),
          indirect: progressPct(costs.indirect, p.indirectBudget),
        }
      : undefined,
  }
}

const emptyCosts = (): ProjectCosts => ({
  invoices: 0,
  payroll: 0,
  total: 0,
  direct: 0,
  indirect: 0,
  invoicesDirect: 0,
  invoicesIndirect: 0,
  payrollDirect: 0,
  payrollIndirect: 0,
})

/* ------------------------------- Usuaris -------------------------------- */

export async function listUsers() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.name))
}

export async function listPendingInvitations() {
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      token: invitations.token,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
      invitedByName: user.name,
    })
    .from(invitations)
    .innerJoin(user, eq(user.id, invitations.invitedByUserId))
    .where(and(isNull(invitations.acceptedAt), gte(invitations.expiresAt, new Date())))
    .orderBy(desc(invitations.createdAt))
}

export async function getInvitationByToken(token: string) {
  const [row] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1)
  if (!row) return null
  return { ...row, expired: row.expiresAt.getTime() < Date.now() }
}

/* ------------------------------- Opcions -------------------------------- */

export async function getProjectOptions() {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      closedAt: projects.closedAt,
      maxBudget: projects.maxBudget,
    })
    .from(projects)
    .orderBy(asc(projects.name))
}

/** Activitats de tots els projectes (per formularis d'assignació). */
export async function listProjectActivities() {
  return db
    .select({
      id: projectActivities.id,
      projectId: projectActivities.projectId,
      name: projectActivities.name,
    })
    .from(projectActivities)
    .orderBy(asc(projectActivities.sortOrder), asc(projectActivities.name))
}

export type ProjectActivityOption = Awaited<ReturnType<typeof listProjectActivities>>[number]

/** Agrupa activitats per projecte per passar-les a l'editor d'assignacions. */
export function activitiesByProjectMap(
  rows: { id: string; projectId: string; name: string }[]
): Record<string, { id: string; name: string }[]> {
  const map: Record<string, { id: string; name: string }[]> = {}
  for (const a of rows) {
    const list = map[a.projectId] ?? []
    list.push({ id: a.id, name: a.name })
    map[a.projectId] = list
  }
  return map
}

/** Finançadors (clients + subvencions) de tots els projectes. */
export async function listProjectFunders() {
  const [clientRows, subsidyRows] = await Promise.all([
    db
      .select({
        projectId: projectClients.projectId,
        clientId: projectClients.clientId,
        name: clients.name,
      })
      .from(projectClients)
      .innerJoin(clients, eq(clients.id, projectClients.clientId))
      .orderBy(asc(clients.name)),
    db
      .select({
        projectId: projectSubsidies.projectId,
        subsidyId: projectSubsidies.subsidyId,
        name: subsidies.name,
      })
      .from(projectSubsidies)
      .innerJoin(subsidies, eq(subsidies.id, projectSubsidies.subsidyId))
      .orderBy(asc(subsidies.name)),
  ])
  return [
    ...clientRows.map((r) => ({
      projectId: r.projectId,
      id: funderKey("client", r.clientId),
      name: r.name,
    })),
    ...subsidyRows.map((r) => ({
      projectId: r.projectId,
      id: funderKey("subsidy", r.subsidyId),
      name: r.name,
    })),
  ]
}

export type ProjectFunderOption = Awaited<ReturnType<typeof listProjectFunders>>[number]

export function fundersByProjectMap(
  rows: { id: string; projectId: string; name: string }[]
): Record<string, { id: string; name: string }[]> {
  const map: Record<string, { id: string; name: string }[]> = {}
  for (const f of rows) {
    const list = map[f.projectId] ?? []
    list.push({ id: f.id, name: f.name })
    map[f.projectId] = list
  }
  return map
}

export async function getClientOptions() {
  return db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name))
}

export async function getSubsidyOptions(excludeProjectId?: string) {
  const rows = await db
    .select({ id: subsidies.id, name: subsidies.name, total: subsidies.total })
    .from(subsidies)
    .orderBy(asc(subsidies.name))
  if (rows.length === 0) return []

  const allocated = await db
    .select({
      subsidyId: projectSubsidies.subsidyId,
      maxBudget: projects.maxBudget,
      percentage: projectSubsidies.percentage,
    })
    .from(projectSubsidies)
    .innerJoin(projects, eq(projects.id, projectSubsidies.projectId))
    .where(
      excludeProjectId ? ne(projectSubsidies.projectId, excludeProjectId) : undefined
    )

  const elsewhere = new Map<string, number>()
  for (const r of allocated) {
    const share = round2((r.maxBudget * r.percentage) / 100)
    elsewhere.set(r.subsidyId, round2((elsewhere.get(r.subsidyId) ?? 0) + share))
  }

  return rows.map((s) => {
    const used = elsewhere.get(s.id) ?? 0
    return {
      ...s,
      allocatedElsewhere: used,
      available: round2(Math.max(0, s.total - used)),
    }
  })
}

export async function listCategories() {
  return db
    .select({
      id: costCategories.id,
      name: costCategories.name,
      sortOrder: costCategories.sortOrder,
    })
    .from(costCategories)
    .orderBy(asc(costCategories.sortOrder), asc(costCategories.name))
}

export type CategoryOption = Awaited<ReturnType<typeof listCategories>>[number]

export type CategoryTotal = {
  id: string | null
  name: string
  amount: number
}

/* ------------------------------ Costos base ------------------------------ */

/** Cost imputat per projecte (factures + nòmines). Opcionalment filtrat per període. */
async function costsByProject(projectIds?: string[], from?: string, to?: string) {
  const invWhere = [
    projectIds ? inArray(invoiceProjects.projectId, projectIds) : undefined,
    from ? gte(supplierInvoices.issueDate, from) : undefined,
    to ? lte(supplierInvoices.issueDate, endOfMonth(to)) : undefined,
  ].filter(Boolean)
  const payWhere = [
    projectIds ? inArray(payrollEntryProjects.projectId, projectIds) : undefined,
    from ? gte(payrollEntries.month, toMonth(from)) : undefined,
    to ? lte(payrollEntries.month, toMonth(to)) : undefined,
  ].filter(Boolean)

  const [inv, pay] = await Promise.all([
    db
      .select({
        projectId: invoiceProjects.projectId,
        costType: supplierInvoices.costType,
        cost: sql<string>`coalesce(sum((${supplierInvoices.baseAmount} + ${supplierInvoices.vatAmount} * ${supplierInvoices.vatDeductibleRate} / 100) * ${invoiceProjects.percentage} / 100), 0)`,
      })
      .from(invoiceProjects)
      .innerJoin(supplierInvoices, eq(supplierInvoices.id, invoiceProjects.invoiceId))
      .where(and(...invWhere))
      .groupBy(invoiceProjects.projectId, supplierInvoices.costType),
    db
      .select({
        projectId: payrollEntryProjects.projectId,
        costType: payrollEntryProjects.costType,
        cost: sql<string>`coalesce(sum(${payrollEntries.amount} * ${payrollEntryProjects.percentage} / 100), 0)`,
      })
      .from(payrollEntryProjects)
      .innerJoin(payrollEntries, eq(payrollEntries.id, payrollEntryProjects.entryId))
      .where(and(...payWhere))
      .groupBy(payrollEntryProjects.projectId, payrollEntryProjects.costType),
  ])

  const map = new Map<string, ProjectCosts>()
  const get = (id: string) => {
    if (!map.has(id)) map.set(id, emptyCosts())
    return map.get(id)!
  }
  for (const r of inv) {
    const c = get(r.projectId)
    const amount = round2(Number(r.cost))
    c.invoices = round2(c.invoices + amount)
    if (r.costType === "indirect") c.invoicesIndirect = round2(c.invoicesIndirect + amount)
    else c.invoicesDirect = round2(c.invoicesDirect + amount)
  }
  for (const r of pay) {
    const c = get(r.projectId)
    const amount = round2(Number(r.cost))
    c.payroll = round2(c.payroll + amount)
    if (r.costType === "indirect") c.payrollIndirect = round2(c.payrollIndirect + amount)
    else c.payrollDirect = round2(c.payrollDirect + amount)
  }
  for (const v of map.values()) {
    v.total = round2(v.invoices + v.payroll)
    v.direct = round2(v.invoicesDirect + v.payrollDirect)
    v.indirect = round2(v.invoicesIndirect + v.payrollIndirect)
  }
  return map
}

/** Totals per categoria (etiquetes). L'import imputat compta sencer a cada etiqueta. */
async function categoryTotalsByProject(projectIds?: string[], from?: string, to?: string) {
  const invWhere = [
    projectIds ? inArray(invoiceProjects.projectId, projectIds) : undefined,
    from ? gte(supplierInvoices.issueDate, from) : undefined,
    to ? lte(supplierInvoices.issueDate, endOfMonth(to)) : undefined,
  ].filter(Boolean)
  const payWhere = [
    projectIds ? inArray(payrollEntryProjects.projectId, projectIds) : undefined,
    from ? gte(payrollEntries.month, toMonth(from)) : undefined,
    to ? lte(payrollEntries.month, toMonth(to)) : undefined,
  ].filter(Boolean)

  const imputedInv = sql<string>`(${supplierInvoices.baseAmount} + ${supplierInvoices.vatAmount} * ${supplierInvoices.vatDeductibleRate} / 100) * ${invoiceProjects.percentage} / 100`
  const imputedPay = sql<string>`${payrollEntries.amount} * ${payrollEntryProjects.percentage} / 100`

  const [invTagged, invNone, payTagged, payNone] = await Promise.all([
    db
      .select({
        projectId: invoiceProjects.projectId,
        categoryId: invoiceCategories.categoryId,
        name: costCategories.name,
        cost: sql<string>`coalesce(sum(${imputedInv}), 0)`,
      })
      .from(invoiceProjects)
      .innerJoin(supplierInvoices, eq(supplierInvoices.id, invoiceProjects.invoiceId))
      .innerJoin(invoiceCategories, eq(invoiceCategories.invoiceId, supplierInvoices.id))
      .innerJoin(costCategories, eq(costCategories.id, invoiceCategories.categoryId))
      .where(and(...invWhere))
      .groupBy(invoiceProjects.projectId, invoiceCategories.categoryId, costCategories.name),
    db
      .select({
        projectId: invoiceProjects.projectId,
        cost: sql<string>`coalesce(sum(${imputedInv}), 0)`,
      })
      .from(invoiceProjects)
      .innerJoin(supplierInvoices, eq(supplierInvoices.id, invoiceProjects.invoiceId))
      .where(
        and(
          ...invWhere,
          sql`not exists (select 1 from invoice_categories ic where ic.invoice_id = ${supplierInvoices.id})`
        )
      )
      .groupBy(invoiceProjects.projectId),
    db
      .select({
        projectId: payrollEntryProjects.projectId,
        categoryId: payrollEntryProjectCategories.categoryId,
        name: costCategories.name,
        cost: sql<string>`coalesce(sum(${imputedPay}), 0)`,
      })
      .from(payrollEntryProjects)
      .innerJoin(payrollEntries, eq(payrollEntries.id, payrollEntryProjects.entryId))
      .innerJoin(
        payrollEntryProjectCategories,
        eq(payrollEntryProjectCategories.allocationId, payrollEntryProjects.id)
      )
      .innerJoin(costCategories, eq(costCategories.id, payrollEntryProjectCategories.categoryId))
      .where(and(...payWhere))
      .groupBy(
        payrollEntryProjects.projectId,
        payrollEntryProjectCategories.categoryId,
        costCategories.name
      ),
    db
      .select({
        projectId: payrollEntryProjects.projectId,
        cost: sql<string>`coalesce(sum(${imputedPay}), 0)`,
      })
      .from(payrollEntryProjects)
      .innerJoin(payrollEntries, eq(payrollEntries.id, payrollEntryProjects.entryId))
      .where(
        and(
          ...payWhere,
          sql`not exists (
            select 1 from payroll_entry_project_categories pc
            where pc.allocation_id = ${payrollEntryProjects.id}
          )`
        )
      )
      .groupBy(payrollEntryProjects.projectId),
  ])

  const map = new Map<string, Map<string, CategoryTotal>>()
  const get = (projectId: string) => {
    if (!map.has(projectId)) map.set(projectId, new Map())
    return map.get(projectId)!
  }
  const add = (projectId: string, id: string | null, name: string, amount: number) => {
    if (!(amount > 0)) return
    const key = id ?? "__none__"
    const bucket = get(projectId)
    const prev = bucket.get(key)
    if (prev) prev.amount = round2(prev.amount + amount)
    else bucket.set(key, { id, name, amount: round2(amount) })
  }

  for (const r of invTagged) add(r.projectId, r.categoryId, r.name, Number(r.cost))
  for (const r of payTagged) add(r.projectId, r.categoryId, r.name, Number(r.cost))
  for (const r of invNone) add(r.projectId, null, "Sense categoria", Number(r.cost))
  for (const r of payNone) add(r.projectId, null, "Sense categoria", Number(r.cost))

  const out = new Map<string, CategoryTotal[]>()
  for (const [projectId, bucket] of map) {
    const list = [...bucket.values()].sort((a, b) => {
      if (a.id == null) return 1
      if (b.id == null) return -1
      return a.name.localeCompare(b.name)
    })
    out.set(projectId, list)
  }
  return out
}

/** Totals per activitat del projecte. Cada cost compta a una sola activitat (o «Sense activitat»). */
async function activityTotalsByProject(projectIds?: string[], from?: string, to?: string) {
  const invWhere = [
    projectIds ? inArray(invoiceProjects.projectId, projectIds) : undefined,
    from ? gte(supplierInvoices.issueDate, from) : undefined,
    to ? lte(supplierInvoices.issueDate, endOfMonth(to)) : undefined,
  ].filter(Boolean)
  const payWhere = [
    projectIds ? inArray(payrollEntryProjects.projectId, projectIds) : undefined,
    from ? gte(payrollEntries.month, toMonth(from)) : undefined,
    to ? lte(payrollEntries.month, toMonth(to)) : undefined,
  ].filter(Boolean)

  const imputedInv = sql<string>`(${supplierInvoices.baseAmount} + ${supplierInvoices.vatAmount} * ${supplierInvoices.vatDeductibleRate} / 100) * ${invoiceProjects.percentage} / 100`
  const imputedPay = sql<string>`${payrollEntries.amount} * ${payrollEntryProjects.percentage} / 100`

  const [invTagged, invNone, payTagged, payNone] = await Promise.all([
    db
      .select({
        projectId: invoiceProjects.projectId,
        activityId: invoiceProjects.activityId,
        name: projectActivities.name,
        cost: sql<string>`coalesce(sum(${imputedInv}), 0)`,
      })
      .from(invoiceProjects)
      .innerJoin(supplierInvoices, eq(supplierInvoices.id, invoiceProjects.invoiceId))
      .innerJoin(projectActivities, eq(projectActivities.id, invoiceProjects.activityId))
      .where(and(...invWhere))
      .groupBy(invoiceProjects.projectId, invoiceProjects.activityId, projectActivities.name),
    db
      .select({
        projectId: invoiceProjects.projectId,
        cost: sql<string>`coalesce(sum(${imputedInv}), 0)`,
      })
      .from(invoiceProjects)
      .innerJoin(supplierInvoices, eq(supplierInvoices.id, invoiceProjects.invoiceId))
      .where(and(...invWhere, isNull(invoiceProjects.activityId)))
      .groupBy(invoiceProjects.projectId),
    db
      .select({
        projectId: payrollEntryProjects.projectId,
        activityId: payrollEntryProjects.activityId,
        name: projectActivities.name,
        cost: sql<string>`coalesce(sum(${imputedPay}), 0)`,
      })
      .from(payrollEntryProjects)
      .innerJoin(payrollEntries, eq(payrollEntries.id, payrollEntryProjects.entryId))
      .innerJoin(projectActivities, eq(projectActivities.id, payrollEntryProjects.activityId))
      .where(and(...payWhere))
      .groupBy(
        payrollEntryProjects.projectId,
        payrollEntryProjects.activityId,
        projectActivities.name
      ),
    db
      .select({
        projectId: payrollEntryProjects.projectId,
        cost: sql<string>`coalesce(sum(${imputedPay}), 0)`,
      })
      .from(payrollEntryProjects)
      .innerJoin(payrollEntries, eq(payrollEntries.id, payrollEntryProjects.entryId))
      .where(and(...payWhere, isNull(payrollEntryProjects.activityId)))
      .groupBy(payrollEntryProjects.projectId),
  ])

  const map = new Map<string, Map<string, CategoryTotal>>()
  const get = (projectId: string) => {
    if (!map.has(projectId)) map.set(projectId, new Map())
    return map.get(projectId)!
  }
  const add = (projectId: string, id: string | null, name: string, amount: number) => {
    if (!(amount > 0)) return
    const key = id ?? "__none__"
    const bucket = get(projectId)
    const prev = bucket.get(key)
    if (prev) prev.amount = round2(prev.amount + amount)
    else bucket.set(key, { id, name, amount: round2(amount) })
  }

  for (const r of invTagged) {
    if (r.activityId) add(r.projectId, r.activityId, r.name, Number(r.cost))
  }
  for (const r of payTagged) {
    if (r.activityId) add(r.projectId, r.activityId, r.name, Number(r.cost))
  }
  for (const r of invNone) add(r.projectId, null, "Sense activitat", Number(r.cost))
  for (const r of payNone) add(r.projectId, null, "Sense activitat", Number(r.cost))

  const out = new Map<string, CategoryTotal[]>()
  for (const [projectId, bucket] of map) {
    const list = [...bucket.values()].sort((a, b) => {
      if (a.id == null) return 1
      if (b.id == null) return -1
      return a.name.localeCompare(b.name)
    })
    out.set(projectId, list)
  }
  return out
}

/* ------------------------------- Projectes ------------------------------- */

export async function listProjects() {
  const rows = await db.query.projects.findMany({
    orderBy: [desc(projects.openedAt), asc(projects.name)],
    with: {
      clients: { with: { client: { columns: { id: true, name: true } } } },
      subsidies: { with: { subsidy: { columns: { id: true, name: true } } } },
    },
  })
  const costs = await costsByProject()
  return rows.map((p) => {
    const c = costs.get(p.id) ?? emptyCosts()
    return {
      ...p,
      clients: p.clients.map((pc) => ({ ...pc.client, percentage: pc.percentage })),
      subsidies: p.subsidies.map((ps) => ({ ...ps.subsidy, percentage: ps.percentage })),
      costs: c,
      ...projectProgress(c, p),
    }
  })
}

export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number]

export async function getProject(id: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      clients: { with: { client: true } },
      subsidies: {
        with: {
          subsidy: {
            with: {
              clients: {
                with: { client: { columns: { id: true, name: true } } },
              },
            },
          },
        },
      },
    },
  })
  if (!project) return null

  const [invoiceRows, payrollRows, costs, categoryTotalsMap, activities] = await Promise.all([
    db
      .select({
        allocationId: invoiceProjects.id,
        invoice: supplierInvoices,
        percentage: invoiceProjects.percentage,
        activityId: invoiceProjects.activityId,
      })
      .from(invoiceProjects)
      .innerJoin(supplierInvoices, eq(supplierInvoices.id, invoiceProjects.invoiceId))
      .where(eq(invoiceProjects.projectId, id))
      .orderBy(desc(supplierInvoices.issueDate)),
    db
      .select({
        allocationId: payrollEntryProjects.id,
        entryId: payrollEntries.id,
        month: payrollEntries.month,
        amount: payrollEntries.amount,
        payrollId: payrolls.id,
        personName: payrolls.personName,
        role: payrolls.role,
        percentage: payrollEntryProjects.percentage,
        costType: payrollEntryProjects.costType,
        activityId: payrollEntryProjects.activityId,
      })
      .from(payrollEntryProjects)
      .innerJoin(payrollEntries, eq(payrollEntries.id, payrollEntryProjects.entryId))
      .innerJoin(payrolls, eq(payrolls.id, payrollEntries.payrollId))
      .where(eq(payrollEntryProjects.projectId, id))
      .orderBy(desc(payrollEntries.month), asc(payrolls.personName)),
    costsByProject([id]),
    categoryTotalsByProject([id]),
    db
      .select({
        id: projectActivities.id,
        name: projectActivities.name,
        budget: projectActivities.budget,
        sortOrder: projectActivities.sortOrder,
      })
      .from(projectActivities)
      .where(eq(projectActivities.projectId, id))
      .orderBy(asc(projectActivities.sortOrder), asc(projectActivities.name)),
  ])

  const invoiceIds = [...new Set(invoiceRows.map((r) => r.invoice.id))]
  const allocationIds = payrollRows.map((r) => r.allocationId)
  const entryIds = [...new Set(payrollRows.map((r) => r.entryId))]

  const [allAllocations, invoiceFunderRows, payrollFunderRows, invoiceCats, payrollCats] =
    await Promise.all([
      invoiceIds.length === 0
        ? Promise.resolve(
            [] as {
              id: string
              invoiceId: string
              projectId: string
              percentage: number
              activityId: string | null
            }[]
          )
        : db
            .select({
              id: invoiceProjects.id,
              invoiceId: invoiceProjects.invoiceId,
              projectId: invoiceProjects.projectId,
              percentage: invoiceProjects.percentage,
              activityId: invoiceProjects.activityId,
            })
            .from(invoiceProjects)
            .where(inArray(invoiceProjects.invoiceId, invoiceIds)),
      invoiceIds.length === 0
        ? Promise.resolve(
            [] as {
              invoiceId: string
              clientId: string | null
              subsidyId: string | null
              percentage: number
            }[]
          )
        : db
            .select({
              invoiceId: invoiceFunders.invoiceId,
              clientId: invoiceFunders.clientId,
              subsidyId: invoiceFunders.subsidyId,
              percentage: invoiceFunders.percentage,
            })
            .from(invoiceFunders)
            .where(inArray(invoiceFunders.invoiceId, invoiceIds)),
      entryIds.length === 0
        ? Promise.resolve(
            [] as {
              entryId: string
              clientId: string | null
              subsidyId: string | null
              percentage: number
            }[]
          )
        : db
            .select({
              entryId: payrollEntryFunders.entryId,
              clientId: payrollEntryFunders.clientId,
              subsidyId: payrollEntryFunders.subsidyId,
              percentage: payrollEntryFunders.percentage,
            })
            .from(payrollEntryFunders)
            .where(inArray(payrollEntryFunders.entryId, entryIds)),
      invoiceIds.length === 0
        ? Promise.resolve(
            [] as { invoiceId: string; categoryId: string; name: string }[]
          )
        : db
            .select({
              invoiceId: invoiceCategories.invoiceId,
              categoryId: costCategories.id,
              name: costCategories.name,
            })
            .from(invoiceCategories)
            .innerJoin(costCategories, eq(costCategories.id, invoiceCategories.categoryId))
            .where(inArray(invoiceCategories.invoiceId, invoiceIds)),
      allocationIds.length === 0
        ? Promise.resolve(
            [] as { allocationId: string; categoryId: string; name: string }[]
          )
        : db
            .select({
              allocationId: payrollEntryProjectCategories.allocationId,
              categoryId: costCategories.id,
              name: costCategories.name,
            })
            .from(payrollEntryProjectCategories)
            .innerJoin(
              costCategories,
              eq(costCategories.id, payrollEntryProjectCategories.categoryId)
            )
            .where(inArray(payrollEntryProjectCategories.allocationId, allocationIds)),
    ])

  const allocationsByInvoice = new Map<
    string,
    {
      id: string
      percentage: number
      activityId: string | null
    }[]
  >()
  for (const a of allAllocations) {
    const list = allocationsByInvoice.get(a.invoiceId) ?? []
    list.push({
      id: a.projectId,
      percentage: a.percentage,
      activityId: a.activityId,
    })
    allocationsByInvoice.set(a.invoiceId, list)
  }

  const fundersByInvoice = new Map<string, { id: string; percentage: number }[]>()
  for (const f of invoiceFunderRows) {
    const key = funderKeyFromColumns(f.clientId, f.subsidyId)
    if (!key) continue
    const list = fundersByInvoice.get(f.invoiceId) ?? []
    list.push({ id: key, percentage: f.percentage })
    fundersByInvoice.set(f.invoiceId, list)
  }

  const fundersByEntry = new Map<string, { id: string; percentage: number }[]>()
  for (const f of payrollFunderRows) {
    const key = funderKeyFromColumns(f.clientId, f.subsidyId)
    if (!key) continue
    const list = fundersByEntry.get(f.entryId) ?? []
    list.push({ id: key, percentage: f.percentage })
    fundersByEntry.set(f.entryId, list)
  }

  const catsByInvoice = new Map<string, { id: string; name: string }[]>()
  for (const c of invoiceCats) {
    const list = catsByInvoice.get(c.invoiceId) ?? []
    list.push({ id: c.categoryId, name: c.name })
    catsByInvoice.set(c.invoiceId, list)
  }

  const catsByAllocation = new Map<string, { id: string; name: string }[]>()
  for (const c of payrollCats) {
    const list = catsByAllocation.get(c.allocationId) ?? []
    list.push({ id: c.categoryId, name: c.name })
    catsByAllocation.set(c.allocationId, list)
  }

  const activityById = new Map(activities.map((a) => [a.id, a.name]))
  const spentByActivity = new Map<string, number>()

  const invoices = invoiceRows.map((r) => {
    const cost = invoiceCost(r.invoice)
    const categories = (catsByInvoice.get(r.invoice.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
    const imputed = round2((cost * r.percentage) / 100)
    const activityName = r.activityId ? (activityById.get(r.activityId) ?? null) : null
    if (r.activityId) {
      spentByActivity.set(r.activityId, round2((spentByActivity.get(r.activityId) ?? 0) + imputed))
    }
    return {
      ...r.invoice,
      allocationId: r.allocationId,
      cost,
      percentage: r.percentage,
      imputed,
      allocations: allocationsByInvoice.get(r.invoice.id) ?? [],
      funderAllocations: fundersByInvoice.get(r.invoice.id) ?? [],
      categories,
      categoryIds: categories.map((c) => c.id),
      activityId: r.activityId,
      activityName,
    }
  })

  // Agrupem les nòmines per persona
  const byPerson = new Map<
    string,
    {
      payrollId: string
      personName: string
      role: string | null
      total: number
      entries: {
        allocationId: string
        entryId: string
        month: string
        amount: number
        percentage: number
        imputed: number
        costType: CostType
        categories: { id: string; name: string }[]
        categoryIds: string[]
        activityId: string | null
        activityName: string | null
        funderAllocations: { id: string; percentage: number }[]
      }[]
    }
  >()
  for (const r of payrollRows) {
    if (!byPerson.has(r.payrollId))
      byPerson.set(r.payrollId, {
        payrollId: r.payrollId,
        personName: r.personName,
        role: r.role,
        total: 0,
        entries: [],
      })
    const g = byPerson.get(r.payrollId)!
    const imputed = round2((r.amount * r.percentage) / 100)
    const categories = (catsByAllocation.get(r.allocationId) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
    if (r.activityId) {
      spentByActivity.set(r.activityId, round2((spentByActivity.get(r.activityId) ?? 0) + imputed))
    }
    g.entries.push({
      allocationId: r.allocationId,
      entryId: r.entryId,
      month: r.month,
      amount: r.amount,
      percentage: r.percentage,
      imputed,
      costType: r.costType,
      categories,
      categoryIds: categories.map((c) => c.id),
      activityId: r.activityId,
      activityName: r.activityId ? (activityById.get(r.activityId) ?? null) : null,
      funderAllocations: fundersByEntry.get(r.entryId) ?? [],
    })
    g.total = round2(g.total + imputed)
  }

  const c = costs.get(id) ?? emptyCosts()
  return {
    ...project,
    clients: project.clients.map((pc) => ({ ...pc.client, percentage: pc.percentage })),
    subsidies: project.subsidies.map((ps) => {
      const { clients: subsidyClientRows, ...subsidy } = ps.subsidy
      return {
        ...subsidy,
        percentage: ps.percentage,
        clients: subsidyClientRows.map((sc) => ({
          ...sc.client,
          percentage: sc.percentage,
        })),
      }
    }),
    funders: [
      ...project.clients.map((pc) => ({
        id: funderKey("client", pc.client.id),
        name: pc.client.name,
      })),
      ...project.subsidies.map((ps) => ({
        id: funderKey("subsidy", ps.subsidy.id),
        name: ps.subsidy.name,
      })),
    ],
    activities: activities.map((a) => {
      const spent = spentByActivity.get(a.id) ?? 0
      const progress =
        a.budget != null && a.budget > 0 ? round2((spent / a.budget) * 100) : 0
      return { ...a, spent, progress }
    }),
    invoices,
    payroll: [...byPerson.values()],
    costs: c,
    categoryTotals: categoryTotalsMap.get(id) ?? [],
    ...projectProgress(c, project),
  }
}

/** Factures amb el percentatge ja assignat (per triar-ne una a assignar) */
export async function getAssignableInvoices() {
  const rows = await db
    .select({
      id: supplierInvoices.id,
      number: supplierInvoices.number,
      supplierName: supplierInvoices.supplierName,
      issueDate: supplierInvoices.issueDate,
      description: supplierInvoices.description,
      baseAmount: supplierInvoices.baseAmount,
      vatAmount: supplierInvoices.vatAmount,
      vatDeductibleRate: supplierInvoices.vatDeductibleRate,
      assigned: sql<string>`coalesce(sum(${invoiceProjects.percentage}), 0)`,
    })
    .from(supplierInvoices)
    .leftJoin(invoiceProjects, eq(invoiceProjects.invoiceId, supplierInvoices.id))
    .groupBy(supplierInvoices.id)
    .orderBy(desc(supplierInvoices.issueDate))
  return rows.map((r) => ({ ...r, assigned: Number(r.assigned), cost: invoiceCost(r) }))
}

export async function getPayrollOptions() {
  return db
    .select({
      id: payrolls.id,
      personName: payrolls.personName,
      role: payrolls.role,
      monthlyAmount: payrolls.monthlyAmount,
      startMonth: payrolls.startMonth,
      endMonth: payrolls.endMonth,
      lastMonth: sql<string | null>`(select max(${payrollEntries.month}) from ${payrollEntries} where ${payrollEntries.payrollId} = ${payrolls.id})`,
    })
    .from(payrolls)
    .orderBy(asc(payrolls.personName))
}

/* -------------------------------- Clients -------------------------------- */

export async function listClients() {
  const rows = await db.query.clients.findMany({
    orderBy: [asc(clients.name)],
    with: {
      projects: { with: { project: { columns: { id: true, name: true } } } },
      subsidies: { with: { subsidy: { columns: { id: true, name: true } } } },
    },
  })
  return rows
}

export async function getClient(id: string) {
  return db.query.clients.findFirst({
    where: eq(clients.id, id),
    with: {
      projects: { with: { project: true } },
      subsidies: { with: { subsidy: true } },
    },
  })
}

/* ------------------------------ Subvencions ------------------------------ */

export async function listSubsidies() {
  const rows = await db.query.subsidies.findMany({
    orderBy: [asc(subsidies.name)],
    with: {
      clients: { with: { client: { columns: { id: true, name: true } } } },
      projects: {
        with: { project: { columns: { id: true, name: true, maxBudget: true } } },
      },
    },
  })
  return rows.map((s) => {
    const projects = s.projects.map((ps) => {
      const amount = round2((ps.project.maxBudget * ps.percentage) / 100)
      return { ...ps.project, percentage: ps.percentage, amount }
    })
    const allocated = round2(projects.reduce((sum, p) => sum + p.amount, 0))
    return {
      ...s,
      clients: s.clients.map((sc) => ({ ...sc.client, percentage: sc.percentage })),
      projects,
      allocated,
      available: round2(Math.max(0, s.total - allocated)),
    }
  })
}

export async function getSubsidy(id: string) {
  const subsidy = await db.query.subsidies.findFirst({
    where: eq(subsidies.id, id),
    with: {
      clients: { with: { client: true } },
      projects: { with: { project: true } },
    },
  })
  if (!subsidy) return null
  const projects = subsidy.projects.map((ps) => {
    const amount = round2((ps.project.maxBudget * ps.percentage) / 100)
    return {
      ...ps.project,
      percentage: ps.percentage,
      amount,
    }
  })
  const allocated = round2(projects.reduce((s, p) => s + p.amount, 0))
  return {
    ...subsidy,
    clients: subsidy.clients.map((sc) => ({
      ...sc.client,
      percentage: sc.percentage,
    })),
    projects,
    allocated,
    available: round2(Math.max(0, subsidy.total - allocated)),
  }
}

/**
 * Percentatge efectiu d'un client sobre cada projecte:
 * directe (project_clients) + via subvencions (project_subsidies × subsidy_clients).
 */
export async function getClientProjectLinks(clientId: string) {
  const [direct, viaSubsidy] = await Promise.all([
    db
      .select({
        project: projects,
        percentage: projectClients.percentage,
      })
      .from(projectClients)
      .innerJoin(projects, eq(projects.id, projectClients.projectId))
      .where(eq(projectClients.clientId, clientId)),
    db
      .select({
        project: projects,
        projectPct: projectSubsidies.percentage,
        subsidyPct: subsidyClients.percentage,
      })
      .from(subsidyClients)
      .innerJoin(projectSubsidies, eq(projectSubsidies.subsidyId, subsidyClients.subsidyId))
      .innerJoin(projects, eq(projects.id, projectSubsidies.projectId))
      .where(eq(subsidyClients.clientId, clientId)),
  ])

  const map = new Map<string, { project: typeof projects.$inferSelect; percentage: number }>()
  for (const row of direct) {
    map.set(row.project.id, { project: row.project, percentage: row.percentage })
  }
  for (const row of viaSubsidy) {
    const add = round2((row.projectPct * row.subsidyPct) / 100)
    const prev = map.get(row.project.id)
    if (prev) prev.percentage = round2(prev.percentage + add)
    else map.set(row.project.id, { project: row.project, percentage: add })
  }
  return [...map.values()].sort((a, b) => a.project.name.localeCompare(b.project.name))
}

/** Dades per obrir el modal d'edició des de la taula «Per partida». */
export type BillingInvoiceLine = {
  kind: "factura"
  date: string
  concept: string
  detail: string
  cost: number
  projectPct: number
  clientPct: number
  amount: number
  invoice: typeof supplierInvoices.$inferSelect
  allocations: {
    id: string
    percentage: number
    activityId: string | null
  }[]
  funderAllocations: { id: string; percentage: number }[]
  categoryIds: string[]
}

export type BillingPayrollLine = {
  kind: "nomina"
  date: string
  concept: string
  detail: string
  cost: number
  projectPct: number
  clientPct: number
  amount: number
  payrollId: string
  month: string
  allocations: {
    id: string
    percentage: number
    costType: CostType
    categoryIds: string[]
    activityId: string | null
  }[]
  funderAllocations: { id: string; percentage: number }[]
}

export type BillingLine = BillingInvoiceLine | BillingPayrollLine

async function loadBillingLineEdits(invoiceIds: string[], entryIds: string[]) {
  const uniqueInvoices = [...new Set(invoiceIds)]
  const uniqueEntries = [...new Set(entryIds)]

  const [invAllocs, invFunders, invCats, payAllocs, payFunders, payCats] = await Promise.all([
    uniqueInvoices.length === 0
      ? Promise.resolve(
          [] as {
            invoiceId: string
            projectId: string
            percentage: number
            activityId: string | null
          }[]
        )
      : db
          .select({
            invoiceId: invoiceProjects.invoiceId,
            projectId: invoiceProjects.projectId,
            percentage: invoiceProjects.percentage,
            activityId: invoiceProjects.activityId,
          })
          .from(invoiceProjects)
          .where(inArray(invoiceProjects.invoiceId, uniqueInvoices)),
    uniqueInvoices.length === 0
      ? Promise.resolve(
          [] as {
            invoiceId: string
            clientId: string | null
            subsidyId: string | null
            percentage: number
          }[]
        )
      : db
          .select({
            invoiceId: invoiceFunders.invoiceId,
            clientId: invoiceFunders.clientId,
            subsidyId: invoiceFunders.subsidyId,
            percentage: invoiceFunders.percentage,
          })
          .from(invoiceFunders)
          .where(inArray(invoiceFunders.invoiceId, uniqueInvoices)),
    uniqueInvoices.length === 0
      ? Promise.resolve([] as { invoiceId: string; categoryId: string }[])
      : db
          .select({
            invoiceId: invoiceCategories.invoiceId,
            categoryId: invoiceCategories.categoryId,
          })
          .from(invoiceCategories)
          .where(inArray(invoiceCategories.invoiceId, uniqueInvoices)),
    uniqueEntries.length === 0
      ? Promise.resolve(
          [] as {
            entryId: string
            projectId: string
            percentage: number
            costType: CostType
            activityId: string | null
            allocationId: string
          }[]
        )
      : db
          .select({
            entryId: payrollEntryProjects.entryId,
            projectId: payrollEntryProjects.projectId,
            percentage: payrollEntryProjects.percentage,
            costType: payrollEntryProjects.costType,
            activityId: payrollEntryProjects.activityId,
            allocationId: payrollEntryProjects.id,
          })
          .from(payrollEntryProjects)
          .where(inArray(payrollEntryProjects.entryId, uniqueEntries)),
    uniqueEntries.length === 0
      ? Promise.resolve(
          [] as {
            entryId: string
            clientId: string | null
            subsidyId: string | null
            percentage: number
          }[]
        )
      : db
          .select({
            entryId: payrollEntryFunders.entryId,
            clientId: payrollEntryFunders.clientId,
            subsidyId: payrollEntryFunders.subsidyId,
            percentage: payrollEntryFunders.percentage,
          })
          .from(payrollEntryFunders)
          .where(inArray(payrollEntryFunders.entryId, uniqueEntries)),
    uniqueEntries.length === 0
      ? Promise.resolve(
          [] as { allocationId: string; categoryId: string }[]
        )
      : db
          .select({
            allocationId: payrollEntryProjectCategories.allocationId,
            categoryId: payrollEntryProjectCategories.categoryId,
          })
          .from(payrollEntryProjectCategories)
          .innerJoin(
            payrollEntryProjects,
            eq(payrollEntryProjects.id, payrollEntryProjectCategories.allocationId)
          )
          .where(inArray(payrollEntryProjects.entryId, uniqueEntries)),
  ])

  const invoiceAllocations = new Map<string, BillingInvoiceLine["allocations"]>()
  for (const a of invAllocs) {
    const list = invoiceAllocations.get(a.invoiceId) ?? []
    list.push({
      id: a.projectId,
      percentage: a.percentage,
      activityId: a.activityId,
    })
    invoiceAllocations.set(a.invoiceId, list)
  }

  const invoiceFunderAllocations = new Map<string, BillingInvoiceLine["funderAllocations"]>()
  for (const f of invFunders) {
    const key = funderKeyFromColumns(f.clientId, f.subsidyId)
    if (!key) continue
    const list = invoiceFunderAllocations.get(f.invoiceId) ?? []
    list.push({ id: key, percentage: f.percentage })
    invoiceFunderAllocations.set(f.invoiceId, list)
  }

  const invoiceCategoryIds = new Map<string, string[]>()
  for (const c of invCats) {
    const list = invoiceCategoryIds.get(c.invoiceId) ?? []
    list.push(c.categoryId)
    invoiceCategoryIds.set(c.invoiceId, list)
  }

  const catsByAllocation = new Map<string, string[]>()
  for (const c of payCats) {
    const list = catsByAllocation.get(c.allocationId) ?? []
    list.push(c.categoryId)
    catsByAllocation.set(c.allocationId, list)
  }

  const payrollAllocations = new Map<string, BillingPayrollLine["allocations"]>()
  for (const a of payAllocs) {
    const list = payrollAllocations.get(a.entryId) ?? []
    list.push({
      id: a.projectId,
      percentage: a.percentage,
      costType: a.costType,
      categoryIds: catsByAllocation.get(a.allocationId) ?? [],
      activityId: a.activityId,
    })
    payrollAllocations.set(a.entryId, list)
  }

  const payrollFunderAllocations = new Map<string, BillingPayrollLine["funderAllocations"]>()
  for (const f of payFunders) {
    const key = funderKeyFromColumns(f.clientId, f.subsidyId)
    if (!key) continue
    const list = payrollFunderAllocations.get(f.entryId) ?? []
    list.push({ id: key, percentage: f.percentage })
    payrollFunderAllocations.set(f.entryId, list)
  }

  return {
    invoiceAllocations,
    invoiceFunderAllocations,
    invoiceCategoryIds,
    payrollAllocations,
    payrollFunderAllocations,
  }
}

/**
 * Imports que s'haurien de facturar a un client en un període:
 * per a cada projecte del client, costos del període × % del client.
 */
function scaleCosts(c: ProjectCosts, clientPct: number): ProjectCosts {
  const s = (n: number) => round2((n * clientPct) / 100)
  return {
    invoices: s(c.invoices),
    payroll: s(c.payroll),
    total: s(c.total),
    direct: s(c.direct),
    indirect: s(c.indirect),
    invoicesDirect: s(c.invoicesDirect),
    invoicesIndirect: s(c.invoicesIndirect),
    payrollDirect: s(c.payrollDirect),
    payrollIndirect: s(c.payrollIndirect),
  }
}

export async function getClientBilling(clientId: string, from: string, to: string) {
  const links = await getClientProjectLinks(clientId)

  if (links.length === 0) return { projects: [], total: 0 }
  const ids = links.map((l) => l.project.id)
  const linkIds = new Set(ids)

  const [invTouch, payTouch, costsMap, categoryTotalsMap, activityTotalsMap, activityProjects, subsidyShares] =
    await Promise.all([
      db
        .select({
          invoice: supplierInvoices,
        })
        .from(invoiceProjects)
        .innerJoin(supplierInvoices, eq(supplierInvoices.id, invoiceProjects.invoiceId))
        .where(
          and(
            inArray(invoiceProjects.projectId, ids),
            gte(supplierInvoices.issueDate, from),
            lte(supplierInvoices.issueDate, endOfMonth(to))
          )
        )
        .orderBy(asc(supplierInvoices.issueDate)),
      db
        .select({
          entryId: payrollEntries.id,
          month: payrollEntries.month,
          amount: payrollEntries.amount,
          personName: payrolls.personName,
          payrollId: payrolls.id,
        })
        .from(payrollEntryProjects)
        .innerJoin(payrollEntries, eq(payrollEntries.id, payrollEntryProjects.entryId))
        .innerJoin(payrolls, eq(payrolls.id, payrollEntries.payrollId))
        .where(
          and(
            inArray(payrollEntryProjects.projectId, ids),
            gte(payrollEntries.month, toMonth(from)),
            lte(payrollEntries.month, toMonth(to))
          )
        )
        .orderBy(asc(payrollEntries.month), asc(payrolls.personName)),
      costsByProject(ids, from, to),
      categoryTotalsByProject(ids, from, to),
      activityTotalsByProject(ids, from, to),
      db
        .selectDistinct({ projectId: projectActivities.projectId })
        .from(projectActivities)
        .where(inArray(projectActivities.projectId, ids)),
      db
        .select({
          subsidyId: subsidyClients.subsidyId,
          percentage: subsidyClients.percentage,
        })
        .from(subsidyClients)
        .where(eq(subsidyClients.clientId, clientId)),
    ])

  const invoiceById = new Map<string, typeof supplierInvoices.$inferSelect>()
  for (const r of invTouch) invoiceById.set(r.invoice.id, r.invoice)
  const entryById = new Map<
    string,
    {
      entryId: string
      month: string
      amount: number
      personName: string
      payrollId: string
    }
  >()
  for (const r of payTouch) entryById.set(r.entryId, r)

  const invoiceIds = [...invoiceById.keys()]
  const entryIds = [...entryById.keys()]

  const [allInvProjects, allPayProjects, invFunderRows, payFunderRows] = await Promise.all([
    invoiceIds.length === 0
      ? Promise.resolve(
          [] as { invoiceId: string; projectId: string; percentage: number }[]
        )
      : db
          .select({
            invoiceId: invoiceProjects.invoiceId,
            projectId: invoiceProjects.projectId,
            percentage: invoiceProjects.percentage,
          })
          .from(invoiceProjects)
          .where(inArray(invoiceProjects.invoiceId, invoiceIds)),
    entryIds.length === 0
      ? Promise.resolve(
          [] as { entryId: string; projectId: string; percentage: number }[]
        )
      : db
          .select({
            entryId: payrollEntryProjects.entryId,
            projectId: payrollEntryProjects.projectId,
            percentage: payrollEntryProjects.percentage,
          })
          .from(payrollEntryProjects)
          .where(inArray(payrollEntryProjects.entryId, entryIds)),
    invoiceIds.length === 0
      ? Promise.resolve(
          [] as {
            invoiceId: string
            clientId: string | null
            subsidyId: string | null
            percentage: number
          }[]
        )
      : db
          .select({
            invoiceId: invoiceFunders.invoiceId,
            clientId: invoiceFunders.clientId,
            subsidyId: invoiceFunders.subsidyId,
            percentage: invoiceFunders.percentage,
          })
          .from(invoiceFunders)
          .where(inArray(invoiceFunders.invoiceId, invoiceIds)),
    entryIds.length === 0
      ? Promise.resolve(
          [] as {
            entryId: string
            clientId: string | null
            subsidyId: string | null
            percentage: number
          }[]
        )
      : db
          .select({
            entryId: payrollEntryFunders.entryId,
            clientId: payrollEntryFunders.clientId,
            subsidyId: payrollEntryFunders.subsidyId,
            percentage: payrollEntryFunders.percentage,
          })
          .from(payrollEntryFunders)
          .where(inArray(payrollEntryFunders.entryId, entryIds)),
  ])

  const projectsByInvoice = new Map<string, ProjectAllocationShare[]>()
  for (const p of allInvProjects) {
    const list = projectsByInvoice.get(p.invoiceId) ?? []
    list.push({ projectId: p.projectId, percentage: p.percentage })
    projectsByInvoice.set(p.invoiceId, list)
  }
  const projectsByEntry = new Map<string, ProjectAllocationShare[]>()
  for (const p of allPayProjects) {
    const list = projectsByEntry.get(p.entryId) ?? []
    list.push({ projectId: p.projectId, percentage: p.percentage })
    projectsByEntry.set(p.entryId, list)
  }
  const fundersByInvoice = new Map<string, FunderAllocationShare[]>()
  for (const f of invFunderRows) {
    const list = fundersByInvoice.get(f.invoiceId) ?? []
    list.push({ clientId: f.clientId, subsidyId: f.subsidyId, percentage: f.percentage })
    fundersByInvoice.set(f.invoiceId, list)
  }
  const fundersByEntry = new Map<string, FunderAllocationShare[]>()
  for (const f of payFunderRows) {
    const list = fundersByEntry.get(f.entryId) ?? []
    list.push({ clientId: f.clientId, subsidyId: f.subsidyId, percentage: f.percentage })
    fundersByEntry.set(f.entryId, list)
  }

  const mixProjectIds = [
    ...new Set([
      ...allInvProjects.map((p) => p.projectId),
      ...allPayProjects.map((p) => p.projectId),
    ]),
  ]
  const mixes = await loadProjectFunderMixes(mixProjectIds)
  const subsidyClientPct = new Map(subsidyShares.map((s) => [s.subsidyId, s.percentage]))
  const projectsWithActivities = new Set(activityProjects.map((r) => r.projectId))

  const result = links.map((l) => ({
    project: l.project,
    clientPct: l.percentage,
    lines: [] as BillingLine[],
    invoices: 0,
    payroll: 0,
    total: 0,
    costs: scaleCosts(emptyCosts(), l.percentage),
    categoryTotals: [] as CategoryTotal[],
    activityTotals: [] as CategoryTotal[],
    hasActivities: projectsWithActivities.has(l.project.id),
  }))
  const byId = new Map(result.map((r) => [r.project.id, r]))

  const pendingInvoices: {
    group: (typeof result)[number]
    invoice: typeof supplierInvoices.$inferSelect
    projectPct: number
    clientPct: number
    amount: number
    cost: number
  }[] = []
  const pendingPayroll: {
    group: (typeof result)[number]
    entryId: string
    payrollId: string
    month: string
    personName: string
    projectPct: number
    clientPct: number
    amount: number
    cost: number
  }[] = []

  for (const [invoiceId, invoice] of invoiceById) {
    const shares = clientShareByProject({
      clientId,
      projects: projectsByInvoice.get(invoiceId) ?? [],
      funders: fundersByInvoice.get(invoiceId) ?? [],
      mixes,
      subsidyClientPct,
    })
    const cost = invoiceCost(invoice)
    for (const [projectId, share] of shares) {
      if (!linkIds.has(projectId) || share.percentage <= 0) continue
      const g = byId.get(projectId)!
      const amount = round2((cost * share.percentage) / 100)
      const projectPct = share.projectPct
      const clientPct = projectPct > 0 ? round2((share.percentage / projectPct) * 100) : 0
      pendingInvoices.push({
        group: g,
        invoice,
        projectPct,
        clientPct,
        amount,
        cost,
      })
      g.invoices = round2(g.invoices + amount)
    }
  }

  for (const [entryId, entry] of entryById) {
    const shares = clientShareByProject({
      clientId,
      projects: projectsByEntry.get(entryId) ?? [],
      funders: fundersByEntry.get(entryId) ?? [],
      mixes,
      subsidyClientPct,
    })
    for (const [projectId, share] of shares) {
      if (!linkIds.has(projectId) || share.percentage <= 0) continue
      const g = byId.get(projectId)!
      const amount = round2((entry.amount * share.percentage) / 100)
      const projectPct = share.projectPct
      const clientPct = projectPct > 0 ? round2((share.percentage / projectPct) * 100) : 0
      pendingPayroll.push({
        group: g,
        entryId,
        payrollId: entry.payrollId,
        month: entry.month,
        personName: entry.personName,
        projectPct,
        clientPct,
        amount,
        cost: entry.amount,
      })
      g.payroll = round2(g.payroll + amount)
    }
  }

  const edits = await loadBillingLineEdits(
    pendingInvoices.map((p) => p.invoice.id),
    pendingPayroll.map((p) => p.entryId)
  )

  for (const p of pendingInvoices) {
    p.group.lines.push({
      kind: "factura",
      date: p.invoice.issueDate,
      concept: `${p.invoice.supplierName} · ${p.invoice.number}`,
      detail: p.invoice.description ?? "",
      cost: p.cost,
      projectPct: p.projectPct,
      clientPct: p.clientPct,
      amount: p.amount,
      invoice: p.invoice,
      allocations: edits.invoiceAllocations.get(p.invoice.id) ?? [],
      funderAllocations: edits.invoiceFunderAllocations.get(p.invoice.id) ?? [],
      categoryIds: edits.invoiceCategoryIds.get(p.invoice.id) ?? [],
    })
  }
  for (const p of pendingPayroll) {
    p.group.lines.push({
      kind: "nomina",
      date: p.month,
      concept: `Nòmina · ${p.personName}`,
      detail: "",
      cost: p.cost,
      projectPct: p.projectPct,
      clientPct: p.clientPct,
      amount: p.amount,
      payrollId: p.payrollId,
      month: p.month,
      allocations: edits.payrollAllocations.get(p.entryId) ?? [],
      funderAllocations: edits.payrollFunderAllocations.get(p.entryId) ?? [],
    })
  }

  for (const g of result) {
    g.total = round2(g.invoices + g.payroll)
    g.lines.sort((a, b) => a.date.localeCompare(b.date))
    const projectCosts = costsMap.get(g.project.id) ?? emptyCosts()
    const ratio =
      projectCosts.total > 0 ? round2((g.total / projectCosts.total) * 100) : g.clientPct
    g.costs = scaleCosts(projectCosts, ratio)
    g.categoryTotals = (categoryTotalsMap.get(g.project.id) ?? []).map((row) => ({
      ...row,
      amount: round2((row.amount * ratio) / 100),
    }))
    g.activityTotals = (activityTotalsMap.get(g.project.id) ?? []).map((row) => ({
      ...row,
      amount: round2((row.amount * ratio) / 100),
    }))
  }
  return { projects: result, total: round2(result.reduce((s, g) => s + g.total, 0)) }
}

export type ClientBillingProject = Awaited<
  ReturnType<typeof getClientBilling>
>["projects"][number]

/**
 * Costos imputats a una subvenció (sense filtre temporal):
 * per a cada projecte finançat, costos × % de la subvenció (o 100 % si el finançador és explícit).
 */
export async function getSubsidyBilling(subsidyId: string) {
  const links = await db
    .select({
      project: projects,
      percentage: projectSubsidies.percentage,
    })
    .from(projectSubsidies)
    .innerJoin(projects, eq(projects.id, projectSubsidies.projectId))
    .where(eq(projectSubsidies.subsidyId, subsidyId))
    .orderBy(asc(projects.name))

  if (links.length === 0) return { projects: [], total: 0 }
  const ids = links.map((l) => l.project.id)
  const linkIds = new Set(ids)

  const [invTouch, payTouch, costsMap, categoryTotalsMap, activityTotalsMap, activityProjects] =
    await Promise.all([
      db
        .select({
          invoice: supplierInvoices,
        })
        .from(invoiceProjects)
        .innerJoin(supplierInvoices, eq(supplierInvoices.id, invoiceProjects.invoiceId))
        .where(inArray(invoiceProjects.projectId, ids))
        .orderBy(asc(supplierInvoices.issueDate)),
      db
        .select({
          entryId: payrollEntries.id,
          month: payrollEntries.month,
          amount: payrollEntries.amount,
          personName: payrolls.personName,
          payrollId: payrolls.id,
        })
        .from(payrollEntryProjects)
        .innerJoin(payrollEntries, eq(payrollEntries.id, payrollEntryProjects.entryId))
        .innerJoin(payrolls, eq(payrolls.id, payrollEntries.payrollId))
        .where(inArray(payrollEntryProjects.projectId, ids))
        .orderBy(asc(payrollEntries.month), asc(payrolls.personName)),
      costsByProject(ids),
      categoryTotalsByProject(ids),
      activityTotalsByProject(ids),
      db
        .selectDistinct({ projectId: projectActivities.projectId })
        .from(projectActivities)
        .where(inArray(projectActivities.projectId, ids)),
    ])

  const invoiceById = new Map<string, typeof supplierInvoices.$inferSelect>()
  for (const r of invTouch) invoiceById.set(r.invoice.id, r.invoice)
  const entryById = new Map<
    string,
    {
      entryId: string
      month: string
      amount: number
      personName: string
      payrollId: string
    }
  >()
  for (const r of payTouch) entryById.set(r.entryId, r)

  const invoiceIds = [...invoiceById.keys()]
  const entryIds = [...entryById.keys()]

  const [allInvProjects, allPayProjects, invFunderRows, payFunderRows] = await Promise.all([
    invoiceIds.length === 0
      ? Promise.resolve(
          [] as { invoiceId: string; projectId: string; percentage: number }[]
        )
      : db
          .select({
            invoiceId: invoiceProjects.invoiceId,
            projectId: invoiceProjects.projectId,
            percentage: invoiceProjects.percentage,
          })
          .from(invoiceProjects)
          .where(inArray(invoiceProjects.invoiceId, invoiceIds)),
    entryIds.length === 0
      ? Promise.resolve(
          [] as { entryId: string; projectId: string; percentage: number }[]
        )
      : db
          .select({
            entryId: payrollEntryProjects.entryId,
            projectId: payrollEntryProjects.projectId,
            percentage: payrollEntryProjects.percentage,
          })
          .from(payrollEntryProjects)
          .where(inArray(payrollEntryProjects.entryId, entryIds)),
    invoiceIds.length === 0
      ? Promise.resolve(
          [] as {
            invoiceId: string
            clientId: string | null
            subsidyId: string | null
            percentage: number
          }[]
        )
      : db
          .select({
            invoiceId: invoiceFunders.invoiceId,
            clientId: invoiceFunders.clientId,
            subsidyId: invoiceFunders.subsidyId,
            percentage: invoiceFunders.percentage,
          })
          .from(invoiceFunders)
          .where(inArray(invoiceFunders.invoiceId, invoiceIds)),
    entryIds.length === 0
      ? Promise.resolve(
          [] as {
            entryId: string
            clientId: string | null
            subsidyId: string | null
            percentage: number
          }[]
        )
      : db
          .select({
            entryId: payrollEntryFunders.entryId,
            clientId: payrollEntryFunders.clientId,
            subsidyId: payrollEntryFunders.subsidyId,
            percentage: payrollEntryFunders.percentage,
          })
          .from(payrollEntryFunders)
          .where(inArray(payrollEntryFunders.entryId, entryIds)),
  ])

  const projectsByInvoice = new Map<string, ProjectAllocationShare[]>()
  for (const p of allInvProjects) {
    const list = projectsByInvoice.get(p.invoiceId) ?? []
    list.push({ projectId: p.projectId, percentage: p.percentage })
    projectsByInvoice.set(p.invoiceId, list)
  }
  const projectsByEntry = new Map<string, ProjectAllocationShare[]>()
  for (const p of allPayProjects) {
    const list = projectsByEntry.get(p.entryId) ?? []
    list.push({ projectId: p.projectId, percentage: p.percentage })
    projectsByEntry.set(p.entryId, list)
  }
  const fundersByInvoice = new Map<string, FunderAllocationShare[]>()
  for (const f of invFunderRows) {
    const list = fundersByInvoice.get(f.invoiceId) ?? []
    list.push({ clientId: f.clientId, subsidyId: f.subsidyId, percentage: f.percentage })
    fundersByInvoice.set(f.invoiceId, list)
  }
  const fundersByEntry = new Map<string, FunderAllocationShare[]>()
  for (const f of payFunderRows) {
    const list = fundersByEntry.get(f.entryId) ?? []
    list.push({ clientId: f.clientId, subsidyId: f.subsidyId, percentage: f.percentage })
    fundersByEntry.set(f.entryId, list)
  }

  const mixProjectIds = [
    ...new Set([
      ...allInvProjects.map((p) => p.projectId),
      ...allPayProjects.map((p) => p.projectId),
    ]),
  ]
  const mixes = await loadProjectFunderMixes(mixProjectIds)
  const projectsWithActivities = new Set(activityProjects.map((r) => r.projectId))

  const result = links.map((l) => ({
    project: l.project,
    clientPct: l.percentage,
    lines: [] as BillingLine[],
    invoices: 0,
    payroll: 0,
    total: 0,
    costs: scaleCosts(emptyCosts(), l.percentage),
    categoryTotals: [] as CategoryTotal[],
    activityTotals: [] as CategoryTotal[],
    hasActivities: projectsWithActivities.has(l.project.id),
  }))
  const byId = new Map(result.map((r) => [r.project.id, r]))

  const pendingInvoices: {
    group: (typeof result)[number]
    invoice: typeof supplierInvoices.$inferSelect
    projectPct: number
    clientPct: number
    amount: number
    cost: number
  }[] = []
  const pendingPayroll: {
    group: (typeof result)[number]
    entryId: string
    payrollId: string
    month: string
    personName: string
    projectPct: number
    clientPct: number
    amount: number
    cost: number
  }[] = []

  for (const [invoiceId, invoice] of invoiceById) {
    const shares = subsidyShareByProject({
      subsidyId,
      projects: projectsByInvoice.get(invoiceId) ?? [],
      funders: fundersByInvoice.get(invoiceId) ?? [],
      mixes,
    })
    const cost = invoiceCost(invoice)
    for (const [projectId, share] of shares) {
      if (!linkIds.has(projectId) || share.percentage <= 0) continue
      const g = byId.get(projectId)!
      const amount = round2((cost * share.percentage) / 100)
      const projectPct = share.projectPct
      const clientPct = projectPct > 0 ? round2((share.percentage / projectPct) * 100) : 0
      pendingInvoices.push({
        group: g,
        invoice,
        projectPct,
        clientPct,
        amount,
        cost,
      })
      g.invoices = round2(g.invoices + amount)
    }
  }

  for (const [entryId, entry] of entryById) {
    const shares = subsidyShareByProject({
      subsidyId,
      projects: projectsByEntry.get(entryId) ?? [],
      funders: fundersByEntry.get(entryId) ?? [],
      mixes,
    })
    for (const [projectId, share] of shares) {
      if (!linkIds.has(projectId) || share.percentage <= 0) continue
      const g = byId.get(projectId)!
      const amount = round2((entry.amount * share.percentage) / 100)
      const projectPct = share.projectPct
      const clientPct = projectPct > 0 ? round2((share.percentage / projectPct) * 100) : 0
      pendingPayroll.push({
        group: g,
        entryId,
        payrollId: entry.payrollId,
        month: entry.month,
        personName: entry.personName,
        projectPct,
        clientPct,
        amount,
        cost: entry.amount,
      })
      g.payroll = round2(g.payroll + amount)
    }
  }

  const edits = await loadBillingLineEdits(
    pendingInvoices.map((p) => p.invoice.id),
    pendingPayroll.map((p) => p.entryId)
  )

  for (const p of pendingInvoices) {
    p.group.lines.push({
      kind: "factura",
      date: p.invoice.issueDate,
      concept: `${p.invoice.supplierName} · ${p.invoice.number}`,
      detail: p.invoice.description ?? "",
      cost: p.cost,
      projectPct: p.projectPct,
      clientPct: p.clientPct,
      amount: p.amount,
      invoice: p.invoice,
      allocations: edits.invoiceAllocations.get(p.invoice.id) ?? [],
      funderAllocations: edits.invoiceFunderAllocations.get(p.invoice.id) ?? [],
      categoryIds: edits.invoiceCategoryIds.get(p.invoice.id) ?? [],
    })
  }
  for (const p of pendingPayroll) {
    p.group.lines.push({
      kind: "nomina",
      date: p.month,
      concept: `Nòmina · ${p.personName}`,
      detail: "",
      cost: p.cost,
      projectPct: p.projectPct,
      clientPct: p.clientPct,
      amount: p.amount,
      payrollId: p.payrollId,
      month: p.month,
      allocations: edits.payrollAllocations.get(p.entryId) ?? [],
      funderAllocations: edits.payrollFunderAllocations.get(p.entryId) ?? [],
    })
  }

  for (const g of result) {
    g.total = round2(g.invoices + g.payroll)
    g.lines.sort((a, b) => a.date.localeCompare(b.date))
    const projectCosts = costsMap.get(g.project.id) ?? emptyCosts()
    const ratio =
      projectCosts.total > 0 ? round2((g.total / projectCosts.total) * 100) : g.clientPct
    g.costs = scaleCosts(projectCosts, ratio)
    g.categoryTotals = (categoryTotalsMap.get(g.project.id) ?? []).map((row) => ({
      ...row,
      amount: round2((row.amount * ratio) / 100),
    }))
    g.activityTotals = (activityTotalsMap.get(g.project.id) ?? []).map((row) => ({
      ...row,
      amount: round2((row.amount * ratio) / 100),
    }))
  }
  return { projects: result, total: round2(result.reduce((s, g) => s + g.total, 0)) }
}

export type SubsidyBillingProject = Awaited<
  ReturnType<typeof getSubsidyBilling>
>["projects"][number]

/* -------------------------------- Factures ------------------------------- */

export const invoiceSortKeys = ["data", "base", "iva", "irpf", "total", "assignat"] as const
export type InvoiceSortKey = (typeof invoiceSortKeys)[number]
export const invoiceAssignmentFilters = ["completa", "pendent", "parcial"] as const
export type InvoiceAssignmentFilter = (typeof invoiceAssignmentFilters)[number]

/** Subconsulta amb noms de taula explícits: el query API relacional reescriu malament les refs de drizzle. */
const assignedPctSql = sql`coalesce((select sum(percentage) from invoice_projects where invoice_id = ${supplierInvoices.id}), 0)`

export async function listInvoices(filters: {
  q?: string
  from?: string
  to?: string
  supplierId?: string
  projectId?: string
  assignment?: InvoiceAssignmentFilter
  costType?: CostType
  /** UUID de categoria, o `"none"` per factures sense categoria. */
  categoryId?: string
  sort?: InvoiceSortKey
  dir?: "asc" | "desc"
}) {
  const assignmentWhere =
    filters.assignment === "completa"
      ? sql`${assignedPctSql} >= 100`
      : filters.assignment === "pendent"
        ? sql`${assignedPctSql} = 0`
        : filters.assignment === "parcial"
          ? sql`${assignedPctSql} > 0 and ${assignedPctSql} < 100`
          : undefined

  const categoryWhere =
    filters.categoryId && filters.categoryId !== "none"
      ? inArray(
          supplierInvoices.id,
          db
            .select({ id: invoiceCategories.invoiceId })
            .from(invoiceCategories)
            .where(eq(invoiceCategories.categoryId, filters.categoryId))
        )
      : filters.categoryId === "none"
        ? sql`not exists (select 1 from invoice_categories ic where ic.invoice_id = ${supplierInvoices.id})`
        : undefined

  const where = [
    filters.supplierId ? eq(supplierInvoices.supplierId, filters.supplierId) : undefined,
    filters.projectId
      ? inArray(
          supplierInvoices.id,
          db
            .select({ id: invoiceProjects.invoiceId })
            .from(invoiceProjects)
            .where(eq(invoiceProjects.projectId, filters.projectId))
        )
      : undefined,
    filters.costType ? eq(supplierInvoices.costType, filters.costType) : undefined,
    categoryWhere,
    filters.from ? gte(supplierInvoices.issueDate, filters.from) : undefined,
    filters.to ? lte(supplierInvoices.issueDate, filters.to) : undefined,
    filters.q
      ? sql`(${supplierInvoices.number} ilike ${"%" + filters.q + "%"} or ${supplierInvoices.supplierName} ilike ${"%" + filters.q + "%"} or ${supplierInvoices.description} ilike ${"%" + filters.q + "%"} or ${supplierInvoices.supplierTaxId} ilike ${"%" + filters.q + "%"})`
      : undefined,
    assignmentWhere,
  ].filter(Boolean)

  const dir = filters.dir === "asc" ? asc : desc
  const orderBy =
    filters.sort === "base"
      ? [dir(supplierInvoices.baseAmount), desc(supplierInvoices.createdAt)]
      : filters.sort === "iva"
        ? [dir(supplierInvoices.vatAmount), desc(supplierInvoices.createdAt)]
        : filters.sort === "irpf"
          ? [dir(supplierInvoices.irpfAmount), desc(supplierInvoices.createdAt)]
          : filters.sort === "total"
            ? [dir(supplierInvoices.total), desc(supplierInvoices.createdAt)]
            : filters.sort === "assignat"
              ? [desc(supplierInvoices.issueDate), desc(supplierInvoices.createdAt)] // ordenat en memòria després
              : [dir(supplierInvoices.issueDate), desc(supplierInvoices.createdAt)]

  const rows = await db.query.supplierInvoices.findMany({
    where: where.length ? and(...where) : undefined,
    orderBy,
    with: {
      supplier: { columns: { id: true, name: true } },
      projects: { with: { project: { columns: { id: true, name: true } } } },
      funders: true,
      categories: { with: { category: { columns: { id: true, name: true } } } },
    },
  })

  const items = rows.map((r) => {
    const cost = invoiceCost(r)
    const assigned = round2(r.projects.reduce((s, p) => s + p.percentage, 0))
    const categories = r.categories
      .map((c) => c.category)
      .sort((a, b) => a.name.localeCompare(b.name))
    return {
      ...r,
      cost,
      assigned,
      assignedTotal: round2((cost * assigned) / 100),
      allocations: r.projects.map((p) => ({
        allocationId: p.id,
        projectId: p.projectId,
        name: p.project.name,
        percentage: p.percentage,
        activityId: p.activityId,
      })),
      funderAllocations: r.funders
        .map((f) => {
          const id = funderKeyFromColumns(f.clientId, f.subsidyId)
          return id ? { id, percentage: f.percentage } : null
        })
        .filter((f): f is { id: string; percentage: number } => f !== null),
      categories,
      categoryIds: categories.map((c) => c.id),
    }
  })

  if (filters.sort === "assignat") {
    const mul = filters.dir === "asc" ? 1 : -1
    items.sort((a, b) => mul * (a.assigned - b.assigned) || b.issueDate.localeCompare(a.issueDate))
  }

  return items
}

export type InvoiceListItem = Awaited<ReturnType<typeof listInvoices>>[number]

/* ------------------------------- Proveïdors ------------------------------ */

/** Proveïdors per triar-los en una factura */
export async function getSupplierOptions() {
  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      taxId: suppliers.taxId,
      address: suppliers.address,
      postalCode: suppliers.postalCode,
      city: suppliers.city,
      defaultVatRate: suppliers.defaultVatRate,
      defaultIrpfRate: suppliers.defaultIrpfRate,
    })
    .from(suppliers)
    .orderBy(asc(suppliers.name))
}

export type SupplierOption = Awaited<ReturnType<typeof getSupplierOptions>>[number]

export async function listSuppliers() {
  const stats = db
    .select({
      supplierId: supplierInvoices.supplierId,
      n: sql<number>`count(*)::int`.as("n"),
      base: sql<string>`sum(${supplierInvoices.baseAmount})`.as("base"),
      total: sql<string>`sum(${supplierInvoices.total})`.as("total"),
      last: sql<string>`max(${supplierInvoices.issueDate})`.as("last"),
    })
    .from(supplierInvoices)
    .groupBy(supplierInvoices.supplierId)
    .as("stats")

  const rows = await db
    .select({ supplier: suppliers, n: stats.n, base: stats.base, total: stats.total, last: stats.last })
    .from(suppliers)
    .leftJoin(stats, eq(stats.supplierId, suppliers.id))
    .orderBy(asc(suppliers.name))

  return rows.map((r) => ({
    ...r.supplier,
    invoiceCount: r.n ?? 0,
    baseTotal: round2(Number(r.base ?? 0)),
    total: round2(Number(r.total ?? 0)),
    lastInvoice: r.last,
  }))
}

export async function getSupplier(id: string) {
  return db.query.suppliers.findFirst({ where: eq(suppliers.id, id) })
}

/** Nombre de factures sense proveïdor enllaçat */
export async function countUnlinkedInvoices() {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(supplierInvoices)
    .where(sql`${supplierInvoices.supplierId} is null`)
  return r.n
}

/* -------------------------------- Nòmines -------------------------------- */

export async function listPayrolls() {
  const rows = await db.query.payrolls.findMany({
    orderBy: [asc(payrolls.personName)],
    with: { entries: { with: { projects: true } } },
  })
  return rows.map(({ entries, ...p }) => {
    const total = round2(entries.reduce((s, e) => s + e.amount, 0))
    const assigned = round2(
      entries.reduce((s, e) => s + e.projects.reduce((ss, a) => ss + (e.amount * a.percentage) / 100, 0), 0)
    )
    const months = entries.map((e) => e.month).sort()
    return {
      ...p,
      entriesCount: entries.length,
      firstMonth: months[0] ?? null,
      lastMonth: months[months.length - 1] ?? null,
      total,
      assigned,
      assignedPct: total > 0 ? (assigned / total) * 100 : 0,
    }
  })
}

export type PayrollListItem = Awaited<ReturnType<typeof listPayrolls>>[number]

export async function getPayroll(id: string) {
  const p = await db.query.payrolls.findFirst({
    where: eq(payrolls.id, id),
    with: {
      entries: {
        orderBy: [desc(payrollEntries.month)],
        with: {
          projects: {
            with: {
              project: { columns: { id: true, name: true } },
              categories: { with: { category: { columns: { id: true, name: true } } } },
            },
          },
          funders: true,
        },
      },
    },
  })
  if (!p) return null
  return {
    ...p,
    entries: p.entries.map((e) => ({
      ...e,
      allocations: e.projects.map((a) => {
        const categories = a.categories
          .map((c) => c.category)
          .sort((x, y) => x.name.localeCompare(y.name))
        return {
          allocationId: a.id,
          projectId: a.projectId,
          name: a.project.name,
          percentage: a.percentage,
          costType: a.costType,
          activityId: a.activityId,
          categories,
          categoryIds: categories.map((c) => c.id),
        }
      }),
      funderAllocations: e.funders
        .map((f) => {
          const id = funderKeyFromColumns(f.clientId, f.subsidyId)
          return id ? { id, percentage: f.percentage } : null
        })
        .filter((f): f is { id: string; percentage: number } => f !== null),
      assigned: round2(e.projects.reduce((s, a) => s + a.percentage, 0)),
    })),
  }
}

/* ------------------------------- Dashboard ------------------------------- */

export async function getDashboard(month: string) {
  const [projectList, invMonth, payMonth, unassignedInv, unassignedPay, counts] = await Promise.all([
    listProjects(),
    db
      .select({
        n: sql<number>`count(*)::int`,
        cost: sql<string>`coalesce(sum(${supplierInvoices.baseAmount} + ${supplierInvoices.vatAmount} * ${supplierInvoices.vatDeductibleRate} / 100), 0)`,
      })
      .from(supplierInvoices)
      .where(and(gte(supplierInvoices.issueDate, month), lte(supplierInvoices.issueDate, endOfMonth(month)))),
    db
      .select({
        n: sql<number>`count(*)::int`,
        cost: sql<string>`coalesce(sum(${payrollEntries.amount}), 0)`,
      })
      .from(payrollEntries)
      .where(eq(payrollEntries.month, month)),
    db.execute<{ n: number; cost: string }>(sql`
      select count(*)::int as n,
             coalesce(sum((i.base_amount + i.vat_amount * i.vat_deductible_rate / 100) * (100 - coalesce(a.pct, 0)) / 100), 0) as cost
      from supplier_invoices i
      left join (select invoice_id, sum(percentage) as pct from invoice_projects group by invoice_id) a
        on a.invoice_id = i.id
      where coalesce(a.pct, 0) < 100`),
    db.execute<{ n: number; cost: string }>(sql`
      select count(*)::int as n,
             coalesce(sum(e.amount * (100 - coalesce(a.pct, 0)) / 100), 0) as cost
      from payroll_entries e
      left join (select entry_id, sum(percentage) as pct from payroll_entry_projects group by entry_id) a
        on a.entry_id = e.id
      where coalesce(a.pct, 0) < 100 and e.month <= ${month}`),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(clients),
  ])

  const open = projectList.filter((p) => !p.closedAt || p.closedAt >= month)
  return {
    projects: projectList,
    openCount: open.length,
    clientCount: counts[0].n,
    budget: round2(open.reduce((s, p) => s + p.maxBudget, 0)),
    spent: round2(open.reduce((s, p) => s + p.costs.total, 0)),
    month: {
      invoices: { n: invMonth[0].n, cost: round2(Number(invMonth[0].cost)) },
      payroll: { n: payMonth[0].n, cost: round2(Number(payMonth[0].cost)) },
    },
    unassigned: {
      invoices: { n: unassignedInv.rows[0].n, cost: round2(Number(unassignedInv.rows[0].cost)) },
      payroll: { n: unassignedPay.rows[0].n, cost: round2(Number(unassignedPay.rows[0].cost)) },
    },
  }
}
