/**
 * Omple la base de dades amb dades de prova (inventades).
 *   yarn db:seed
 * ATENCIÓ: esborra totes les dades de domini abans d'inserir-ne de noves.
 */
import "dotenv/config"
import { faker } from "@faker-js/faker/locale/es"
import { neon } from "@neondatabase/serverless"
import { hashPassword } from "better-auth/crypto"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/neon-http"

import * as s from "../src/db/schema"
import { computeInvoice } from "../src/lib/invoice"
import { endOfMonth, monthRange, toMonth } from "../src/lib/months"

const db = drizzle(neon(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!), { schema: s })
faker.seed(2026)

const ADMIN = { email: "admin@fundipau.org", password: "fundipau2026", name: "Administració" }

const CLIENTS = [
  {
    name: "Ajuntament de Sant Pere de Vilallonga",
    legalName: "Ajuntament de Sant Pere de Vilallonga",
    taxId: "P0899901A",
    address: "Plaça de la Vila, 1",
    postalCode: "08999",
    city: "Sant Pere de Vilallonga",
    province: "Barcelona",
    email: "cooperacio@vilallonga.example",
    notes: "Conveni anual de cooperació i educació per la pau. Justificació trimestral.",
  },
  {
    name: "Agència de Cooperació de Ponent",
    legalName: "Agència de Cooperació al Desenvolupament de Ponent",
    taxId: "Q2599902B",
    address: "Carrer del Riu Segre, 22",
    postalCode: "25999",
    city: "Lleida",
    province: "Lleida",
    email: "subvencions@acponent.example",
    notes: "Subvenció plurianual. Cal adjuntar còpia de factures i nòmines a cada justificació.",
  },
  {
    name: "Fons Comarcal per la Solidaritat",
    legalName: "Fons Comarcal per la Solidaritat i la Pau",
    taxId: "G6699903C",
    address: "Rambla Nova, 45, 2n",
    postalCode: "43999",
    city: "Tarragona",
    province: "Tarragona",
    email: "projectes@fonscomarcal.example",
    notes: null,
  },
  {
    name: "Diputació de l'Empordà Interior",
    legalName: "Diputació de l'Empordà Interior",
    taxId: "P1799904D",
    address: "Pujada del Palau, 3",
    postalCode: "17999",
    city: "Girona",
    province: "Girona",
    email: "pau@diputacio-ei.example",
    notes: "Finança el 40 % de la campanya de desarmament. Contacte: Sra. Puig.",
  },
  {
    name: "Fundació Horitzons Compartits",
    legalName: "Fundació Privada Horitzons Compartits",
    taxId: "G0899905E",
    address: "Passeig de les Moreres, 10",
    postalCode: "08998",
    city: "Barcelona",
    province: "Barcelona",
    email: "convocatories@horitzons.example",
    notes: "Convocatòria anual. Pagament 70 % avançat, 30 % a la justificació final.",
  },
  {
    name: "Xarxa Ciutadana per la Pau",
    legalName: "Associació Xarxa Ciutadana per la Pau",
    taxId: "G0899906F",
    address: "Carrer de la Pau, 8",
    postalCode: "08997",
    city: "Manresa",
    province: "Barcelona",
    email: "hola@xarxapau.example",
    notes: "Col·laboració puntual en activitats de sensibilització.",
  },
]

const PROJECTS = [
  {
    name: "Educació per la pau a les escoles",
    description: "Tallers de resolució de conflictes i cultura de pau a centres de primària i secundària.",
    openedAt: "2025-01-01",
    closedAt: "2026-12-31",
    maxBudget: 85000,
    clients: [
      ["Ajuntament de Sant Pere de Vilallonga", 60],
      ["Fundació Horitzons Compartits", 40],
    ],
  },
  {
    name: "Campanya pel desarmament nuclear",
    description: "Campanya de sensibilització i incidència política per al Tractat de Prohibició d'Armes Nuclears.",
    openedAt: "2025-03-01",
    closedAt: null,
    maxBudget: 60000,
    clients: [
      ["Diputació de l'Empordà Interior", 40],
      ["Fons Comarcal per la Solidaritat", 35],
      ["Xarxa Ciutadana per la Pau", 25],
    ],
  },
  {
    name: "Observatori del comerç d'armes",
    description: "Recerca i publicació d'informes sobre exportacions d'armament i banca armada.",
    openedAt: "2025-01-01",
    closedAt: null,
    maxBudget: 120000,
    clients: [["Agència de Cooperació de Ponent", 100]],
  },
  {
    name: "Cicle de conferències Cultura de Pau 2026",
    description: "Sis conferències obertes amb ponents internacionals i retransmissió en directe.",
    openedAt: "2026-01-15",
    closedAt: "2026-11-30",
    maxBudget: 24000,
    clients: [
      ["Ajuntament de Sant Pere de Vilallonga", 50],
      ["Diputació de l'Empordà Interior", 50],
    ],
  },
  {
    name: "Acompanyament a defensores de drets humans",
    description: "Programa d'acollida temporal i acompanyament internacional a defensores amenaçades.",
    openedAt: "2025-06-01",
    closedAt: null,
    maxBudget: 95000,
    clients: [
      ["Agència de Cooperació de Ponent", 70],
      ["Fundació Horitzons Compartits", 30],
    ],
  },
  {
    name: "Exposició itinerant «Mines antipersona»",
    description: "Exposició fotogràfica i guia didàctica que recorre equipaments municipals.",
    openedAt: "2025-02-01",
    closedAt: "2025-12-31",
    maxBudget: 18000,
    clients: [["Fons Comarcal per la Solidaritat", 100]],
  },
] as const

