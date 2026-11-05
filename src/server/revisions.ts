import "server-only"

import { and, desc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/db"
import {
  clients,
  entityRevisions,
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
  user,
} from "@/db/schema"
import { requireSession } from "@/lib/auth"
import type { CostType } from "@/lib/cost-type"

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

export const REVISION_ENTITY_TYPES = [
  "invoice",
  "payroll_entry",
  "payroll",
  "project",
  "subsidy",
  "client",
] as const
export type RevisionEntityType = (typeof REVISION_ENTITY_TYPES)[number]

export const REVISION_ACTIONS = ["replace_relations", "update", "delete", "restore"] as const
export type RevisionAction = (typeof REVISION_ACTIONS)[number]

type InvoiceAllocationSnap = {
  id: string
  projectId: string
  percentage: number
  activityId: string | null
}

type InvoiceFunderSnap = {
  id: string
  clientId: string | null
  subsidyId: string | null
  percentage: number
}

type InvoiceSnapshot = {
  invoice: typeof supplierInvoices.$inferSelect
  categoryIds: string[]
  allocations: InvoiceAllocationSnap[]
  funders: InvoiceFunderSnap[]
}

type PayrollAllocationSnap = {
  id: string
  projectId: string
  percentage: number
  costType: CostType
  activityId: string | null
  categoryIds: string[]
}

type PayrollFunderSnap = {
  id: string
  clientId: string | null
  subsidyId: string | null
  percentage: number
}

type PayrollEntrySnapshot = {
  entry: typeof payrollEntries.$inferSelect
  allocations: PayrollAllocationSnap[]
  funders: PayrollFunderSnap[]
}

type PayrollSnapshot = {
  payroll: typeof payrolls.$inferSelect
  entries: PayrollEntrySnapshot[]
}

type ProjectSnapshot = {
  project: typeof projects.$inferSelect
  clients: { clientId: string; percentage: number }[]
  subsidies: { subsidyId: string; percentage: number }[]
  activities: (typeof projectActivities.$inferSelect)[]
  invoiceAllocations: (InvoiceAllocationSnap & { invoiceId: string })[]
  payrollAllocations: (PayrollAllocationSnap & { entryId: string })[]
}

type SubsidySnapshot = {
  subsidy: typeof subsidies.$inferSelect
  clients: { clientId: string; percentage: number }[]
  projectLinks: { projectId: string; percentage: number }[]
  invoiceFunderAllocations: (InvoiceFunderSnap & { invoiceId: string })[]
  payrollFunderAllocations: (PayrollFunderSnap & { entryId: string })[]
}

type ClientSnapshot = {
  client: typeof clients.$inferSelect
  projectLinks: { projectId: string; percentage: number }[]
  subsidyLinks: { subsidyId: string; percentage: number }[]
  invoiceFunderAllocations: (InvoiceFunderSnap & { invoiceId: string })[]
  payrollFunderAllocations: (PayrollFunderSnap & { entryId: string })[]
}

export type EntitySnapshot =
  | InvoiceSnapshot
  | PayrollEntrySnapshot
  | PayrollSnapshot
  | ProjectSnapshot
  | SubsidySnapshot
  | ClientSnapshot

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Dades no vàlides" }
  console.error(e)
  return { ok: false, error: e instanceof Error ? e.message : "S'ha produït un error" }
}

async function loadInvoiceAllocations(invoiceId: string): Promise<InvoiceAllocationSnap[]> {
  const rows = await db
    .select({
      id: invoiceProjects.id,
      projectId: invoiceProjects.projectId,
      percentage: invoiceProjects.percentage,
      activityId: invoiceProjects.activityId,
    })
    .from(invoiceProjects)
    .where(eq(invoiceProjects.invoiceId, invoiceId))
  return rows
}

async function loadInvoiceFunders(invoiceId: string): Promise<InvoiceFunderSnap[]> {
  return db
    .select({
      id: invoiceFunders.id,
      clientId: invoiceFunders.clientId,
      subsidyId: invoiceFunders.subsidyId,
      percentage: invoiceFunders.percentage,
    })
    .from(invoiceFunders)
    .where(eq(invoiceFunders.invoiceId, invoiceId))
}

