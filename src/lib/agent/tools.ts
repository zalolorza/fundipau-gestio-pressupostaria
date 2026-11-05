import "server-only"

import { eq } from "drizzle-orm"
import { tool } from "ai"
import { z } from "zod"

import { db } from "@/db"
import { supplierInvoices } from "@/db/schema"
import { take } from "@/lib/agent/truncate"
import { round2 } from "@/lib/format"
import { funderKeyFromColumns } from "@/lib/funders"
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
  saveSubsidy,
  saveSupplier,
  setInvoiceProjectActivity,
  setInvoiceProjectFunder,
  setPayrollEntryProjectActivity,
  setPayrollEntryProjectFunder,
  setPayrollEntryProjects,
  setProjectFunders,
  setSubsidyClients,
  setSubsidyProjects,
  unassignInvoiceAllocation,
  unassignPayrollAllocations,
  updatePayrollInfo,
  updateProjectActivity,
} from "@/server/actions"
import { extractInvoiceFromPathname } from "@/server/invoice-extract-actions"
import {
  getClient,
  getClientBilling,
  getClientProjectLinks,
  getDashboard,
  getPayroll,
  getProject,
  getSubsidy,
  getSubsidyBilling,
  getSupplier,
  listCategories,
  listClients,
  listInvoices,
  listPayrolls,
  listProjectActivities,
  listProjects,
  listSubsidies,
  listSuppliers,
} from "@/server/queries"
import {
  getRevision,
  listRevisions,
  REVISION_ENTITY_TYPES,
  restoreRevision,
} from "@/server/revisions"

const revisionEntityType = z.enum(REVISION_ENTITY_TYPES)

const uuid = z.string().uuid()
const optStr = z.string().optional().nullable()
const costType = z.enum(["direct", "indirect"]).default("direct")
const changeScope = z.enum(["current", "future", "all"])
const funderKeySchema = z
  .string()
  .regex(/^(client|subsidy):[0-9a-f-]{36}$/i)
  .describe("client:uuid o subsidy:uuid")
