# Fundipau · Gestió pressupostària de projectes

Aplicació interna per gestionar **projectes**, **clients** (finançadors), **factures de proveïdors** i **nòmines**, i saber què s'ha de facturar a cada client.

- Next.js 16 (App Router, Turbopack)
- shadcn/ui (estil `radix-nova`, sidebar `sidebar-04`, color principal `#006EB6`)
- Drizzle ORM + Postgres (Neon, driver HTTP)
- Better Auth (correu i contrasenya)

## Posada en marxa

```bash
yarn install
yarn db:migrate   # crea les taules a la base de dades del .env
yarn db:seed      # (opcional) dades de prova — ESBORRA les dades de domini
yarn dev
```

Obre http://localhost:3000 i entra amb **admin@fundipau.org / fundipau2026** (usuari creat pel seed; canvia-li la contrasenya o crea'n un altre).

### Variables d'entorn (`.env`)

| Variable | Ús |
| --- | --- |
| `DATABASE_URL` | Connexió amb pooler (l'app) |
| `DATABASE_URL_UNPOOLED` | Connexió directa (migracions i seed) |
| `BETTER_AUTH_SECRET` | Clau de signatura de sessions (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | URL pública de l'app |
| `ALLOW_SIGNUP` | `true` per habilitar `/registre`. Per defecte desactivat |
| `BLOB_READ_WRITE_TOKEN` | Token de lectura/escriptura del Vercel Blob (store **privat**) |
| `BLOB_STORE_ID` | ID del Blob store (opcional en local si el token ja l'inclou) |

## Model de dades

```
                                                                  suppliers (opcional)
                                                                       │
clients ──< project_clients >── projects ──< invoice_projects >── supplier_invoices
                 (% = 100)                │        (% ≤ 100)
                                          └──< payroll_entry_projects >── payroll_entries >── payrolls
                                                     (% ≤ 100)              (1 per mes)
```

- **Proveïdors**: una factura pot estar enllaçada a un proveïdor de la llista o no (proveïdors puntuals). Les dades fiscals es copien sempre a la factura, de manera que editar o eliminar un proveïdor no altera les factures ja registrades (en eliminar-lo, les factures queden "no enllaçades").
- **Projecte → clients**: percentatges que **sumen sempre 100 %**.
- **Factura → projectes** i **registre mensual de nòmina → projectes**: percentatges que sumen **com a màxim 100 %** (la resta queda "sense assignar" i surt a l'inici com a cost pendent).
- **Cost imputable d'una factura** = base + IVA deduïble (percentatge de l'IVA de la factura; per defecte el dels Ajustos). L'IRPF és una retenció, no redueix el cost. Es defineix a `src/lib/invoice.ts`.
- **Nòmines**: cada nòmina genera un registre per mes. En modificar una quantitat o una assignació, l'app pregunta si s'aplica **només a aquell mes**, **a aquell mes i els següents** o **a tots**.

### Factures a emetre (pàgina del client)

Per a cada projecte del client, en el període triat:

```
import = cost del recurs × % assignat al projecte × % del client al projecte
```

## Estructura

```
src/
  app/(app)/         pàgines amb sessió (inici, projectes, clients, factures, proveidors, nomines)
  app/(auth)/        login i registre
  app/api/auth/      endpoint de Better Auth
  app/api/invoices/  upload i delivery d'arxius (Blob privat)
  components/app/    components compartits (editor de percentatges, diàleg d'abast…)
  db/schema.ts       esquema Drizzle
  server/queries.ts  lectures i càlculs
  server/actions.ts  server actions (totes comproven la sessió)
  proxy.ts           redirecció optimista a /login
scripts/             migrate.ts i seed.ts
drizzle/             migracions SQL
```

## Scripts

| Script | Què fa |
| --- | --- |
| `yarn db:generate` | Genera una migració nova després de canviar `schema.ts` |
| `yarn db:migrate` | Aplica les migracions pendents |
| `yarn db:seed` | Esborra i torna a omplir amb dades de prova |
| `yarn db:studio` | Obre Drizzle Studio |
| `yarn typecheck` / `yarn lint` | Comprovacions |