async function loadPayrollAllocations(entryId: string): Promise<PayrollAllocationSnap[]> {
  const rows = await db.query.payrollEntryProjects.findMany({
    where: eq(payrollEntryProjects.entryId, entryId),
    with: { categories: true },
  })
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    percentage: r.percentage,
    costType: r.costType,
    activityId: r.activityId,
    categoryIds: r.categories.map((c) => c.categoryId),
  }))
}

async function loadPayrollFunders(entryId: string): Promise<PayrollFunderSnap[]> {
  return db
    .select({
      id: payrollEntryFunders.id,
      clientId: payrollEntryFunders.clientId,
      subsidyId: payrollEntryFunders.subsidyId,
      percentage: payrollEntryFunders.percentage,
    })
    .from(payrollEntryFunders)
    .where(eq(payrollEntryFunders.entryId, entryId))
}

export async function loadInvoiceSnapshot(invoiceId: string): Promise<InvoiceSnapshot | null> {
  const invoice = await db.query.supplierInvoices.findFirst({
    where: eq(supplierInvoices.id, invoiceId),
  })
  if (!invoice) return null
  const [cats, allocations, funders] = await Promise.all([
    db
      .select({ categoryId: invoiceCategories.categoryId })
      .from(invoiceCategories)
      .where(eq(invoiceCategories.invoiceId, invoiceId)),
    loadInvoiceAllocations(invoiceId),
    loadInvoiceFunders(invoiceId),
  ])
  return {
    invoice,
    categoryIds: cats.map((c) => c.categoryId),
    allocations,
    funders,
  }
}

export async function loadPayrollEntrySnapshot(
  entryId: string
): Promise<PayrollEntrySnapshot | null> {
  const entry = await db.query.payrollEntries.findFirst({
    where: eq(payrollEntries.id, entryId),
  })
  if (!entry) return null
  const [allocations, funders] = await Promise.all([
    loadPayrollAllocations(entryId),
    loadPayrollFunders(entryId),
  ])
  return { entry, allocations, funders }
}

export async function loadPayrollSnapshot(payrollId: string): Promise<PayrollSnapshot | null> {
  const payroll = await db.query.payrolls.findFirst({
    where: eq(payrolls.id, payrollId),
  })
  if (!payroll) return null
  const entries = await db.query.payrollEntries.findMany({
    where: eq(payrollEntries.payrollId, payrollId),
  })
  const withAlloc = await Promise.all(
    entries.map(async (entry) => {
      const [allocations, funders] = await Promise.all([
        loadPayrollAllocations(entry.id),
        loadPayrollFunders(entry.id),
      ])
      return { entry, allocations, funders }
    })
  )
  return { payroll, entries: withAlloc }
}

export async function loadProjectSnapshot(projectId: string): Promise<ProjectSnapshot | null> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  })
  if (!project) return null

  const [clientRows, subsidyRows, activities, invAllocs, payAllocs] = await Promise.all([
    db
      .select({
        clientId: projectClients.clientId,
        percentage: projectClients.percentage,
      })
      .from(projectClients)
      .where(eq(projectClients.projectId, projectId)),
    db
      .select({
        subsidyId: projectSubsidies.subsidyId,
        percentage: projectSubsidies.percentage,
      })
      .from(projectSubsidies)
      .where(eq(projectSubsidies.projectId, projectId)),
    db.query.projectActivities.findMany({
      where: eq(projectActivities.projectId, projectId),
    }),
    db
      .select({
        id: invoiceProjects.id,
        invoiceId: invoiceProjects.invoiceId,
        projectId: invoiceProjects.projectId,
        percentage: invoiceProjects.percentage,
        activityId: invoiceProjects.activityId,
      })
      .from(invoiceProjects)
      .where(eq(invoiceProjects.projectId, projectId)),
    db.query.payrollEntryProjects.findMany({
      where: eq(payrollEntryProjects.projectId, projectId),
      with: { categories: true },
    }),
  ])

  return {
    project,
    clients: clientRows,
    subsidies: subsidyRows,
    activities,
    invoiceAllocations: invAllocs,
    payrollAllocations: payAllocs.map((r) => ({
      id: r.id,
      entryId: r.entryId,
      projectId: r.projectId,
      percentage: r.percentage,
      costType: r.costType,
      activityId: r.activityId,
      categoryIds: r.categories.map((c) => c.categoryId),
    })),
  }
}