const SUPPLIERS = [
  { name: "Gràfiques del Carrer Nou, SL", taxId: "B08999101", address: "Carrer Nou, 14", pc: "08999", city: "Barcelona", irpf: 0, vat: 21, kind: ["Impressió de cartells", "Impressió de fullets", "Impressió de l'informe anual", "Plafons d'exposició"], range: [300, 4500] },
  { name: "Ateneu Popular SCCL", taxId: "F08999102", address: "Carrer de l'Ateneu, 3", pc: "08997", city: "Manresa", irpf: 0, vat: 21, kind: ["Lloguer de sala per a conferència", "Lloguer d'auditori", "Equip de so i projecció"], range: [250, 1800] },
  { name: "Traduccions Babel, SL", taxId: "B08999103", address: "Via Augusta, 120", pc: "08998", city: "Barcelona", irpf: 0, vat: 21, kind: ["Traducció d'informe EN-CA", "Interpretació simultània", "Traducció de materials didàctics"], range: [400, 3200] },
  { name: "Marta Soler Vidal", taxId: "47999104K", address: "Carrer del Sol, 9, 3r 1a", pc: "17999", city: "Girona", irpf: 15, vat: 21, kind: ["Disseny gràfic de campanya", "Maquetació de l'informe", "Il·lustracions guia didàctica"], range: [600, 2800] },
  { name: "Viatges Solidaris, SL", taxId: "B25999105", address: "Avinguda de Catalunya, 33", pc: "25999", city: "Lleida", irpf: 0, vat: 21, kind: ["Bitllets d'avió ponent internacional", "Allotjament defensora acollida", "Desplaçaments equip"], range: [180, 2600] },
  { name: "Puig i Associats Assessors, SLP", taxId: "B08999106", address: "Passeig de Gràcia, 70", pc: "08998", city: "Barcelona", irpf: 15, vat: 21, kind: ["Assessoria laboral i comptable", "Auditoria de justificació"], range: [450, 2200] },
  { name: "La Cuina de Tots SCCL", taxId: "F43999107", address: "Carrer del Mercat, 5", pc: "43999", city: "Tarragona", irpf: 0, vat: 10, kind: ["Càtering jornada", "Esmorzar participants taller"], range: [150, 1400] },
  { name: "Núvol Cooperatiu SCCL", taxId: "F08999108", address: "Carrer de la Xarxa, 2", pc: "08999", city: "Barcelona", irpf: 0, vat: 21, kind: ["Allotjament web i correu", "Retransmissió en streaming", "Manteniment web"], range: [60, 900] },
  { name: "Jordi Ferrer Camps", taxId: "39999109L", address: "Carrer Major, 21", pc: "08999", city: "Sant Pere de Vilallonga", irpf: 15, vat: 21, kind: ["Dinamització de tallers", "Formació de formadors"], range: [350, 1900] },
]

// Proveïdors puntuals que NO es donen d'alta a la llista (factures sense enllaçar)
const ONE_OFF = [
  { name: "Ferreteria Cal Pep", taxId: "38999110M", address: "Carrer de Baix, 4", pc: "08999", city: "Manresa", irpf: 0, vat: 21, kind: ["Material per a l'exposició", "Petit material d'oficina"], range: [20, 180] },
  { name: "Taxis Bages Coop", taxId: null, address: null, pc: null, city: "Manresa", irpf: 0, vat: 10, kind: ["Trasllat ponent"], range: [25, 90] },
]

