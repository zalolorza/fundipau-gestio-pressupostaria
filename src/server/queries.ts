import "server-only"

import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm"

import { db } from "@/db"
import {
  clients,
  invitations,
  invoiceProjects,
  payrollEntries,
  payrollEntryProjects,
  payrolls,
  projectClients,
  projects,
  supplierInvoices,
  suppliers,
  user,
} from "@/db/schema"
import { round2 } from "@/lib/format"
import { invoiceCost } from "@/lib/invoice"
import { endOfMonth, toMonth } from "@/lib/months"

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
  return row ?? null
}

/* ------------------------------- Opcions -------------------------------- */

export async function getProjectOptions() {
  return db
    .select({ id: projects.id, name: projects.name, closedAt: projects.closedAt })
    .from(projects)
    .orderBy(asc(projects.name))
}

export async function getClientOptions() {
  return db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name))
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
        cost: sql<string>`coalesce(sum((${supplierInvoices.baseAmount} + ${supplierInvoices.vatAmount}) * ${invoiceProjects.percentage} / 100), 0)`,
      })
      .from(invoiceProjects)
      .innerJoin(supplierInvoices, eq(supplierInvoices.id, invoiceProjects.invoiceId))
      .where(and(...invWhere))
      .groupBy(invoiceProjects.projectId),
    db
      .select({
        projectId: payrollEntryProjects.projectId,
        cost: sql<string>`coalesce(sum(${payrollEntries.amount} * ${payrollEntryProjects.percentage} / 100), 0)`,
      })
      .from(payrollEntryProjects)
      .innerJoin(payrollEntries, eq(payrollEntries.id, payrollEntryProjects.entryId))
      .where(and(...payWhere))
      .groupBy(payrollEntryProjects.projectId),
  ])

  const map = new Map<string, { invoices: number; payroll: number; total: number }>()
  const get = (id: string) => {
    if (!map.has(id)) map.set(id, { invoices: 0, payroll: 0, total: 0 })
    return map.get(id)!
  }
  for (const r of inv) get(r.projectId).invoices = round2(Number(r.cost))
  for (const r of pay) get(r.projectId).payroll = round2(Number(r.cost))
  for (const v of map.values()) v.total = round2(v.invoices + v.payroll)
  return map
}

/* ------------------------------- Projectes ------------------------------- */

export async function listProjects() {
  const rows = await db.query.projects.findMany({
    orderBy: [desc(projects.openedAt), asc(projects.name)],
    with: { clients: { with: { client: { columns: { id: true, name: true } } } } },
  })
  const costs = await costsByProject()
  return rows.map((p) => {
    const c = costs.get(p.id) ?? { invoices: 0, payroll: 0, total: 0 }
    return {
      ...p,
      clients: p.clients.map((pc) => ({ ...pc.client, percentage: pc.percentage })),
      costs: c,
      progress: p.maxBudget > 0 ? (c.total / p.maxBudget) * 100 : 0,
    }
  })
}

export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number]

export async function getProject(id: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: { clients: { with: { client: true } } },
  })
  if (!project) return null

  const [invoiceRows, payrollRows, costs] = await Promise.all([
    db
      .select({
        invoice: supplierInvoices,
        percentage: invoiceProjects.percentage,
      })
      .from(invoiceProjects)
      .innerJoin(supplierInvoices, eq(supplierInvoices.id, invoiceProjects.invoiceId))
      .where(eq(invoiceProjects.projectId, id))
      .orderBy(desc(supplierInvoices.issueDate)),
    db
      .select({
        entryId: payrollEntries.id,
        month: payrollEntries.month,
        amount: payrollEntries.amount,
        payrollId: payrolls.id,
        personName: payrolls.personName,
        role: payrolls.role,
        percentage: payrollEntryProjects.percentage,
      })
      .from(payrollEntryProjects)
      .innerJoin(payrollEntries, eq(payrollEntries.id, payrollEntryProjects.entryId))
      .innerJoin(payrolls, eq(payrolls.id, payrollEntries.payrollId))
      .where(eq(payrollEntryProjects.projectId, id))
      .orderBy(desc(payrollEntries.month), asc(payrolls.personName)),
    costsByProject([id]),
  ])

  const invoiceIds = invoiceRows.map((r) => r.invoice.id)
  const allAllocations =
    invoiceIds.length === 0
      ? []
      : await db
          .select({
            invoiceId: invoiceProjects.invoiceId,
            projectId: invoiceProjects.projectId,
            percentage: invoiceProjects.percentage,
          })
          .from(invoiceProjects)
          .where(inArray(invoiceProjects.invoiceId, invoiceIds))

  const allocationsByInvoice = new Map<string, { id: string; percentage: number }[]>()
  for (const a of allAllocations) {
    const list = allocationsByInvoice.get(a.invoiceId) ?? []
    list.push({ id: a.projectId, percentage: a.percentage })
    allocationsByInvoice.set(a.invoiceId, list)
  }

  const invoices = invoiceRows.map((r) => {
    const cost = invoiceCost(r.invoice)
    return {
      ...r.invoice,
      cost,
      percentage: r.percentage,
      imputed: round2((cost * r.percentage) / 100),
      allocations: allocationsByInvoice.get(r.invoice.id) ?? [],
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
      entries: { entryId: string; month: string; amount: number; percentage: number; imputed: number }[]
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
    g.entries.push({ entryId: r.entryId, month: r.month, amount: r.amount, percentage: r.percentage, imputed })
    g.total = round2(g.total + imputed)
  }

  const c = costs.get(id) ?? { invoices: 0, payroll: 0, total: 0 }
  return {
    ...project,
    clients: project.clients.map((pc) => ({ ...pc.client, percentage: pc.percentage })),
    invoices,
    payroll: [...byPerson.values()],
    costs: c,
    progress: project.maxBudget > 0 ? (c.total / project.maxBudget) * 100 : 0,
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
    with: { projects: { with: { project: { columns: { id: true, name: true } } } } },
  })
  return rows
}