export async function loadSubsidySnapshot(subsidyId: string): Promise<SubsidySnapshot | null> {
  const subsidy = await db.query.subsidies.findFirst({
    where: eq(subsidies.id, subsidyId),
  })
  if (!subsidy) return null

  const [clientRows, projectRows, invFunders, payFunders] = await Promise.all([
    db
      .select({
        clientId: subsidyClients.clientId,
        percentage: subsidyClients.percentage,
      })
      .from(subsidyClients)
      .where(eq(subsidyClients.subsidyId, subsidyId)),
    db
      .select({
        projectId: projectSubsidies.projectId,
        percentage: projectSubsidies.percentage,
      })
      .from(projectSubsidies)
      .where(eq(projectSubsidies.subsidyId, subsidyId)),
    db
      .select({
        id: invoiceFunders.id,
        invoiceId: invoiceFunders.invoiceId,
        clientId: invoiceFunders.clientId,
        subsidyId: invoiceFunders.subsidyId,
        percentage: invoiceFunders.percentage,
      })
      .from(invoiceFunders)
      .where(eq(invoiceFunders.subsidyId, subsidyId)),
    db
      .select({
        id: payrollEntryFunders.id,
        entryId: payrollEntryFunders.entryId,
        clientId: payrollEntryFunders.clientId,
        subsidyId: payrollEntryFunders.subsidyId,
        percentage: payrollEntryFunders.percentage,
      })
      .from(payrollEntryFunders)
      .where(eq(payrollEntryFunders.subsidyId, subsidyId)),
  ])

  return {
    subsidy,
    clients: clientRows,
    projectLinks: projectRows,
    invoiceFunderAllocations: invFunders,
    payrollFunderAllocations: payFunders,
  }
}

export async function loadClientSnapshot(clientId: string): Promise<ClientSnapshot | null> {
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
  })
  if (!client) return null

  const [projectRows, subsidyRows, invFunders, payFunders] = await Promise.all([
    db
      .select({
        projectId: projectClients.projectId,
        percentage: projectClients.percentage,
      })
      .from(projectClients)
      .where(eq(projectClients.clientId, clientId)),
    db
      .select({
        subsidyId: subsidyClients.subsidyId,
        percentage: subsidyClients.percentage,
      })
      .from(subsidyClients)
      .where(eq(subsidyClients.clientId, clientId)),
    db
      .select({
        id: invoiceFunders.id,
        invoiceId: invoiceFunders.invoiceId,
        clientId: invoiceFunders.clientId,
        subsidyId: invoiceFunders.subsidyId,
        percentage: invoiceFunders.percentage,
      })
      .from(invoiceFunders)
      .where(eq(invoiceFunders.clientId, clientId)),
    db
      .select({
        id: payrollEntryFunders.id,
        entryId: payrollEntryFunders.entryId,
        clientId: payrollEntryFunders.clientId,
        subsidyId: payrollEntryFunders.subsidyId,
        percentage: payrollEntryFunders.percentage,
      })
      .from(payrollEntryFunders)
      .where(eq(payrollEntryFunders.clientId, clientId)),
  ])

  return {
    client,
    projectLinks: projectRows,
    subsidyLinks: subsidyRows,
    invoiceFunderAllocations: invFunders,
    payrollFunderAllocations: payFunders,
  }
}

export async function loadSnapshot(
  entityType: RevisionEntityType,
  entityId: string
): Promise<EntitySnapshot | null> {
  switch (entityType) {
    case "invoice":
      return loadInvoiceSnapshot(entityId)
    case "payroll_entry":
      return loadPayrollEntrySnapshot(entityId)
    case "payroll":
      return loadPayrollSnapshot(entityId)
    case "project":
      return loadProjectSnapshot(entityId)
    case "subsidy":
      return loadSubsidySnapshot(entityId)
    case "client":
      return loadClientSnapshot(entityId)
  }
}

/** Desa una revisió amb l'estat actual abans d'una mutació destructiva. Falla si no es pot capturar. */
export async function recordRevision(opts: {
  entityType: RevisionEntityType
  entityId: string
  action: Exclude<RevisionAction, "restore">
  summary: string
  actorUserId: string
  after?: unknown
}): Promise<string> {
  const before = await loadSnapshot(opts.entityType, opts.entityId)
  if (!before) {
    throw new Error(
      `No s'ha pogut capturar l'estat de ${opts.entityType} ${opts.entityId} per a l'historial`
    )
  }
  const [row] = await db
    .insert(entityRevisions)
    .values({
      entityType: opts.entityType,
      entityId: opts.entityId,
      action: opts.action,
      actorUserId: opts.actorUserId,
      summary: opts.summary,
      before,
      after: opts.after ?? null,
    })
    .returning({ id: entityRevisions.id })
  return row.id
}

