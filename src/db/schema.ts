import { relations, sql } from "drizzle-orm"
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

/* -------------------------------------------------------------------------- */
/*                                Better Auth                                 */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  // Better Auth admin plugin
  role: text("role").default("user").notNull(),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Better Auth admin plugin (impersonation)
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [index("session_user_id_idx").on(t.userId)]
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)]
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
)

/** Paràmetres d'aplicació (claus xifrades, etc.) — només administradores */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

/** Invitacions a crear un compte (enllaç d'un sol ús) */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    role: text("role").default("user").notNull(),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("invitations_email_idx").on(t.email),
    uniqueIndex("invitations_pending_email_uq")
      .on(t.email)
      .where(sql`${t.acceptedAt} is null`),
  ]
)

/* -------------------------------------------------------------------------- */
/*                                  Domini                                    */
/* -------------------------------------------------------------------------- */

const money = (name: string) =>
  numeric(name, { precision: 12, scale: 2, mode: "number" })
const pct = (name: string) =>
  numeric(name, { precision: 5, scale: 2, mode: "number" })

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}

/** Clients (finançadors) */
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Dades fiscals
  legalName: text("legal_name"),
  taxId: text("tax_id"),
  address: text("address"),
  postalCode: text("postal_code"),
  city: text("city"),
  province: text("province"),
  country: text("country").default("Espanya"),
  email: text("email"),
  notes: text("notes"),
  ...timestamps,
})

/** Projectes */
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  openedAt: date("opened_at", { mode: "string" }),
  closedAt: date("closed_at", { mode: "string" }),
  maxBudget: money("max_budget").notNull().default(0),
  ...timestamps,
})

/** Repartiment d'un projecte entre clients (ha de sumar 100%) */
export const projectClients = pgTable(
  "project_clients",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    percentage: pct("percentage").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.clientId] }),
    check("project_clients_pct", sql`${t.percentage} > 0 and ${t.percentage} <= 100`),
  ]
)

/** Proveïdors */
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    taxId: text("tax_id"),
    address: text("address"),
    postalCode: text("postal_code"),
    city: text("city"),
    province: text("province"),
    country: text("country").default("Espanya"),
    email: text("email"),
    phone: text("phone"),
    iban: text("iban"),
    // Tipus habituals, per proposar-los en crear una factura
    defaultVatRate: pct("default_vat_rate").notNull().default(21),
    defaultIrpfRate: pct("default_irpf_rate").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("suppliers_name_idx").on(t.name)]
)

/** Factures de proveïdors */
export const supplierInvoices = pgTable(
  "supplier_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull(),
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    description: text("description"),
    // Proveïdor enllaçat (opcional)
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    // Dades fiscals del proveïdor tal com consten a la factura
    supplierName: text("supplier_name").notNull(),
    supplierTaxId: text("supplier_tax_id"),
    supplierAddress: text("supplier_address"),
    supplierPostalCode: text("supplier_postal_code"),
    supplierCity: text("supplier_city"),
    // Imports
    baseAmount: money("base_amount").notNull(),
    vatRate: pct("vat_rate").notNull().default(21),
    vatAmount: money("vat_amount").notNull(),
    irpfRate: pct("irpf_rate").notNull().default(0),
    irpfAmount: money("irpf_amount").notNull(),
    total: money("total").notNull(),
    // Arxiu adjunt (Vercel Blob privat). pathname per servir-lo via /api/invoices/file
    filePathname: text("file_pathname"),
    fileName: text("file_name"),
    ...timestamps,
  },
  (t) => [
    index("supplier_invoices_date_idx").on(t.issueDate),
    index("supplier_invoices_supplier_idx").on(t.supplierId),
  ]
)

/** Repartiment d'una factura entre projectes (màxim 100%) */
export const invoiceProjects = pgTable(
  "invoice_projects",
  {
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => supplierInvoices.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    percentage: pct("percentage").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.invoiceId, t.projectId] }),
    check("invoice_projects_pct", sql`${t.percentage} > 0 and ${t.percentage} <= 100`),
  ]
)