const PEOPLE = [
  { personName: "Laia Martí Roca", personTaxId: "43999201M", role: "Coordinació general", monthlyAmount: 2950, startMonth: "2025-01-01", raise: { month: "2026-01-01", amount: 3050 } },
  { personName: "Oriol Vidal Serra", personTaxId: "44999202N", role: "Investigador", monthlyAmount: 2500, startMonth: "2025-01-01", raise: { month: "2026-04-01", amount: 2620 } },
  { personName: "Núria Casals Pons", personTaxId: "45999203P", role: "Educadora", monthlyAmount: 2150, startMonth: "2025-02-01", raise: null },
  { personName: "Pau Jiménez Bosch", personTaxId: "46999204Q", role: "Comunicació", monthlyAmount: 2200, startMonth: "2025-03-01", raise: null },
  { personName: "Aina Torres Riera", personTaxId: "47999205R", role: "Tècnica de projectes", monthlyAmount: 2300, startMonth: "2025-06-01", raise: { month: "2026-07-01", amount: 2400 } },
] as const

// Repartiment habitual de cada persona entre projectes
const PAYROLL_SPLIT: Record<string, [string, number][]> = {
  "Laia Martí Roca": [
    ["Observatori del comerç d'armes", 30],
    ["Campanya pel desarmament nuclear", 30],
    ["Educació per la pau a les escoles", 20],
  ],
  "Oriol Vidal Serra": [["Observatori del comerç d'armes", 80]],
  "Núria Casals Pons": [
    ["Educació per la pau a les escoles", 70],
    ["Exposició itinerant «Mines antipersona»", 30],
  ],
  "Pau Jiménez Bosch": [
    ["Campanya pel desarmament nuclear", 50],
    ["Cicle de conferències Cultura de Pau 2026", 30],
  ],
  "Aina Torres Riera": [
    ["Acompanyament a defensores de drets humans", 60],
    ["Educació per la pau a les escoles", 20],
  ],
}