export async function recordRevisionsForIds(opts: {
  entityType: RevisionEntityType
  entityIds: string[]
  action: Exclude<RevisionAction, "restore">
  summary: string
  actorUserId: string
}): Promise<void> {
  const ids = [...new Set(opts.entityIds)]
  for (const entityId of ids) {
    await recordRevision({
      entityType: opts.entityType,
      entityId,
      action: opts.action,
      summary: opts.summary,
      actorUserId: opts.actorUserId,
    })
  }
}

async function replaceInvoiceCategories(invoiceId: string, categoryIds: string[]) {
  const ids = [...new Set(categoryIds)]
  await db.delete(invoiceCategories).where(eq(invoiceCategories.invoiceId, invoiceId))
  if (ids.length)
    await db.insert(invoiceCategories).values(ids.map((categoryId) => ({ invoiceId, categoryId })))
}

async function insertInvoiceAllocations(
  invoiceId: string,
  allocations: Omit<InvoiceAllocationSnap, "id">[]
) {
  await db.delete(invoiceProjects).where(eq(invoiceProjects.invoiceId, invoiceId))
  if (!allocations.length) return
  await db.insert(invoiceProjects).values(
    allocations.map((a) => ({
      invoiceId,
      projectId: a.projectId,
      percentage: a.percentage,
      activityId: a.activityId,
    }))
  )
}

async function insertInvoiceFundersForInvoice(
  invoiceId: string,
  funders: Omit<InvoiceFunderSnap, "id">[]
) {
  await db.delete(invoiceFunders).where(eq(invoiceFunders.invoiceId, invoiceId))
  if (!funders.length) return
  await db.insert(invoiceFunders).values(
    funders.map((f) => ({
      invoiceId,
      percentage: f.percentage,
      clientId: f.clientId,
      subsidyId: f.subsidyId,
    }))
  )
}

async function insertPayrollAllocationsForEntry(
  entryId: string,
  allocations: Omit<PayrollAllocationSnap, "id">[]
) {
  await db.delete(payrollEntryProjects).where(eq(payrollEntryProjects.entryId, entryId))
  if (!allocations.length) return
  const inserted = await db
    .insert(payrollEntryProjects)
    .values(
      allocations.map((a) => ({
        entryId,
        projectId: a.projectId,
        percentage: a.percentage,
        costType: a.costType,
        activityId: a.activityId,
      }))
    )
    .returning({ id: payrollEntryProjects.id })
  const catRows = inserted.flatMap((row, i) =>
    [...new Set(allocations[i]!.categoryIds)].map((categoryId) => ({
      allocationId: row.id,
      categoryId,
    }))
  )
  if (catRows.length) await db.insert(payrollEntryProjectCategories).values(catRows)
}

async function insertPayrollFundersForEntry(
  entryId: string,
  funders: Omit<PayrollFunderSnap, "id">[]
) {
  await db.delete(payrollEntryFunders).where(eq(payrollEntryFunders.entryId, entryId))
  if (!funders.length) return
  await db.insert(payrollEntryFunders).values(
    funders.map((f) => ({
      entryId,
      percentage: f.percentage,
      clientId: f.clientId,
      subsidyId: f.subsidyId,
    }))
  )
}

async function applyInvoiceSnapshot(snap: InvoiceSnapshot) {
  const { invoice, categoryIds, allocations, funders } = snap
  const existing = await db.query.supplierInvoices.findFirst({
    where: eq(supplierInvoices.id, invoice.id),
    columns: { id: true },
  })
  const {
    id,
    createdAt: _c,
    updatedAt: _u,
    ...values
  } = invoice
  if (existing) {
    await db.update(supplierInvoices).set(values).where(eq(supplierInvoices.id, id))
  } else {
    await db.insert(supplierInvoices).values({ ...values, id })
  }
  await replaceInvoiceCategories(id, categoryIds)
  await insertInvoiceAllocations(
    id,
    allocations.map(({ id: _aid, ...rest }) => rest)
  )
  await insertInvoiceFundersForInvoice(
    id,
    (funders ?? []).map(({ id: _fid, ...rest }) => rest)
  )
}

