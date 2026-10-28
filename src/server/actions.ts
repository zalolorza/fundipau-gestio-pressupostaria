"use server"

import { del } from "@vercel/blob"
import { and, eq, gte, inArray, ne, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { db } from "@/db"
import {
  clients,
  invoiceProjects,
  payrollEntries,
  payrollEntryProjects,
  payrolls,
  projectClients,
  projects,
  supplierInvoices,
  suppliers,
} from "@/db/schema"
import { requireSession } from "@/lib/auth"
import { round2 } from "@/lib/format"
import { computeInvoice } from "@/lib/invoice"
import { isInvoiceFilePathname } from "@/lib/invoice-file"
import { addMonths, endOfYear, monthRange, toMonth } from "@/lib/months"

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

const allocationSchema = z.array(z.object({ id: z.string().uuid(), percentage: pct }))
type Allocation = z.infer<typeof allocationSchema>

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Dades no vàlides" }
  console.error(e)
  return { ok: false, error: e instanceof Error ? e.message : "S'ha produït un error" }
}

function checkAllocations(list: Allocation, mode: "exact" | "max") {
  const ids = new Set(list.map((a) => a.id))
  if (ids.size !== list.length) throw new Error("Hi ha elements repetits a l'assignació")
  const sum = round2(list.reduce((s, a) => s + a.percentage, 0))
  if (mode === "exact" && list.length > 0 && sum !== 100)
    throw new Error(`Els percentatges han de sumar 100 % (ara sumen ${sum} %)`)
  if (sum > 100) throw new Error(`Els percentatges no poden superar el 100 % (ara sumen ${sum} %)`)
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
    revalidatePath("/clients")
    revalidatePath(`/clients/${clientId}`)
    return { ok: true, data: { id: clientId! } }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteClient(id: string) {
  await requireSession()
  await db.delete(clients).where(eq(clients.id, id))
  revalidatePath("/clients")
  redirect("/clients")
}

/* ------------------------------- Projectes ------------------------------- */

const projectSchema = z
  .object({
    name: z.string().trim().min(1, "El nom és obligatori"),
    description: optText,
    openedAt: optDate,
    closedAt: optDate,
    maxBudget: money.min(0, "El pressupost no pot ser negatiu"),
  })
  .refine((p) => !p.openedAt || !p.closedAt || p.closedAt >= p.openedAt, {
    message: "La data de tancament ha de ser posterior a la d'obertura",
  })
export type ProjectInput = z.input<typeof projectSchema>

export async function saveProject(
  id: string | null,
  input: ProjectInput,
  clientAllocations?: { id: string; percentage: number }[]
): Promise<ActionResult<{ id: string }>> {
  await requireSession()
  try {
    const data = projectSchema.parse(input)
    let projectId = id
    if (id) await db.update(projects).set(data).where(eq(projects.id, id))
    else [{ id: projectId }] = await db.insert(projects).values(data).returning({ id: projects.id })

    if (clientAllocations) {
      const res = await setProjectClients(projectId!, clientAllocations)
      if (!res.ok) return res
    }
    revalidatePath("/projectes")
    revalidatePath(`/projectes/${projectId}`)
    revalidatePath("/")
    return { ok: true, data: { id: projectId! } }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteProject(id: string) {
  await requireSession()
  await db.delete(projects).where(eq(projects.id, id))
  revalidatePath("/projectes")
  revalidatePath("/")
  redirect("/projectes")
}

/** Repartiment del projecte entre clients: ha de sumar exactament 100 % */
export async function setProjectClients(
  projectId: string,
  input: { id: string; percentage: number }[]
): Promise<ActionResult> {
  await requireSession()
  try {
    const list = allocationSchema.parse(input)
    checkAllocations(list, "exact")
    const del = db.delete(projectClients).where(eq(projectClients.projectId, projectId))
    if (list.length)
      await db.batch([
        del,
        db.insert(projectClients).values(list.map((a) => ({ projectId, clientId: a.id, percentage: a.percentage }))),
      ])
    else await del
    revalidatePath(`/projectes/${projectId}`)
    revalidatePath("/projectes")
    revalidatePath("/clients", "layout")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

/** Assigna (o actualitza) un percentatge d'una factura a un projecte */
export async function assignInvoiceToProject(
  projectId: string,
  invoiceId: string,
  percentage: number
): Promise<ActionResult> {
  await requireSession()
  try {
    const p = pct.parse(percentage)
    const [{ other }] = await db
      .select({ other: sql<string>`coalesce(sum(${invoiceProjects.percentage}), 0)` })
      .from(invoiceProjects)
      .where(and(eq(invoiceProjects.invoiceId, invoiceId), ne(invoiceProjects.projectId, projectId)))
    const available = round2(100 - Number(other))
    if (p > available)
      throw new Error(`Aquesta factura només té un ${available} % disponible per assignar`)
    await db
      .insert(invoiceProjects)
      .values({ invoiceId, projectId, percentage: p })
      .onConflictDoUpdate({
        target: [invoiceProjects.invoiceId, invoiceProjects.projectId],
        set: { percentage: p },
      })
    revalidatePath(`/projectes/${projectId}`)
    revalidatePath("/factures")
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

export async function unassignInvoiceFromProject(projectId: string, invoiceId: string): Promise<ActionResult> {
  await requireSession()
  await db
    .delete(invoiceProjects)
    .where(and(eq(invoiceProjects.invoiceId, invoiceId), eq(invoiceProjects.projectId, projectId)))
  revalidatePath(`/projectes/${projectId}`)
  revalidatePath("/factures")
  return { ok: true }
}

/**
 * Assigna una nòmina a un projecte per a un rang de mesos.
 * Si manquen registres mensuals, els crea amb l'import del mes més proper
 * (o la quantitat per defecte de la nòmina si encara no n'hi ha cap).
 * Valida que cap mes superi el 100 % assignat.
 */
export async function assignPayrollToProject(
  projectId: string,
  payrollId: string,
  fromMonth: string,
  toMonthValue: string,
  percentage: number
): Promise<ActionResult<{ count: number }>> {
  await requireSession()
  try {
    const p = pct.parse(percentage)
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

    const others = await db
      .select({
        entryId: payrollEntryProjects.entryId,
        sum: sql<string>`sum(${payrollEntryProjects.percentage})`,
      })
      .from(payrollEntryProjects)
      .where(
        and(
          inArray(
            payrollEntryProjects.entryId,
            entries.map((e) => e.id)
          ),
          ne(payrollEntryProjects.projectId, projectId)
        )
      )
      .groupBy(payrollEntryProjects.entryId)
    const otherMap = new Map(others.map((o) => [o.entryId, Number(o.sum)]))
    const over = entries.filter((e) => round2((otherMap.get(e.id) ?? 0) + p) > 100)
    if (over.length)
      throw new Error(
        `Supera el 100 % en ${over.length} ${over.length === 1 ? "mes" : "mesos"} (p. ex. ${over[0].month.slice(0, 7)})`
      )

    await db
      .insert(payrollEntryProjects)
      .values(entries.map((e) => ({ entryId: e.id, projectId, percentage: p })))
      .onConflictDoUpdate({
        target: [payrollEntryProjects.entryId, payrollEntryProjects.projectId],
        set: { percentage: p },
      })
    revalidatePath(`/projectes/${projectId}`)
    revalidatePath(`/nomines/${payrollId}`)
    revalidatePath("/nomines")
    return { ok: true, data: { count: entries.length } }
  } catch (e) {
    return fail(e)
  }
}

export async function unassignPayrollEntries(projectId: string, entryIds: string[]): Promise<ActionResult> {
  await requireSession()
  if (entryIds.length)
    await db
      .delete(payrollEntryProjects)
      .where(and(eq(payrollEntryProjects.projectId, projectId), inArray(payrollEntryProjects.entryId, entryIds)))
  revalidatePath(`/projectes/${projectId}`)
  revalidatePath("/nomines", "layout")
  return { ok: true }
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
  irpfRate: z.coerce.number().min(0).max(100),
  file: invoiceFileSchema,
})
export type InvoiceInput = z.input<typeof invoiceSchema>

export async function saveInvoice(
  id: string | null,
  input: InvoiceInput,
  allocations: { id: string; percentage: number }[],
  options?: { createSupplier?: boolean }
): Promise<ActionResult<{ id: string; supplierId: string | null }>> {
  await requireSession()
  try {
    const parsed = invoiceSchema.parse(input)
    const { file, ...data } = parsed
    const list = allocationSchema.parse(allocations)
    checkAllocations(list, "max")

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
    if (id) await db.update(supplierInvoices).set(values).where(eq(supplierInvoices.id, id))
    else [{ id: invoiceId }] = await db.insert(supplierInvoices).values(values).returning({ id: supplierInvoices.id })

    const clearAlloc = db.delete(invoiceProjects).where(eq(invoiceProjects.invoiceId, invoiceId!))
    if (list.length)
      await db.batch([
        clearAlloc,
        db
          .insert(invoiceProjects)
          .values(list.map((a) => ({ invoiceId: invoiceId!, projectId: a.id, percentage: a.percentage }))),
      ])
    else await clearAlloc

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
  await requireSession()
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
    irpfRate: z.coerce.number().min(0).max(100).optional(),
  })
  .refine(
    (p) =>
      p.supplier !== undefined ||
      p.allocations !== undefined ||
      p.vatRate !== undefined ||
      p.irpfRate !== undefined,
    { message: "Indica què vols canviar" }
  )
export type BulkInvoicePatch = z.input<typeof bulkInvoicePatchSchema>

/** Actualitza proveïdor, tipus IVA/IRPF i/o assignació a projectes de diverses factures */
export async function bulkUpdateInvoices(
  ids: string[],
  patch: BulkInvoicePatch
): Promise<ActionResult<{ count: number }>> {
  await requireSession()
  try {
    const invoiceIds = invoiceIdsSchema.parse(ids)
    const data = bulkInvoicePatchSchema.parse(patch)
    if (data.allocations) checkAllocations(data.allocations, "max")

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

    if (data.allocations) {
      const clear = db.delete(invoiceProjects).where(inArray(invoiceProjects.invoiceId, invoiceIds))
      if (data.allocations.length) {
        await db.batch([
          clear,
          db.insert(invoiceProjects).values(
            invoiceIds.flatMap((invoiceId) =>
              data.allocations!.map((a) => ({
                invoiceId,
                projectId: a.id,
                percentage: a.percentage,
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
  await requireSession()
  try {
    const invoiceIds = invoiceIdsSchema.parse(ids)
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
  allocations: { id: string; percentage: number }[]
): Promise<ActionResult<{ id: string }>> {
  await requireSession()
  try {
    const data = payrollSchema.parse(input)
    const list = allocationSchema.parse(allocations)
    checkAllocations(list, "max")
    const [{ id }] = await db.insert(payrolls).values(data).returning({ id: payrolls.id })

    // Generem els registres mensuals: fins al mes final o fins a desembre de l'any d'inici/actual
    const until = data.endMonth ?? endOfYear(data.startMonth > toMonth(new Date()) ? data.startMonth : toMonth(new Date()))
    const months = monthRange(data.startMonth, until)
    const entries = await db
      .insert(payrollEntries)
      .values(months.map((month) => ({ payrollId: id, month, amount: data.monthlyAmount })))
      .returning({ id: payrollEntries.id })
    if (list.length && entries.length)
      await db
        .insert(payrollEntryProjects)
        .values(entries.flatMap((e) => list.map((a) => ({ entryId: e.id, projectId: a.id, percentage: a.percentage }))))

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
    revalidatePath("/clients", "layout")
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
  input: { id: string; percentage: number }[]
): Promise<ActionResult<{ count: number }>> {
  await requireSession()
  try {
    const list = allocationSchema.parse(input)
    checkAllocations(list, "max")
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

    const del = db.delete(payrollEntryProjects).where(inArray(payrollEntryProjects.entryId, ids))
    if (list.length)
      await db.batch([
        del,
        db
          .insert(payrollEntryProjects)
          .values(ids.flatMap((entryId) => list.map((a) => ({ entryId, projectId: a.id, percentage: a.percentage })))),
      ])
    else await del

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
          with: { projects: true },
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
    if (last?.projects.length && created.length)
      await db
        .insert(payrollEntryProjects)
        .values(
          created.flatMap((e) =>
            last.projects.map((a) => ({ entryId: e.id, projectId: a.projectId, percentage: a.percentage }))
          )
        )
    revalidatePath(`/nomines/${payrollId}`)
    revalidatePath("/nomines")
    return { ok: true, data: { count: created.length } }
  } catch (e) {
    return fail(e)
  }
}

export async function deletePayrollEntry(payrollId: string, entryId: string): Promise<ActionResult> {
  await requireSession()
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
    allocations: allocationSchema.optional(),
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
  await requireSession()
  try {
    const ids = payrollEntryIdsSchema.parse(entryIds)
    const data = bulkPayrollEntryPatchSchema.parse(patch)
    if (data.allocations) checkAllocations(data.allocations, "max")

    const owned = await db
      .select({ id: payrollEntries.id })
      .from(payrollEntries)
      .where(and(eq(payrollEntries.payrollId, payrollId), inArray(payrollEntries.id, ids)))
    if (owned.length !== ids.length) throw new Error("Algun registre no pertany a aquesta nòmina")
    const ownedIds = owned.map((e) => e.id)

    if (data.amount !== undefined) {
      await db
        .update(payrollEntries)
        .set({ amount: data.amount })
        .where(inArray(payrollEntries.id, ownedIds))
    }

    if (data.allocations) {
      const clear = db
        .delete(payrollEntryProjects)
        .where(inArray(payrollEntryProjects.entryId, ownedIds))
      if (data.allocations.length) {
        await db.batch([
          clear,
          db.insert(payrollEntryProjects).values(
            ownedIds.flatMap((entryId) =>
              data.allocations!.map((a) => ({
                entryId,
                projectId: a.id,
                percentage: a.percentage,
              }))
            )
          ),
        ])
      } else {
        await clear
      }
    }

    revalidatePath(`/nomines/${payrollId}`)
    revalidatePath("/nomines")
    revalidatePath("/projectes", "layout")
    revalidatePath("/clients", "layout")
    return { ok: true, data: { count: ownedIds.length } }
  } catch (e) {
    return fail(e)
  }
}

export async function bulkDeletePayrollEntries(
  payrollId: string,
  entryIds: string[]
): Promise<ActionResult<{ count: number }>> {
  await requireSession()
  try {
    const ids = payrollEntryIdsSchema.parse(entryIds)
    const deleted = await db
      .delete(payrollEntries)
      .where(and(eq(payrollEntries.payrollId, payrollId), inArray(payrollEntries.id, ids)))
      .returning({ id: payrollEntries.id })
    revalidatePath(`/nomines/${payrollId}`)
    revalidatePath("/nomines")
    revalidatePath("/projectes", "layout")
    revalidatePath("/clients", "layout")
    return { ok: true, data: { count: deleted.length } }
  } catch (e) {
    return fail(e)
  }
}

export async function deletePayroll(id: string) {
  await requireSession()
  await db.delete(payrolls).where(eq(payrolls.id, id))
  revalidatePath("/nomines")
  revalidatePath("/projectes", "layout")
  redirect("/nomines")
}