export async function getClient(id: string) {
  return db.query.clients.findFirst({
    where: eq(clients.id, id),
    with: { projects: { with: { project: true } } },
  })
}

/**
 * Imports que s'haurien de facturar a un client en un període:
 * per a cada projecte del client, costos del període × % del client.
 */
export async function getClientBilling(clientId: string, from: string, to: string) {
  const links = await db
    .select({ project: projects, percentage: projectClients.percentage })
    .from(projectClients)
    .innerJoin(projects, eq(projects.id, projectClients.projectId))
    .where(eq(projectClients.clientId, clientId))
    .orderBy(asc(projects.name))

  if (links.length === 0) return { projects: [], total: 0 }
  const ids = links.map((l) => l.project.id)
  const pct = new Map(links.map((l) => [l.project.id, l.percentage]))

  const [invRows, payRows] = await Promise.all([
    db
      .select({
        projectId: invoiceProjects.projectId,
        percentage: invoiceProjects.percentage,
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
        projectId: payrollEntryProjects.projectId,
        percentage: payrollEntryProjects.percentage,
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
  ])

  type Line = {
    kind: "factura" | "nomina"
    date: string
    concept: string
    detail: string
    cost: number
    projectPct: number
    clientPct: number
    amount: number
    href: string | null
  }

  const result = links.map((l) => ({
    project: l.project,
    clientPct: l.percentage,
    lines: [] as Line[],
    invoices: 0,
    payroll: 0,
    total: 0,
  }))
  const byId = new Map(result.map((r) => [r.project.id, r]))

  for (const r of invRows) {
    const g = byId.get(r.projectId)!
    const cost = invoiceCost(r.invoice)
    const amount = round2((cost * r.percentage * pct.get(r.projectId)!) / 10000)
    g.lines.push({
      kind: "factura",
      date: r.invoice.issueDate,
      concept: `${r.invoice.supplierName} · ${r.invoice.number}`,
      detail: r.invoice.description ?? "",
      cost,
      projectPct: r.percentage,
      clientPct: pct.get(r.projectId)!,
      amount,
      href: r.invoice.supplierId ? `/proveidors/${r.invoice.supplierId}` : `/projectes/${r.projectId}`,
    })
    g.invoices = round2(g.invoices + amount)
  }
  for (const r of payRows) {
    const g = byId.get(r.projectId)!
    const amount = round2((r.amount * r.percentage * pct.get(r.projectId)!) / 10000)
    g.lines.push({
      kind: "nomina",
      date: r.month,
      concept: `Nòmina · ${r.personName}`,
      detail: "",
      cost: r.amount,
      projectPct: r.percentage,
      clientPct: pct.get(r.projectId)!,
      amount,
      href: `/nomines/${r.payrollId}`,
    })
    g.payroll = round2(g.payroll + amount)
  }
  for (const g of result) {
    g.total = round2(g.invoices + g.payroll)
    g.lines.sort((a, b) => a.date.localeCompare(b.date))
  }
  return { projects: result, total: round2(result.reduce((s, g) => s + g.total, 0)) }
}

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
  sort?: InvoiceSortKey
  dir?: "asc" | "desc"
}) {
  const assignmentWhere =
    filters.assignment === "completa"
      ? sql`${assignedPctSql} = 100`
      : filters.assignment === "pendent"
        ? sql`${assignedPctSql} = 0`
        : filters.assignment === "parcial"
          ? sql`${assignedPctSql} < 100` // parcial + 100% pendent
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
    },
  })
  const items = rows.map((r) => {
    const cost = invoiceCost(r)
    const assigned = round2(r.projects.reduce((s, p) => s + p.percentage, 0))
    return {
      ...r,
      cost,
      assigned,
      assignedTotal: round2((cost * assigned) / 100),
      allocations: r.projects.map((p) => ({ projectId: p.projectId, name: p.project.name, percentage: p.percentage })),
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
        with: { projects: { with: { project: { columns: { id: true, name: true } } } } },
      },
    },
  })
  if (!p) return null
  return {
    ...p,
    entries: p.entries.map((e) => ({
      ...e,
      allocations: e.projects.map((a) => ({ projectId: a.projectId, name: a.project.name, percentage: a.percentage })),
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
        cost: sql<string>`coalesce(sum(${supplierInvoices.baseAmount} + ${supplierInvoices.vatAmount}), 0)`,
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
             coalesce(sum((i.base_amount + i.vat_amount) * (100 - coalesce(a.pct, 0)) / 100), 0) as cost
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