async function applyPayrollEntrySnapshot(snap: PayrollEntrySnapshot) {
  const { entry, allocations, funders } = snap
  const existing = await db.query.payrollEntries.findFirst({
    where: eq(payrollEntries.id, entry.id),
    columns: { id: true },
  })
  const { id, createdAt: _c, updatedAt: _u, ...values } = entry
  if (existing) {
    await db.update(payrollEntries).set(values).where(eq(payrollEntries.id, id))
  } else {
    await db.insert(payrollEntries).values({ ...values, id })
  }
  await insertPayrollAllocationsForEntry(
    id,
    allocations.map(({ id: _aid, ...rest }) => rest)
  )
  await insertPayrollFundersForEntry(
    id,
    (funders ?? []).map(({ id: _fid, ...rest }) => rest)
  )
}

async function applyPayrollSnapshot(snap: PayrollSnapshot, warnings: string[]) {
  const { payroll, entries } = snap
  const existing = await db.query.payrolls.findFirst({
    where: eq(payrolls.id, payroll.id),
    columns: { id: true },
  })
  const { id, createdAt: _c, updatedAt: _u, ...values } = payroll
  if (existing) {
    await db.update(payrolls).set(values).where(eq(payrolls.id, id))
    // Neteja entries actuals i recrea des del snapshot
    await db.delete(payrollEntries).where(eq(payrollEntries.payrollId, id))
  } else {
    await db.insert(payrolls).values({ ...values, id })
  }
  for (const e of entries) {
    try {
      await applyPayrollEntrySnapshot(e)
    } catch (err) {
      warnings.push(
        `No s'ha pogut restaurar l'entrada ${e.entry.id}: ${err instanceof Error ? err.message : "error"}`
      )
    }
  }
}

async function applyProjectSnapshot(snap: ProjectSnapshot, warnings: string[]) {
  const { project, clients: clientLinks, subsidies: subsidyLinks, activities } = snap
  const existing = await db.query.projects.findFirst({
    where: eq(projects.id, project.id),
    columns: { id: true },
  })
  const { id, createdAt: _c, updatedAt: _u, ...values } = project
  if (existing) {
    await db.update(projects).set(values).where(eq(projects.id, id))
  } else {
    await db.insert(projects).values({ ...values, id })
  }

  // Activitats amb els mateixos UUID (cal per enllaçar assignacions)
  await db.delete(projectActivities).where(eq(projectActivities.projectId, id))
  if (activities.length) {
    await db.insert(projectActivities).values(
      activities.map((a) => {
        const { createdAt: _ac, updatedAt: _au, ...rest } = a
        return rest
      })
    )
  }

  await db.delete(projectClients).where(eq(projectClients.projectId, id))
  await db.delete(projectSubsidies).where(eq(projectSubsidies.projectId, id))
  if (clientLinks.length) {
    await db.insert(projectClients).values(
      clientLinks.map((c) => ({
        projectId: id,
        clientId: c.clientId,
        percentage: c.percentage,
      }))
    )
  }
  if (subsidyLinks.length) {
    await db.insert(projectSubsidies).values(
      subsidyLinks.map((s) => ({
        projectId: id,
        subsidyId: s.subsidyId,
        percentage: s.percentage,
      }))
    )
  }

  // Tall transversal: substitueix assignacions d'aquest projecte
  await db.delete(invoiceProjects).where(eq(invoiceProjects.projectId, id))
  const invoiceIds = [...new Set(snap.invoiceAllocations.map((a) => a.invoiceId))]
  if (invoiceIds.length) {
    const existingInvoices = await db
      .select({ id: supplierInvoices.id })
      .from(supplierInvoices)
      .where(inArray(supplierInvoices.id, invoiceIds))
    const ok = new Set(existingInvoices.map((r) => r.id))
    const toInsert = snap.invoiceAllocations.filter((a) => {
      if (!ok.has(a.invoiceId)) {
        warnings.push(`Factura ${a.invoiceId} inexistent; s'omet l'assignació`)
        return false
      }
      return true
    })
    if (toInsert.length) {
      await db.insert(invoiceProjects).values(
        toInsert.map((a) => ({
          invoiceId: a.invoiceId,
          projectId: id,
          percentage: a.percentage,
          activityId: a.activityId,
        }))
      )
    }
  }

  await db.delete(payrollEntryProjects).where(eq(payrollEntryProjects.projectId, id))
  const entryIds = [...new Set(snap.payrollAllocations.map((a) => a.entryId))]
  if (entryIds.length) {
    const existingEntries = await db
      .select({ id: payrollEntries.id })
      .from(payrollEntries)
      .where(inArray(payrollEntries.id, entryIds))
    const ok = new Set(existingEntries.map((r) => r.id))
    const toInsert = snap.payrollAllocations.filter((a) => {
      if (!ok.has(a.entryId)) {
        warnings.push(`Entrada de nòmina ${a.entryId} inexistent; s'omet l'assignació`)
        return false
      }
      return true
    })
    if (toInsert.length) {
      const inserted = await db
        .insert(payrollEntryProjects)
        .values(
          toInsert.map((a) => ({
            entryId: a.entryId,
            projectId: id,
            percentage: a.percentage,
            costType: a.costType,
            activityId: a.activityId,
          }))
        )
        .returning({ id: payrollEntryProjects.id })
      const catRows = inserted.flatMap((row, i) =>
        [...new Set(toInsert[i]!.categoryIds)].map((categoryId) => ({
          allocationId: row.id,
          categoryId,
        }))
      )
      if (catRows.length) await db.insert(payrollEntryProjectCategories).values(catRows)
    }
  }
}

