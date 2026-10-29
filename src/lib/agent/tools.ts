import "server-only"

import { eq } from "drizzle-orm"
import { tool } from "ai"
import { z } from "zod"

import { db } from "@/db"
import { supplierInvoices } from "@/db/schema"
import { take } from "@/lib/agent/truncate"
import { round2 } from "@/lib/format"
import { invoiceCost } from "@/lib/invoice"
import {
  assignInvoiceToProject,
  assignPayrollToProject,
  changePayrollAmount,
  createCategory,
  createPayroll,
  createProjectActivity,
  renameCategory,
  saveClient,
  saveInvoice,
  saveProject,
  saveSupplier,
  setInvoiceProjectActivity,
  setPayrollEntryProjects,
  setProjectClients,
  unassignInvoiceFromProject,
  unassignPayrollEntries,
  updatePayrollInfo,
  updateProjectActivity,
} from "@/server/actions"
import { extractInvoiceFromPathname } from "@/server/invoice-extract-actions"
import {
  getClient,
  getClientBilling,
  getDashboard,
  getPayroll,
  getProject,
  getSupplier,
  listCategories,
  listClients,
  listInvoices,
  listPayrolls,
  listProjectActivities,
  listProjects,
  listSuppliers,
} from "@/server/queries"

const uuid = z.string().uuid()
const optStr = z.string().optional().nullable()
const costType = z.enum(["direct", "indirect"]).default("direct")
const changeScope = z.enum(["current", "future", "all"])

function matchQ(hay: string | null | undefined, q?: string) {
  if (!q?.trim()) return true
  const n = q.trim().toLowerCase()
  return (hay ?? "").toLowerCase().includes(n)
}