/** Opcional a les assignacions; null/omès = % del projecte. */
const funderId = funderKeySchema.nullable().optional()

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
            subsidies: p.subsidies.map((s) => ({
              id: s.id,
              name: s.name,
              percentage: s.percentage,
            })),
          })),
          limit
        )
        return { items, truncated, total }
      },
    }),

    getProject: tool({
      description:
        "Detall d'un projecte: pressupost, costos, finançadors (directes i subvencions), activitats i resums de factures/nòmines assignades.",
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
            subsidies: p.subsidies.map((s) => ({
              id: s.id,
              name: s.name,
              percentage: s.percentage,
              clients: s.clients.map((c) => ({
                id: c.id,
                name: c.name,
                percentage: c.percentage,
              })),
            })),
            activities: p.activities,
            categoryTotals: p.categoryTotals,
            invoices: take(
              p.invoices.map((i) => ({
                allocationId: i.allocationId,
                id: i.id,
                number: i.number,
                supplierName: i.supplierName,
                issueDate: i.issueDate,
                cost: i.cost,
                percentage: i.percentage,
                imputed: i.imputed,
                activityId: i.activityId,
                activityName: i.activityName,
                funderId: i.funderId,
                funderName: i.funderName,
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
                  allocationId: e.allocationId,
                  entryId: e.entryId,
                  month: e.month,
                  amount: e.amount,
                  percentage: e.percentage,
                  imputed: e.imputed,
                  costType: e.costType,
                  activityId: e.activityId,
                  activityName: e.activityName,
                  funderId: e.funderId,
                  funderName: e.funderName,
                })),
                24
              ),
            })),
          },
        }
      },
    }),

    searchClients: tool({
      description: "Cerca finançadors per nom.",
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
      description:
        "Detall d'un finançador: projectes amb % efectiu (directe + via subvencions) i subvencions que finança.",
      inputSchema: z.object({ id: uuid }),
      execute: async ({ id }) => {
        const [c, projectLinks] = await Promise.all([
          getClient(id),
          getClientProjectLinks(id),
        ])
        if (!c) return { ok: false as const, error: "Finançador no trobat" }
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
            projects: projectLinks.map((pc) => ({
              id: pc.project.id,
              name: pc.project.name,
              percentage: pc.percentage,
              maxBudget: pc.project.maxBudget,
            })),
            projectsDirect: c.projects.map((pc) => ({
              id: pc.project.id,
              name: pc.project.name,
              percentage: pc.percentage,
            })),
            subsidies: c.subsidies.map((sc) => ({
              id: sc.subsidy.id,
              name: sc.subsidy.name,
              percentage: sc.percentage,
              total: sc.subsidy.total,
            })),
          },
        }
      },
    }),

    getClientBilling: tool({
      description:
        "Import facturable a un finançador en un període (costos dels projectes × % efectiu del finançador, incloent via subvencions).",
      inputSchema: z.object({
        clientId: uuid,
        from: z.string().describe("Data inici YYYY-MM-DD"),
        to: z.string().describe("Data fi YYYY-MM-DD"),
      }),
      execute: async ({ clientId, from, to }) => getClientBilling(clientId, from, to),
    }),

    getSubsidyBilling: tool({
      description:
        "Costos imputats a una subvenció (sense filtre temporal): factures i nòmines dels projectes × % de la subvenció (o 100 % si el finançador de la fila és aquesta subvenció). El total és el progrés d'assignacions respecte al total de la subvenció.",
      inputSchema: z.object({ subsidyId: uuid }),
      execute: async ({ subsidyId }) => getSubsidyBilling(subsidyId),
    }),

    searchSubsidies: tool({
      description:
        "Cerca subvencions per nom (total, assignat a projectes i disponible).",
      inputSchema: z.object({
        q: z.string().optional(),
        limit: z.number().int().min(1).max(30).default(15),
      }),
      execute: async ({ q, limit }) => {
        const rows = await listSubsidies()
        const filtered = rows.filter((s) => matchQ(s.name, q) || matchQ(s.notes, q))
        const { items, truncated, total } = take(
          filtered.map((s) => ({
            id: s.id,
            name: s.name,
            total: s.total,
            allocated: s.allocated,
            available: s.available,
            clients: s.clients.map((c) => ({
              id: c.id,
              name: c.name,
              percentage: c.percentage,
            })),
            projects: s.projects.map((p) => ({
              id: p.id,
              name: p.name,
              percentage: p.percentage,
              amount: p.amount,
            })),
          })),
          limit
        )
        return { items, truncated, total }
      },
    }),

    getSubsidy: tool({
      description:
        "Detall d'una subvenció: total, assignat a projectes/disponible, finançadors i projectes (amb import). Per al progrés d'imputació (factures/nòmines) usa getSubsidyBilling.",
      inputSchema: z.object({ id: uuid }),
      execute: async ({ id }) => {
        const s = await getSubsidy(id)
        if (!s) return { ok: false as const, error: "Subvenció no trobada" }
        return {
          ok: true as const,
          subsidy: {
            id: s.id,
            name: s.name,
            total: s.total,
            allocated: s.allocated,
            available: s.available,
            notes: s.notes,
            clients: s.clients.map((c) => ({
              id: c.id,
              name: c.name,
              percentage: c.percentage,
            })),
            projects: s.projects.map((p) => ({
              id: p.id,
              name: p.name,
              percentage: p.percentage,
              amount: p.amount,
              maxBudget: p.maxBudget,
            })),
          },
        }
      },
    }),

    searchInvoices: tool({
      description: "Cerca factures de proveïdor (número, proveïdor, descripció).",
      inputSchema: z.object({
        q: z.string().optional(),
        projectId: uuid.optional(),
        supplierId: uuid.optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        assignment: z
          .enum(["completa", "pendent", "parcial"])
          .optional()
          .describe("completa ≥100 %, pendent =0, parcial 0–100"),
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
      description:
        "Detall d'una factura per id (inclosos allocationId i finançador de cada assignació).",
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
              allocationId: p.id,
              projectId: p.projectId,
              name: p.project.name,
              percentage: p.percentage,
              activityId: p.activityId,
              funderId: funderKeyFromColumns(p.clientId, p.subsidyId),
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
      description:
        "Detall d'una nòmina amb entrades mensuals i assignacions (allocationId, funderId).",
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
            allocations: e.allocations.map((a) => ({
              allocationId: a.allocationId,
              projectId: a.projectId,
              name: a.name,
              percentage: a.percentage,
              costType: a.costType,
              activityId: a.activityId,
              funderId: a.funderId,
              categoryIds: a.categoryIds,
            })),
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
      description: "Crea o actualitza un finançador. Passa id=null per crear.",
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
        "Crea o actualitza un projecte. id=null per crear. clientAllocations i subsidyAllocations junts han de sumar 100 %. L'import de cada subvenció (maxBudget×%/100) no pot superar el disponible de la subvenció.",
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
        subsidyAllocations: z
          .array(z.object({ id: uuid, percentage: z.number().gt(0).lte(100) }))
          .optional(),
      }),
      execute: async ({ id, clientAllocations, subsidyAllocations, ...input }) =>
        saveProject(
          id,
          {
            ...input,
            directBudget: input.directBudget ?? null,
            indirectBudget: input.indirectBudget ?? null,
          },
          clientAllocations || subsidyAllocations
            ? {
                clients: clientAllocations ?? [],
                subsidies: subsidyAllocations ?? [],
              }
            : undefined
        ),
    }),

    setProjectFunders: tool({
      description:
        "Defineix el repartiment del projecte entre finançadors i/o subvencions (suma exacta 100 %). No superar el total disponible de cada subvenció.",
      inputSchema: z.object({
        projectId: uuid,
        clients: z
          .array(z.object({ id: uuid, percentage: z.number().gt(0).lte(100) }))
          .default([]),
        subsidies: z
          .array(z.object({ id: uuid, percentage: z.number().gt(0).lte(100) }))
          .default([]),
      }),
      execute: async ({ projectId, clients, subsidies }) =>
        setProjectFunders(projectId, { clients, subsidies }),
    }),

    saveSubsidy: tool({
      description:
        "Crea o actualitza una subvenció. id=null per crear. El total no pot ser inferior a l'assignat a projectes. clientAllocations opcional (≤100 %, no cal arribar-hi). projectAllocations: % del pressupost de cada projecte; la suma d'imports no pot superar el total.",
      inputSchema: z.object({
        id: uuid.nullable(),
        name: z.string().min(1),
        total: z.number(),
        notes: optStr,
        clientAllocations: z
          .array(z.object({ id: uuid, percentage: z.number().gt(0).lte(100) }))
          .optional(),
        projectAllocations: z
          .array(z.object({ id: uuid, percentage: z.number().gt(0).lte(100) }))
          .optional(),
      }),
      execute: async ({ id, clientAllocations, projectAllocations, ...input }) =>
        saveSubsidy(id, input, clientAllocations, projectAllocations),
    }),

    setSubsidyClients: tool({
      description:
        "Defineix els finançadors d'una subvenció (≤100 %; no cal arribar-hi).",
      inputSchema: z.object({
        subsidyId: uuid,
        allocations: z.array(z.object({ id: uuid, percentage: z.number().gt(0).lte(100) })),
      }),
      execute: async ({ subsidyId, allocations }) => setSubsidyClients(subsidyId, allocations),
    }),

    setSubsidyProjects: tool({
      description:
        "Defineix els projectes finançats per una subvenció. Cada % és sobre el pressupost del projecte; la suma d'imports no pot superar el total. Els altres finançadors de cada projecte es reescalen per completar el 100 %.",
      inputSchema: z.object({
        subsidyId: uuid,
        allocations: z.array(z.object({ id: uuid, percentage: z.number().gt(0).lte(100) })),
      }),
      execute: async ({ subsidyId, allocations }) => setSubsidyProjects(subsidyId, allocations),
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
        "Crea o actualitza una factura. Passa file amb pathname del Blob si n'hi ha d'adjunt. allocations: files projecte+% (mateix projecte permès; suma pot >100). id=null per crear.",
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
              funderId,
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
      description:
        "Afegeix una assignació d'una factura a un projecte (no substitueix; la suma pot superar 100 %). Retorna allocationId.",
      inputSchema: z.object({
        projectId: uuid,
        invoiceId: uuid,
        percentage: z.number().gt(0).lte(100),
        activityId: uuid.nullable().optional(),
        funderId,
      }),
      execute: async (args) =>
        assignInvoiceToProject(
          args.projectId,
          args.invoiceId,
          args.percentage,
          args.activityId,
          args.funderId
        ),
    }),

    unassignInvoiceAllocation: tool({
      description: "Elimina una assignació concreta de factura (per allocationId).",
      inputSchema: z.object({ allocationId: uuid }),
      execute: async ({ allocationId }) => unassignInvoiceAllocation(allocationId),
    }),

    setInvoiceProjectActivity: tool({
      description: "Canvia l'activitat d'una assignació de factura (null per treure-la).",
      inputSchema: z.object({
        allocationId: uuid,
        activityId: uuid.nullable(),
      }),
      execute: async ({ allocationId, activityId }) =>
        setInvoiceProjectActivity(allocationId, activityId),
    }),

    setInvoiceProjectFunder: tool({
      description:
        "Canvia el finançador d'una assignació de factura (client:uuid / subsidy:uuid; null = % del projecte).",
      inputSchema: z.object({
        allocationId: uuid,
        funderId: funderKeySchema.nullable(),
      }),
      execute: async ({ allocationId, funderId: key }) =>
        setInvoiceProjectFunder(allocationId, key),
    }),

    createPayroll: tool({
      description:
        "Crea una nòmina amb entrades mensuals i assignacions opcionals (mateix projecte permès; suma pot >100 %).",
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
              funderId,
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
      description:
        "Afegeix assignacions d'una nòmina a un projecte per a un rang de mesos (no substitueix; suma pot >100 %).",
      inputSchema: z.object({
        projectId: uuid,
        payrollId: uuid,
        fromMonth: z.string(),
        toMonth: z.string(),
        percentage: z.number().gt(0).lte(100),
        costType: costType.optional(),
        categoryIds: z.array(uuid).optional(),
        activityId: uuid.nullable().optional(),
        funderId,
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
          a.activityId,
          a.funderId
        ),
    }),

    unassignPayrollAllocations: tool({
      description: "Elimina assignacions concretes de nòmina (per allocationId).",
      inputSchema: z.object({
        allocationIds: z.array(uuid).min(1),
      }),
      execute: async ({ allocationIds }) => unassignPayrollAllocations(allocationIds),
    }),

    setPayrollEntryProjectActivity: tool({
      description: "Canvia l'activitat d'una assignació de nòmina (per allocationId).",
      inputSchema: z.object({
        allocationId: uuid,
        activityId: uuid.nullable(),
      }),
      execute: async ({ allocationId, activityId }) =>
        setPayrollEntryProjectActivity(allocationId, activityId),
    }),

    setPayrollEntryProjectFunder: tool({
      description: "Canvia el finançador d'una assignació de nòmina (null = % del projecte).",
      inputSchema: z.object({
        allocationId: uuid,
        funderId: funderKeySchema.nullable(),
      }),
      execute: async ({ allocationId, funderId: key }) =>
        setPayrollEntryProjectFunder(allocationId, key),
    }),

    setPayrollEntryProjects: tool({
      description:
        "Substitueix les assignacions a projectes d'una nòmina per a un mes (abast current/future/all). Projectes repetibles; suma pot >100 %.",
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
            funderId,
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

    listRevisions: tool({
      description:
        "Llista l'historial de revisions d'una entitat (factura, entrada de nòmina, nòmina, projecte, subvenció o finançador). Usa entityId estable del pare, no allocationId.",
      inputSchema: z.object({
        entityType: revisionEntityType,
        entityId: uuid,
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ entityType, entityId, limit }) => {
        const rows = await listRevisions({ entityType, entityId, limit })
        return {
          items: rows.map((r) => ({
            id: r.id,
            action: r.action,
            summary: r.summary,
            createdAt: r.createdAt,
            actor: r.actorName ?? r.actorEmail ?? r.actorUserId,
          })),
        }
      },
    }),

    getRevision: tool({
      description:
        "Detall d'una revisió (snapshot before). Útil abans de restaurar o per explicar què s'ha perdut.",
      inputSchema: z.object({ revisionId: uuid }),
      execute: async ({ revisionId }) => {
        const rev = await getRevision(revisionId)
        if (!rev) return { ok: false as const, error: "Revisió no trobada" }
        const beforeJson = JSON.stringify(rev.before)
        const truncated = beforeJson.length > 12_000
        return {
          ok: true as const,
          id: rev.id,
          entityType: rev.entityType,
          entityId: rev.entityId,
          action: rev.action,
          summary: rev.summary,
          createdAt: rev.createdAt,
          actor: rev.actorName ?? rev.actorEmail ?? rev.actorUserId,
          before: truncated ? beforeJson.slice(0, 12_000) + "…" : rev.before,
          beforeTruncated: truncated,
        }
      },
    }),

    restoreRevision: tool({
      description:
        "Restaura l'estat d'una entitat (i el seu graf de relacions) a partir d'una revisió. Només amb confirmació clara de l'usuari. Els UUID d'assignació es regeneren; el PDF de factura no es recupera si el Blob ja s'ha esborrat.",
      inputSchema: z.object({
        revisionId: uuid,
        confirmed: z
          .boolean()
          .describe("Ha de ser true només si l'usuari ha confirmat explícitament la restauració"),
      }),
      execute: async ({ revisionId, confirmed }) => {
        if (!confirmed) {
          return {
            ok: false as const,
            error: "Cal confirmació explícita de l'usuari (confirmed: true)",
          }
        }
        return restoreRevision(revisionId)
      },
    }),
  }
}

export type AgentTools = ReturnType<typeof createAgentTools>