async function applySubsidySnapshot(snap: SubsidySnapshot, warnings: string[]) {
  const { subsidy, clients: clientLinks, projectLinks } = snap
  const existing = await db.query.subsidies.findFirst({
    where: eq(subsidies.id, subsidy.id),
    columns: { id: true },
  })
  const { id, createdAt: _c, updatedAt: _u, ...values } = subsidy
  if (existing) {
    await db.update(subsidies).set(values).where(eq(subsidies.id, id))
  } else {
    await db.insert(subsidies).values({ ...values, id })
  }

  await db.delete(subsidyClients).where(eq(subsidyClients.subsidyId, id))
  if (clientLinks.length) {
    await db.insert(subsidyClients).values(
      clientLinks.map((c) => ({
        subsidyId: id,
        clientId: c.clientId,
        percentage: c.percentage,
      }))
    )
  }

  // No reescriu tot project_subsidies d'altres subvencions; només restaura links d'aquesta
  await db.delete(projectSubsidies).where(eq(projectSubsidies.subsidyId, id))
  if (projectLinks.length) {
    const projectIds = projectLinks.map((p) => p.projectId)
    const existingProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(inArray(projects.id, projectIds))
    const ok = new Set(existingProjects.map((p) => p.id))
    const toInsert = projectLinks.filter((p) => {
      if (!ok.has(p.projectId)) {
        warnings.push(`Projecte ${p.projectId} inexistent; s'omet l'enllaç de subvenció`)
        return false
      }
      return true
    })
    if (toInsert.length) {
      await db.insert(projectSubsidies).values(
        toInsert.map((p) => ({
          projectId: p.projectId,
          subsidyId: id,
          percentage: p.percentage,
        }))
      )
    }
  }

  // Restaura assignacions explícites de finançador a aquesta subvenció
  await db.delete(invoiceFunders).where(eq(invoiceFunders.subsidyId, id))
  const invoiceIds = [...new Set(snap.invoiceFunderAllocations.map((a) => a.invoiceId))]
  if (invoiceIds.length) {
    const existingInvoices = await db
      .select({ id: supplierInvoices.id })
      .from(supplierInvoices)
      .where(inArray(supplierInvoices.id, invoiceIds))
    const ok = new Set(existingInvoices.map((r) => r.id))
    const toInsert = snap.invoiceFunderAllocations.filter((a) => {
      if (!ok.has(a.invoiceId)) {
        warnings.push(`Factura ${a.invoiceId} inexistent; no es restaura el finançador`)
        return false
      }
      return true
    })
    if (toInsert.length) {
      await db.insert(invoiceFunders).values(
        toInsert.map((a) => ({
          invoiceId: a.invoiceId,
          percentage: a.percentage,
          clientId: null,
          subsidyId: id,
        }))
      )
    }
  }

  await db.delete(payrollEntryFunders).where(eq(payrollEntryFunders.subsidyId, id))
  const entryIds = [...new Set(snap.payrollFunderAllocations.map((a) => a.entryId))]
  if (entryIds.length) {
    const existingEntries = await db
      .select({ id: payrollEntries.id })
      .from(payrollEntries)
      .where(inArray(payrollEntries.id, entryIds))
    const ok = new Set(existingEntries.map((r) => r.id))
    const toInsert = snap.payrollFunderAllocations.filter((a) => {
      if (!ok.has(a.entryId)) {
        warnings.push(`Entrada ${a.entryId} inexistent; no es restaura el finançador`)
        return false
      }
      return true
    })
    if (toInsert.length) {
      await db.insert(payrollEntryFunders).values(
        toInsert.map((a) => ({
          entryId: a.entryId,
          percentage: a.percentage,
          clientId: null,
          subsidyId: id,
        }))
      )
    }
  }
}