export function createAgentTools() {
  return {
    searchProjects: tool({
      description: "Cerca projectes per nom (llista compacta amb pressupost i progrés).",
      inputSchema: z.object({
        q: z.string().optional().describe("Text a cercar al nom"),
        limit: z.number().int().min(1).max(30).default(15),
      }),
      execute: async ({ q, limit }) => {
        const rows = await listProjects()
        const filtered = rows.filter((p) => matchQ(p.name, q))
        const { items, truncated, total } = take(
          filtered.map((p) => ({
            id: p.id,
            name: p.name,
            maxBudget: p.maxBudget,
            directBudget: p.directBudget,
            indirectBudget: p.indirectBudget,
            openedAt: p.openedAt,
            closedAt: p.closedAt,
            costs: p.costs,
            progress: p.progress,
            remaining: Math.max(0, p.maxBudget - p.costs.total),
            clients: p.clients.map((c) => ({
              id: c.id,
              name: c.name,
              percentage: c.percentage,
            })),
          })),
          limit
        )
        return { items, truncated, total }
      },
    }),

    getProject: tool({
      description:
        "Detall d'un projecte: pressupost, costos, clients, activitats i resums de factures/nòmines assignades.",
      inputSchema: z.object({ id: uuid }),
      execute: async ({ id }) => {
        const p = await getProject(id)
        if (!p) return { ok: false as const, error: "Projecte no trobat" }
        return {
          ok: true as const,
          project: {
            id: p.id,
            name: p.name,
            description: p.description,
            openedAt: p.openedAt,
            closedAt: p.closedAt,
            maxBudget: p.maxBudget,
            directBudget: p.directBudget,
            indirectBudget: p.indirectBudget,
            costs: p.costs,
            progress: p.progress,
            remaining: Math.max(0, p.maxBudget - p.costs.total),
            clients: p.clients.map((c) => ({
              id: c.id,
              name: c.name,
              percentage: c.percentage,
            })),
            activities: p.activities,
            categoryTotals: p.categoryTotals,
            invoices: take(
              p.invoices.map((i) => ({
                id: i.id,
                number: i.number,
                supplierName: i.supplierName,
                issueDate: i.issueDate,
                cost: i.cost,
                percentage: i.percentage,
                imputed: i.imputed,
                activityId: i.activityId,
                activityName: i.activityName,
                categories: i.categories,
              })),
              25
            ),
            payroll: p.payroll.map((g) => ({
              payrollId: g.payrollId,
              personName: g.personName,
              role: g.role,
              total: g.total,
              entries: take(
                g.entries.map((e) => ({
                  entryId: e.entryId,
                  month: e.month,
                  amount: e.amount,
                  percentage: e.percentage,
                  imputed: e.imputed,
                  costType: e.costType,
                  activityId: e.activityId,
                  activityName: e.activityName,
                })),
                24
              ),
            })),
          },
        }
      },
    }),

    searchClients: tool({
      description: "Cerca clients (finançadors) per nom.",
      inputSchema: z.object({
        q: z.string().optional(),
        limit: z.number().int().min(1).max(30).default(15),
      }),
      execute: async ({ q, limit }) => {
        const rows = await listClients()
        const filtered = rows.filter(
          (c) => matchQ(c.name, q) || matchQ(c.legalName, q) || matchQ(c.taxId, q)
        )
        const { items, truncated, total } = take(
          filtered.map((c) => ({
            id: c.id,
            name: c.name,
            legalName: c.legalName,
            taxId: c.taxId,
            projects: c.projects.map((pc) => ({
              id: pc.project.id,
              name: pc.project.name,
              percentage: pc.percentage,
            })),
          })),
          limit
        )
        return { items, truncated, total }
      },
    }),

    getClient: tool({
      description: "Detall d'un client i els seus projectes.",
      inputSchema: z.object({ id: uuid }),
      execute: async ({ id }) => {
        const c = await getClient(id)
        if (!c) return { ok: false as const, error: "Client no trobat" }
        return {
          ok: true as const,
          client: {
            id: c.id,
            name: c.name,
            legalName: c.legalName,
            taxId: c.taxId,
            email: c.email,
            city: c.city,
            notes: c.notes,
            projects: c.projects.map((pc) => ({
              id: pc.project.id,
              name: pc.project.name,
              percentage: pc.percentage,
              maxBudget: pc.project.maxBudget,
            })),
          },
        }
      },
    }),

    getClientBilling: tool({
      description:
        "Import facturable a un client en un període (costos dels projectes × % del client).",
      inputSchema: z.object({
        clientId: uuid,
        from: z.string().describe("Data inici YYYY-MM-DD"),
        to: z.string().describe("Data fi YYYY-MM-DD"),
      }),
      execute: async ({ clientId, from, to }) => getClientBilling(clientId, from, to),
    }),

    searchInvoices: tool({
      description: "Cerca factures de proveïdor (número, proveïdor, descripció).",
      inputSchema: z.object({
        q: z.string().optional(),
        projectId: uuid.optional(),
        supplierId: uuid.optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        assignment: z.enum(["completa", "pendent", "parcial"]).optional(),
        limit: z.number().int().min(1).max(30).default(15),
      }),
      execute: async ({ limit, ...filters }) => {
        const rows = await listInvoices(filters)
        const { items, truncated, total } = take(
          rows.map((r) => ({
            id: r.id,
            number: r.number,
            issueDate: r.issueDate,
            supplierName: r.supplierName,
            supplierId: r.supplierId,
            description: r.description,
            baseAmount: r.baseAmount,
            total: r.total,
            cost: r.cost,
            costType: r.costType,
            assigned: r.assigned,
            allocations: r.allocations,
            categories: r.categories,
          })),
          limit
        )
        return { items, truncated, total }
      },
    }),

    getInvoice: tool({
      description: "Detall d'una factura per id.",
      inputSchema: z.object({ id: uuid }),
      execute: async ({ id }) => {
        const r = await db.query.supplierInvoices.findFirst({
          where: eq(supplierInvoices.id, id),
          with: {
            projects: { with: { project: { columns: { id: true, name: true } } } },
            categories: { with: { category: { columns: { id: true, name: true } } } },
          },
        })
        if (!r) return { ok: false as const, error: "Factura no trobada" }
        const cost = invoiceCost(r)
        const assigned = round2(r.projects.reduce((s, p) => s + p.percentage, 0))
        const categories = r.categories
          .map((c) => c.category)
          .sort((a, b) => a.name.localeCompare(b.name))
        return {
          ok: true as const,
          invoice: {
            id: r.id,
            number: r.number,
            issueDate: r.issueDate,
            description: r.description,
            supplierId: r.supplierId,
            supplierName: r.supplierName,
            supplierTaxId: r.supplierTaxId,
            baseAmount: r.baseAmount,
            vatRate: r.vatRate,
            vatDeductibleRate: r.vatDeductibleRate,
            irpfRate: r.irpfRate,
            total: r.total,
            cost,
            costType: r.costType,
            assigned,
            allocations: r.projects.map((p) => ({
              projectId: p.projectId,
              name: p.project.name,
              percentage: p.percentage,
              activityId: p.activityId,
            })),
            categories,
            categoryIds: categories.map((c) => c.id),
          },
        }
      },
    }),

    searchSuppliers: tool({
      description: "Cerca proveïdors per nom o NIF.",
      inputSchema: z.object({
        q: z.string().optional(),
        limit: z.number().int().min(1).max(30).default(15),
      }),
      execute: async ({ q, limit }) => {
        const rows = await listSuppliers()
        const filtered = rows.filter(
          (s) => matchQ(s.name, q) || matchQ(s.taxId, q) || matchQ(s.email, q)
        )
        const { items, truncated, total } = take(
          filtered.map((s) => ({
            id: s.id,
            name: s.name,
            taxId: s.taxId,
            email: s.email,
            defaultVatRate: s.defaultVatRate,
            defaultIrpfRate: s.defaultIrpfRate,
          })),
          limit
        )
        return { items, truncated, total }
      },
    }),

    getSupplier: tool({
      description: "Detall d'un proveïdor.",
      inputSchema: z.object({ id: uuid }),
      execute: async ({ id }) => {
        const s = await getSupplier(id)
        if (!s) return { ok: false as const, error: "Proveïdor no trobat" }
        return { ok: true as const, supplier: s }
      },
    }),

    searchPayrolls: tool({
      description: "Cerca nòmines per nom de persona o rol.",
      inputSchema: z.object({
        q: z.string().optional(),
        limit: z.number().int().min(1).max(30).default(15),
      }),
      execute: async ({ q, limit }) => {
        const rows = await listPayrolls()
        const filtered = rows.filter(
          (p) => matchQ(p.personName, q) || matchQ(p.role, q) || matchQ(p.personTaxId, q)
        )
        const { items, truncated, total } = take(
          filtered.map((p) => ({
            id: p.id,
            personName: p.personName,
            role: p.role,
            monthlyAmount: p.monthlyAmount,
            startMonth: p.startMonth,
            endMonth: p.endMonth,
            firstMonth: p.firstMonth,
            lastMonth: p.lastMonth,
            total: p.total,
            assignedPct: p.assignedPct,
          })),
          limit
        )
        return { items, truncated, total }
      },
    }),

    getPayroll: tool({
      description: "Detall d'una nòmina amb entrades mensuals i assignacions.",
      inputSchema: z.object({ id: uuid }),
      execute: async ({ id }) => {
        const p = await getPayroll(id)
        if (!p) return { ok: false as const, error: "Nòmina no trobada" }
        const entries = take(
          p.entries.map((e) => ({
            id: e.id,
            month: e.month,
            amount: e.amount,
            assigned: e.assigned,
            allocations: e.allocations,
          })),
          36
        )
        return {
          ok: true as const,
          payroll: {
            id: p.id,
            personName: p.personName,
            personTaxId: p.personTaxId,
            role: p.role,
            monthlyAmount: p.monthlyAmount,
            startMonth: p.startMonth,
            endMonth: p.endMonth,
            notes: p.notes,
            entries,
          },
        }
      },
    }),

    getDashboard: tool({
      description: "Resum del dashboard per a un mes (YYYY-MM).",
      inputSchema: z.object({ month: z.string().describe("Mes YYYY-MM") }),
      execute: async ({ month }) => {
        const d = await getDashboard(month)
        return {
          month,
          openCount: d.openCount,
          clientCount: d.clientCount,
          budget: d.budget,
          spent: d.spent,
          monthStats: d.month,
          unassigned: d.unassigned,
          projects: take(
            d.projects.map((p) => ({
              id: p.id,
              name: p.name,
              maxBudget: p.maxBudget,
              costs: p.costs,
              progress: p.progress,
              remaining: Math.max(0, p.maxBudget - p.costs.total),
            })),
            20
          ),
        }
      },
    }),

    listCategories: tool({
      description: "Llista categories de cost globals.",
      inputSchema: z.object({}),
      execute: async () => ({ items: await listCategories() }),
    }),

    listProjectActivities: tool({
      description: "Llista activitats d'un projecte (o totes si no s'indica projecte).",
      inputSchema: z.object({ projectId: uuid.optional() }),
      execute: async ({ projectId }) => {
        const rows = await listProjectActivities()
        const items = projectId ? rows.filter((a) => a.projectId === projectId) : rows
        return { items }
      },
    }),

    saveClient: tool({
      description: "Crea o actualitza un client. Passa id=null per crear.",
      inputSchema: z.object({
        id: uuid.nullable(),
        name: z.string().min(1),
        legalName: optStr,
        taxId: optStr,
        address: optStr,
        postalCode: optStr,
        city: optStr,
        province: optStr,
        country: optStr,
        email: optStr,
        notes: optStr,
      }),
      execute: async ({ id, ...input }) => saveClient(id, input),
    }),

    saveProject: tool({
      description:
        "Crea o actualitza un projecte. Passa id=null per crear. clientAllocations opcional (han de sumar 100%).",
      inputSchema: z.object({
        id: uuid.nullable(),
        name: z.string().min(1),
        description: optStr,
        openedAt: optStr,
        closedAt: optStr,
        maxBudget: z.number(),
        directBudget: z.number().nullable().optional(),
        indirectBudget: z.number().nullable().optional(),
        clientAllocations: z
          .array(z.object({ id: uuid, percentage: z.number().gt(0).lte(100) }))
          .optional(),
      }),
      execute: async ({ id, clientAllocations, ...input }) =>
        saveProject(
          id,
          {
            ...input,
            directBudget: input.directBudget ?? null,
            indirectBudget: input.indirectBudget ?? null,
          },
          clientAllocations
        ),
    }),

    setProjectClients: tool({
      description: "Defineix el repartiment del projecte entre clients (suma exacta 100%).",
      inputSchema: z.object({
        projectId: uuid,
        allocations: z.array(z.object({ id: uuid, percentage: z.number().gt(0).lte(100) })),
      }),
      execute: async ({ projectId, allocations }) => setProjectClients(projectId, allocations),
    }),

    saveSupplier: tool({
      description: "Crea o actualitza un proveïdor. id=null per crear.",
      inputSchema: z.object({
        id: uuid.nullable(),
        name: z.string().min(1),
        taxId: optStr,
        address: optStr,
        postalCode: optStr,
        city: optStr,
        province: optStr,
        country: optStr,
        email: optStr,
        phone: optStr,
        iban: optStr,
        defaultVatRate: z.number().min(0).max(100).default(21),
        defaultIrpfRate: z.number().min(0).max(100).default(0),
        notes: optStr,
      }),
      execute: async ({ id, ...input }) => saveSupplier(id, input),
    }),

    extractInvoiceFromPathname: tool({
      description:
        "Extreu camps d'una factura PDF/imatge ja pujada al Blob (pathname invoices/...).",
      inputSchema: z.object({ pathname: z.string().min(1) }),
      execute: async ({ pathname }) => extractInvoiceFromPathname(pathname),
    }),

    saveInvoice: tool({
      description:
        "Crea o actualitza una factura. Passa file amb pathname del Blob si n'hi ha d'adjunt. allocations: projectes amb % (suma ≤100). id=null per crear.",
      inputSchema: z.object({
        id: uuid.nullable(),
        number: z.string().min(1),
        issueDate: z.string().min(1),
        description: optStr,
        supplierId: uuid.nullable().optional(),
        supplierName: z.string().min(1),
        supplierTaxId: optStr,
        supplierAddress: optStr,
        supplierPostalCode: optStr,
        supplierCity: optStr,
        baseAmount: z.number(),
        vatRate: z.number().min(0).max(100),
        vatDeductibleRate: z.number().min(0).max(100).default(100),
        irpfRate: z.number().min(0).max(100).default(0),
        costType: costType,
        createSupplier: z.boolean().optional(),
        categoryIds: z.array(uuid).optional(),
        file: z
          .object({
            filePathname: z.string().min(1),
            fileName: z.string().min(1),
          })
          .nullable()
          .optional(),
        allocations: z
          .array(
            z.object({
              id: uuid.describe("projectId"),
              percentage: z.number().gt(0).lte(100),
              activityId: uuid.nullable().optional(),
            })
          )
          .default([]),
      }),
      execute: async ({
        id,
        createSupplier,
        categoryIds,
        file,
        allocations,
        ...input
      }) =>
        saveInvoice(id, { ...input, file: file ?? null }, allocations, {
          createSupplier,
          categoryIds,
        }),
    }),

    assignInvoiceToProject: tool({
      description: "Assigna (o actualitza) el % d'una factura a un projecte.",
      inputSchema: z.object({
        projectId: uuid,
        invoiceId: uuid,
        percentage: z.number().gt(0).lte(100),
        activityId: uuid.nullable().optional(),
      }),
      execute: async (args) =>
        assignInvoiceToProject(args.projectId, args.invoiceId, args.percentage, args.activityId),
    }),

    unassignInvoiceFromProject: tool({
      description: "Treu l'assignació d'una factura a un projecte.",
      inputSchema: z.object({ projectId: uuid, invoiceId: uuid }),
      execute: async ({ projectId, invoiceId }) =>
        unassignInvoiceFromProject(projectId, invoiceId),
    }),

    setInvoiceProjectActivity: tool({
      description: "Canvia l'activitat d'una factura ja assignada a un projecte (null per treure-la).",
      inputSchema: z.object({
        projectId: uuid,
        invoiceId: uuid,
        activityId: uuid.nullable(),
      }),
      execute: async ({ projectId, invoiceId, activityId }) =>
        setInvoiceProjectActivity(projectId, invoiceId, activityId),
    }),

    createPayroll: tool({
      description: "Crea una nòmina amb entrades mensuals i assignacions opcionals a projectes.",
      inputSchema: z.object({
        personName: z.string().min(1),
        personTaxId: optStr,
        role: optStr,
        monthlyAmount: z.number().min(0),
        startMonth: z.string().min(7),
        endMonth: optStr,
        notes: optStr,
        allocations: z
          .array(
            z.object({
              id: uuid.describe("projectId"),
              percentage: z.number().gt(0).lte(100),
              costType: costType.optional(),
              categoryIds: z.array(uuid).optional(),
              activityId: uuid.nullable().optional(),
            })
          )
          .default([]),
      }),
      execute: async ({ allocations, ...input }) => createPayroll(input, allocations),
    }),

    updatePayrollInfo: tool({
      description: "Actualitza dades de nòmina que no afecten imports.",
      inputSchema: z.object({
        id: uuid,
        personName: z.string().min(1),
        personTaxId: optStr,
        role: optStr,
        endMonth: optStr,
        notes: optStr,
      }),
      execute: async ({ id, ...input }) => updatePayrollInfo(id, input),
    }),

    changePayrollAmount: tool({
      description:
        "Canvia l'import mensual. scope: current | future | all respecte al mes de referència.",
      inputSchema: z.object({
        payrollId: uuid,
        amount: z.number().min(0),
        scope: changeScope,
        referenceMonth: z.string().describe("YYYY-MM"),
      }),
      execute: async ({ payrollId, amount, scope, referenceMonth }) =>
        changePayrollAmount(payrollId, amount, scope, referenceMonth),
    }),

    assignPayrollToProject: tool({
      description: "Assigna una nòmina a un projecte per a un rang de mesos.",
      inputSchema: z.object({
        projectId: uuid,
        payrollId: uuid,
        fromMonth: z.string(),
        toMonth: z.string(),
        percentage: z.number().gt(0).lte(100),
        costType: costType.optional(),
        categoryIds: z.array(uuid).optional(),
        activityId: uuid.nullable().optional(),
      }),
      execute: async (a) =>
        assignPayrollToProject(
          a.projectId,
          a.payrollId,
          a.fromMonth,
          a.toMonth,
          a.percentage,
          a.costType,
          a.categoryIds ?? [],
          a.activityId
        ),
    }),

    unassignPayrollEntries: tool({
      description: "Treu assignacions de partides de nòmina d'un projecte.",
      inputSchema: z.object({
        projectId: uuid,
        entryIds: z.array(uuid).min(1),
      }),
      execute: async ({ projectId, entryIds }) => unassignPayrollEntries(projectId, entryIds),
    }),

    setPayrollEntryProjects: tool({
      description:
        "Defineix les assignacions a projectes d'una nòmina per a un mes (i abast current/future/all).",
      inputSchema: z.object({
        payrollId: uuid,
        referenceMonth: z.string(),
        scope: changeScope,
        allocations: z.array(
          z.object({
            id: uuid.describe("projectId"),
            percentage: z.number().gt(0).lte(100),
            costType: costType.optional(),
            categoryIds: z.array(uuid).optional(),
            activityId: uuid.nullable().optional(),
          })
        ),
      }),
      execute: async ({ payrollId, referenceMonth, scope, allocations }) =>
        setPayrollEntryProjects(payrollId, referenceMonth, scope, allocations),
    }),

    createCategory: tool({
      description: "Crea una categoria de cost.",
      inputSchema: z.object({ name: z.string().min(1) }),
      execute: async ({ name }) => createCategory(name),
    }),

    renameCategory: tool({
      description: "Reanomena una categoria de cost.",
      inputSchema: z.object({ categoryId: uuid, name: z.string().min(1) }),
      execute: async ({ categoryId, name }) => renameCategory(categoryId, name),
    }),

    createProjectActivity: tool({
      description: "Crea una activitat dins d'un projecte (pressupost opcional).",
      inputSchema: z.object({
        projectId: uuid,
        name: z.string().min(1),
        budget: z.number().nullable().optional(),
      }),
      execute: async ({ projectId, name, budget }) =>
        createProjectActivity(projectId, { name, budget: budget ?? null }),
    }),

    updateProjectActivity: tool({
      description: "Actualitza nom/pressupost d'una activitat.",
      inputSchema: z.object({
        projectId: uuid,
        activityId: uuid,
        name: z.string().min(1),
        budget: z.number().nullable().optional(),
      }),
      execute: async ({ projectId, activityId, name, budget }) =>
        updateProjectActivity(projectId, activityId, { name, budget: budget ?? null }),
    }),
  }
}

export type AgentTools = ReturnType<typeof createAgentTools>
