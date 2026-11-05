-- Separa assignació a projectes i assignació a finançadors (factures + nòmines).
-- Les files amb finançador explícit es migren a *_funders (sumant duplicats);
-- si la suma explícita d'una factura/entrada supera 100 %, s'escala a 100 %.

CREATE TABLE "invoice_funders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"client_id" uuid,
	"subsidy_id" uuid,
	CONSTRAINT "invoice_funders_pct" CHECK ("percentage" > 0 and "percentage" <= 100),
	CONSTRAINT "invoice_funders_funder_xor" CHECK (("client_id" is not null and "subsidy_id" is null) or ("client_id" is null and "subsidy_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "invoice_funders" ADD CONSTRAINT "invoice_funders_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoice_funders" ADD CONSTRAINT "invoice_funders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoice_funders" ADD CONSTRAINT "invoice_funders_subsidy_id_subsidies_id_fk" FOREIGN KEY ("subsidy_id") REFERENCES "public"."subsidies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "invoice_funders_invoice_idx" ON "invoice_funders" USING btree ("invoice_id");
--> statement-breakpoint
CREATE INDEX "invoice_funders_client_idx" ON "invoice_funders" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX "invoice_funders_subsidy_idx" ON "invoice_funders" USING btree ("subsidy_id");
--> statement-breakpoint

CREATE TABLE "payroll_entry_funders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"client_id" uuid,
	"subsidy_id" uuid,
	CONSTRAINT "payroll_entry_funders_pct" CHECK ("percentage" > 0 and "percentage" <= 100),
	CONSTRAINT "payroll_entry_funders_funder_xor" CHECK (("client_id" is not null and "subsidy_id" is null) or ("client_id" is null and "subsidy_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "payroll_entry_funders" ADD CONSTRAINT "payroll_entry_funders_entry_id_payroll_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."payroll_entries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payroll_entry_funders" ADD CONSTRAINT "payroll_entry_funders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payroll_entry_funders" ADD CONSTRAINT "payroll_entry_funders_subsidy_id_subsidies_id_fk" FOREIGN KEY ("subsidy_id") REFERENCES "public"."subsidies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "payroll_entry_funders_entry_idx" ON "payroll_entry_funders" USING btree ("entry_id");
--> statement-breakpoint
CREATE INDEX "payroll_entry_funders_client_idx" ON "payroll_entry_funders" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX "payroll_entry_funders_subsidy_idx" ON "payroll_entry_funders" USING btree ("subsidy_id");
--> statement-breakpoint

-- Migrar finançadors explícits de factures (suma per invoice+funder; escala si >100).
WITH raw AS (
  SELECT
    invoice_id,
    client_id,
    subsidy_id,
    sum(percentage)::numeric(10, 2) AS percentage
  FROM invoice_projects
  WHERE client_id IS NOT NULL OR subsidy_id IS NOT NULL
  GROUP BY invoice_id, client_id, subsidy_id
),
totals AS (
  SELECT invoice_id, sum(percentage) AS total
  FROM raw
  GROUP BY invoice_id
)
INSERT INTO invoice_funders (invoice_id, client_id, subsidy_id, percentage)
SELECT
  r.invoice_id,
  r.client_id,
  r.subsidy_id,
  CASE
    WHEN t.total > 100 THEN round(r.percentage * 100 / t.total, 2)
    ELSE r.percentage
  END
FROM raw r
JOIN totals t ON t.invoice_id = r.invoice_id;
--> statement-breakpoint

-- Migrar finançadors explícits de nòmines (suma per entry+funder; escala si >100).
WITH raw AS (
  SELECT
    entry_id,
    client_id,
    subsidy_id,
    sum(percentage)::numeric(10, 2) AS percentage
  FROM payroll_entry_projects
  WHERE client_id IS NOT NULL OR subsidy_id IS NOT NULL
  GROUP BY entry_id, client_id, subsidy_id
),
totals AS (
  SELECT entry_id, sum(percentage) AS total
  FROM raw
  GROUP BY entry_id
)
INSERT INTO payroll_entry_funders (entry_id, client_id, subsidy_id, percentage)
SELECT
  r.entry_id,
  r.client_id,
  r.subsidy_id,
  CASE
    WHEN t.total > 100 THEN round(r.percentage * 100 / t.total, 2)
    ELSE r.percentage
  END
FROM raw r
JOIN totals t ON t.entry_id = r.entry_id;
--> statement-breakpoint

ALTER TABLE "invoice_projects" DROP CONSTRAINT IF EXISTS "invoice_projects_funder_xor";
--> statement-breakpoint
ALTER TABLE "invoice_projects" DROP CONSTRAINT IF EXISTS "invoice_projects_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice_projects" DROP CONSTRAINT IF EXISTS "invoice_projects_subsidy_id_subsidies_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "invoice_projects_client_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "invoice_projects_subsidy_idx";
--> statement-breakpoint
ALTER TABLE "invoice_projects" DROP COLUMN IF EXISTS "client_id";
--> statement-breakpoint
ALTER TABLE "invoice_projects" DROP COLUMN IF EXISTS "subsidy_id";
--> statement-breakpoint

ALTER TABLE "payroll_entry_projects" DROP CONSTRAINT IF EXISTS "payroll_entry_projects_funder_xor";
--> statement-breakpoint
ALTER TABLE "payroll_entry_projects" DROP CONSTRAINT IF EXISTS "payroll_entry_projects_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "payroll_entry_projects" DROP CONSTRAINT IF EXISTS "payroll_entry_projects_subsidy_id_subsidies_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "payroll_entry_projects_client_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "payroll_entry_projects_subsidy_idx";
--> statement-breakpoint
ALTER TABLE "payroll_entry_projects" DROP COLUMN IF EXISTS "client_id";
--> statement-breakpoint
ALTER TABLE "payroll_entry_projects" DROP COLUMN IF EXISTS "subsidy_id";