async function applyClientSnapshot(snap: ClientSnapshot, warnings: string[]) {
  const { client, projectLinks, subsidyLinks } = snap
  const existing = await db.query.clients.findFirst({
    where: eq(clients.id, client.id),
    columns: { id: true },
  })
  const { id, createdAt: _c, updatedAt: _u, ...values } = client
  if (existing) {
    await db.update(clients).set(values).where(eq(clients.id, id))
  } else {
    await db.insert(clients).values({ ...values, id })
  }

  // Restaura junctions cascade-esborrades
  for (const p of projectLinks) {
    const proj = await db.query.projects.findFirst({
      where: eq(projects.id, p.projectId),
      columns: { id: true },
    })
    if (!proj) {
      warnings.push(`Projecte ${p.projectId} inexistent; s'omet l'enllaç de finançador`)
      continue
    }
    await db
      .delete(projectClients)
      .where(and(eq(projectClients.projectId, p.projectId), eq(projectClients.clientId, id)))
    await db.insert(projectClients).values({
      projectId: p.projectId,
      clientId: id,
      percentage: p.percentage,
    })
  }

  for (const s of subsidyLinks) {
    const sub = await db.query.subsidies.findFirst({
      where: eq(subsidies.id, s.subsidyId),
      columns: { id: true },
    })
    if (!sub) {
      warnings.push(`Subvenció ${s.subsidyId} inexistent; s'omet l'enllaç`)
      continue
    }
    await db
      .delete(subsidyClients)
      .where(and(eq(subsidyClients.subsidyId, s.subsidyId), eq(subsidyClients.clientId, id)))
    await db.insert(subsidyClients).values({
      subsidyId: s.subsidyId,
      clientId: id,
      percentage: s.percentage,
    })
  }

  await db.delete(invoiceFunders).where(eq(invoiceFunders.clientId, id))
  const invoiceIds = [...new Set(snap.invoiceFunderAllocations.map((a) => a.invoiceId))]
  if (invoiceIds.length) {
    const existingInvoices = await db
      .select({ id: supplierInvoices.id })
      .from(supplierInvoices)
      .where(inArray(supplierInvoices.id, invoiceIds))
    const ok = new Set(existingInvoices.map((r) => r.id))
    const toInsert = snap.invoiceFunderAllocations.filter((a) => {
      if (!ok.has(a.invoiceId)) {
        warnings.push(`Factura ${a.invoiceId} inexistent; no es restaura el finançador`)
        return false
      }
      return true
    })
    if (toInsert.length) {
      await db.insert(invoiceFunders).values(
        toInsert.map((a) => ({
          invoiceId: a.invoiceId,
          percentage: a.percentage,
          clientId: id,
          subsidyId: null,
        }))
      )
    }
  }

  await db.delete(payrollEntryFunders).where(eq(payrollEntryFunders.clientId, id))
  const entryIds = [...new Set(snap.payrollFunderAllocations.map((a) => a.entryId))]
  if (entryIds.length) {
    const existingEntries = await db
      .select({ id: payrollEntries.id })
      .from(payrollEntries)
      .where(inArray(payrollEntries.id, entryIds))
    const ok = new Set(existingEntries.map((r) => r.id))
    const toInsert = snap.payrollFunderAllocations.filter((a) => {
      if (!ok.has(a.entryId)) {
        warnings.push(`Entrada ${a.entryId} inexistent; no es restaura el finançador`)
        return false
      }
      return true
    })
    if (toInsert.length) {
      await db.insert(payrollEntryFunders).values(
        toInsert.map((a) => ({
          entryId: a.entryId,
          percentage: a.percentage,
          clientId: id,
          subsidyId: null,
        }))
      )
    }
  }
}