async function main() {
  console.log("→ Netejant dades de domini…")
  await db.delete(s.payrollEntryProjects)
  await db.delete(s.payrollEntries)
  await db.delete(s.payrolls)
  await db.delete(s.invoiceProjects)
  await db.delete(s.supplierInvoices)
  await db.delete(s.suppliers)
  await db.delete(s.projectClients)
  await db.delete(s.projects)
  await db.delete(s.clients)

  // Usuari administrador
  const existing = await db.query.user.findFirst({ where: eq(s.user.email, ADMIN.email) })
  if (!existing) {
    const id = crypto.randomUUID()
    await db.insert(s.user).values({
      id,
      name: ADMIN.name,
      email: ADMIN.email,
      emailVerified: true,
      role: "admin",
    })
    await db.insert(s.account).values({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: await hashPassword(ADMIN.password),
    })
    console.log(`✓ Usuari creat: ${ADMIN.email} / ${ADMIN.password}`)
  } else {
    await db.update(s.user).set({ role: "admin" }).where(eq(s.user.email, ADMIN.email))
    console.log(`· L'usuari ${ADMIN.email} ja existia (rol admin assegurat)`)
  }

  // Clients
  const clientRows = await db.insert(s.clients).values(CLIENTS).returning()
  const clientId = new Map(clientRows.map((c) => [c.name, c.id]))
  console.log(`✓ ${clientRows.length} clients`)

  // Projectes
  const projectRows = await db
    .insert(s.projects)
    .values(PROJECTS.map(({ clients: _c, ...p }) => p))
    .returning()
  const projectByName = new Map(projectRows.map((p) => [p.name, p]))
  await db.insert(s.projectClients).values(
    PROJECTS.flatMap((p) =>
      p.clients.map(([c, pct]) => ({
        projectId: projectByName.get(p.name)!.id,
        clientId: clientId.get(c)!,
        percentage: pct,
      }))
    )
  )
  console.log(`✓ ${projectRows.length} projectes`)

  // Proveïdors
  const supplierRows = await db
    .insert(s.suppliers)
    .values(
      SUPPLIERS.map((sup) => ({
        name: sup.name,
        taxId: sup.taxId,
        address: sup.address,
        postalCode: sup.pc,
        city: sup.city,
        province: { "08": "Barcelona", "17": "Girona", "25": "Lleida", "43": "Tarragona" }[sup.pc.slice(0, 2)] ?? null,
        email: `factures@${sup.name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "").slice(0, 14)}.example`,
        phone: `93${faker.string.numeric(7)}`,
        iban: `ES${faker.string.numeric(22)}`,
        defaultVatRate: sup.vat,
        defaultIrpfRate: sup.irpf,
      }))
    )
    .returning()
  const supplierId = new Map(supplierRows.map((r) => [r.taxId, r.id]))
  console.log(`✓ ${supplierRows.length} proveïdors`)

  // Factures
  const today = new Date().toISOString().slice(0, 10)
  const months = monthRange("2025-01-01", today)
  const invoices: (typeof s.supplierInvoices.$inferInsert)[] = []
  const counters = new Map<string, number>()
  for (const month of months) {
    const n = faker.number.int({ min: 2, max: 4 })
    for (let i = 0; i < n; i++) {
      const oneOff = faker.number.float() < 0.08
      const sup = oneOff ? faker.helpers.arrayElement(ONE_OFF) : faker.helpers.arrayElement(SUPPLIERS)
      const day = faker.number.int({ min: 1, max: Number(endOfMonth(month).slice(8, 10)) })
      const issueDate = `${month.slice(0, 8)}${String(day).padStart(2, "0")}`
      if (issueDate > today) continue
      const year = month.slice(0, 4)
      const key = `${sup.taxId}-${year}`
      counters.set(key, (counters.get(key) ?? 0) + 1)
      const base = faker.number.float({ min: sup.range[0], max: sup.range[1], fractionDigits: 2 })
      invoices.push({
        number: `${sup.name.slice(0, 2).toUpperCase()}-${year}/${String(counters.get(key)).padStart(3, "0")}`,
        issueDate,
        description: faker.helpers.arrayElement(sup.kind),
        supplierId: oneOff ? null : supplierId.get(sup.taxId)!,
        supplierName: sup.name,
        supplierTaxId: sup.taxId,
        supplierAddress: sup.address,
        supplierPostalCode: sup.pc,
        supplierCity: sup.city,
        baseAmount: base,
        vatRate: sup.vat,
        irpfRate: sup.irpf,
        ...computeInvoice(base, sup.vat, sup.irpf),
      })
    }
  }
  const invoiceRows = await db.insert(s.supplierInvoices).values(invoices).returning()
  console.log(`✓ ${invoiceRows.length} factures de proveïdors`)

  // Assignació de factures a projectes (~85 % assignades)
  const invAlloc: (typeof s.invoiceProjects.$inferInsert)[] = []
  for (const inv of invoiceRows) {
    if (faker.number.float() < 0.15) continue // queden sense assignar
    const candidates = projectRows.filter(
      (p) => (!p.openedAt || p.openedAt <= inv.issueDate) && (!p.closedAt || p.closedAt >= inv.issueDate)
    )
    if (!candidates.length) continue
    const split = faker.number.float() < 0.25 && candidates.length > 1
    if (split) {
      const [a, b] = faker.helpers.arrayElements(candidates, 2)
      const pa = faker.helpers.arrayElement([50, 60, 70])
      invAlloc.push({ invoiceId: inv.id, projectId: a.id, percentage: pa })
      invAlloc.push({ invoiceId: inv.id, projectId: b.id, percentage: 100 - pa })
    } else {
      invAlloc.push({ invoiceId: inv.id, projectId: faker.helpers.arrayElement(candidates).id, percentage: 100 })
    }
  }
  await db.insert(s.invoiceProjects).values(invAlloc)
  console.log(`✓ ${invAlloc.length} assignacions de factures`)

  // Nòmines
  const lastMonth = `${toMonth(today).slice(0, 4)}-12-01`
  let entriesCount = 0
  for (const person of PEOPLE) {
    const { raise, ...data } = person
    const [payroll] = await db
      .insert(s.payrolls)
      .values({ ...data, monthlyAmount: raise?.amount ?? data.monthlyAmount, endMonth: null })
      .returning()
    const entryValues = monthRange(person.startMonth, lastMonth).map((month) => ({
      payrollId: payroll.id,
      month,
      amount: raise && month >= raise.month ? raise.amount : person.monthlyAmount,
    }))
    const entries = await db.insert(s.payrollEntries).values(entryValues).returning()
    entriesCount += entries.length

    const split = PAYROLL_SPLIT[person.personName] ?? []
    const alloc = entries.flatMap((e) =>
      split
        .map(([pname, pct]) => ({ project: projectByName.get(pname)!, pct }))
        .filter(
          ({ project }) =>
            (!project.openedAt || toMonth(project.openedAt) <= e.month) &&
            (!project.closedAt || project.closedAt >= e.month)
        )
        .map(({ project, pct }) => ({ entryId: e.id, projectId: project.id, percentage: pct }))
    )
    if (alloc.length) await db.insert(s.payrollEntryProjects).values(alloc)
  }
  console.log(`✓ ${PEOPLE.length} nòmines amb ${entriesCount} registres mensuals`)
  console.log(`\nFet! Entra amb ${ADMIN.email} / ${ADMIN.password}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