/** Nòmines (una per persona) */
export const payrolls = pgTable("payrolls", {
  id: uuid("id").primaryKey().defaultRandom(),
  personName: text("person_name").notNull(),
  personTaxId: text("person_tax_id"),
  role: text("role"),
  monthlyAmount: money("monthly_amount").notNull(),
  startMonth: date("start_month", { mode: "string" }).notNull(),
  endMonth: date("end_month", { mode: "string" }),
  notes: text("notes"),
  ...timestamps,
})

/** Registre mensual d'una nòmina (month = primer dia del mes) */
export const payrollEntries = pgTable(
  "payroll_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    payrollId: uuid("payroll_id")
      .notNull()
      .references(() => payrolls.id, { onDelete: "cascade" }),
    month: date("month", { mode: "string" }).notNull(),
    amount: money("amount").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("payroll_entries_payroll_month_uq").on(t.payrollId, t.month),
    index("payroll_entries_month_idx").on(t.month),
  ]
)

/** Repartiment d'un registre mensual de nòmina entre projectes (màxim 100%) */
export const payrollEntryProjects = pgTable(
  "payroll_entry_projects",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => payrollEntries.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    percentage: pct("percentage").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.entryId, t.projectId] }),
    check("payroll_entry_projects_pct", sql`${t.percentage} > 0 and ${t.percentage} <= 100`),
  ]
)

/* -------------------------------------------------------------------------- */
/*                                 Relacions                                  */
/* -------------------------------------------------------------------------- */

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projectClients),
}))

export const projectsRelations = relations(projects, ({ many }) => ({
  clients: many(projectClients),
  invoices: many(invoiceProjects),
  payrollEntries: many(payrollEntryProjects),
}))

export const projectClientsRelations = relations(projectClients, ({ one }) => ({
  project: one(projects, { fields: [projectClients.projectId], references: [projects.id] }),
  client: one(clients, { fields: [projectClients.clientId], references: [clients.id] }),
}))

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  invoices: many(supplierInvoices),
}))

export const supplierInvoicesRelations = relations(supplierInvoices, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [supplierInvoices.supplierId], references: [suppliers.id] }),
  projects: many(invoiceProjects),
}))

export const invoiceProjectsRelations = relations(invoiceProjects, ({ one }) => ({
  invoice: one(supplierInvoices, {
    fields: [invoiceProjects.invoiceId],
    references: [supplierInvoices.id],
  }),
  project: one(projects, { fields: [invoiceProjects.projectId], references: [projects.id] }),
}))

export const payrollsRelations = relations(payrolls, ({ many }) => ({
  entries: many(payrollEntries),
}))

export const payrollEntriesRelations = relations(payrollEntries, ({ one, many }) => ({
  payroll: one(payrolls, { fields: [payrollEntries.payrollId], references: [payrolls.id] }),
  projects: many(payrollEntryProjects),
}))

export const payrollEntryProjectsRelations = relations(payrollEntryProjects, ({ one }) => ({
  entry: one(payrollEntries, {
    fields: [payrollEntryProjects.entryId],
    references: [payrollEntries.id],
  }),
  project: one(projects, {
    fields: [payrollEntryProjects.projectId],
    references: [projects.id],
  }),
}))

export type Client = typeof clients.$inferSelect
export type Project = typeof projects.$inferSelect
export type Supplier = typeof suppliers.$inferSelect
export type SupplierInvoice = typeof supplierInvoices.$inferSelect
export type Payroll = typeof payrolls.$inferSelect
export type PayrollEntry = typeof payrollEntries.$inferSelect
export type Invitation = typeof invitations.$inferSelect
export type User = typeof user.$inferSelect
export type AppSetting = typeof appSettings.$inferSelect