function revalidateAllDomain() {
  revalidatePath("/")
  revalidatePath("/projectes", "layout")
  revalidatePath("/factures")
  revalidatePath("/nomines", "layout")
  revalidatePath("/financadors", "layout")
  revalidatePath("/subvencions", "layout")
  revalidatePath("/proveidors", "layout")
}

export async function restoreRevision(
  revisionId: string
): Promise<ActionResult<{ warnings: string[] }>> {
  const session = await requireSession()
  try {
    const rev = await db.query.entityRevisions.findFirst({
      where: eq(entityRevisions.id, revisionId),
    })
    if (!rev) throw new Error("Revisió no trobada")

    const entityType = rev.entityType as RevisionEntityType
    if (!REVISION_ENTITY_TYPES.includes(entityType)) {
      throw new Error(`Tipus d'entitat no compatible: ${rev.entityType}`)
    }

    const currentBefore = await loadSnapshot(entityType, rev.entityId)
    // Si l'entitat ja no existeix, currentBefore és null; desem un marcador mínim
    const beforeForUndo = currentBefore ?? {
      deleted: true,
      entityType,
      entityId: rev.entityId,
    }

    await db.insert(entityRevisions).values({
      entityType,
      entityId: rev.entityId,
      action: "restore",
      actorUserId: session.user.id,
      summary: `Restauració des de la revisió ${revisionId.slice(0, 8)}…`,
      before: beforeForUndo,
      after: null,
    })

    const snap = rev.before as EntitySnapshot
    const warnings: string[] = []

    switch (entityType) {
      case "invoice":
        await applyInvoiceSnapshot(snap as InvoiceSnapshot)
        break
      case "payroll_entry":
        await applyPayrollEntrySnapshot(snap as PayrollEntrySnapshot)
        break
      case "payroll":
        await applyPayrollSnapshot(snap as PayrollSnapshot, warnings)
        break
      case "project":
        await applyProjectSnapshot(snap as ProjectSnapshot, warnings)
        break
      case "subsidy":
        await applySubsidySnapshot(snap as SubsidySnapshot, warnings)
        break
      case "client":
        await applyClientSnapshot(snap as ClientSnapshot, warnings)
        break
    }

    revalidateAllDomain()
    return { ok: true, data: { warnings } }
  } catch (e) {
    return fail(e)
  }
}

export async function listRevisions(opts: {
  entityType: RevisionEntityType
  entityId: string
  limit?: number
}) {
  await requireSession()
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50)
  const rows = await db
    .select({
      id: entityRevisions.id,
      entityType: entityRevisions.entityType,
      entityId: entityRevisions.entityId,
      action: entityRevisions.action,
      summary: entityRevisions.summary,
      createdAt: entityRevisions.createdAt,
      actorUserId: entityRevisions.actorUserId,
      actorName: user.name,
      actorEmail: user.email,
    })
    .from(entityRevisions)
    .leftJoin(user, eq(user.id, entityRevisions.actorUserId))
    .where(
      and(
        eq(entityRevisions.entityType, opts.entityType),
        eq(entityRevisions.entityId, opts.entityId)
      )
    )
    .orderBy(desc(entityRevisions.createdAt))
    .limit(limit)
  return rows
}

export async function getRevision(revisionId: string) {
  await requireSession()
  const rev = await db
    .select({
      id: entityRevisions.id,
      entityType: entityRevisions.entityType,
      entityId: entityRevisions.entityId,
      action: entityRevisions.action,
      summary: entityRevisions.summary,
      before: entityRevisions.before,
      after: entityRevisions.after,
      createdAt: entityRevisions.createdAt,
      actorUserId: entityRevisions.actorUserId,
      actorName: user.name,
      actorEmail: user.email,
    })
    .from(entityRevisions)
    .leftJoin(user, eq(user.id, entityRevisions.actorUserId))
    .where(eq(entityRevisions.id, revisionId))
    .limit(1)
  return rev[0] ?? null
}
