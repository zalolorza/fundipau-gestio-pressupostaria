CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tax_id" text,
	"address" text,
	"postal_code" text,
	"city" text,
	"province" text,
	"country" text DEFAULT 'Espanya',
	"email" text,
	"phone" text,
	"iban" text,
	"default_vat_rate" numeric(5, 2) DEFAULT 21 NOT NULL,
	"default_irpf_rate" numeric(5, 2) DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_invoices_supplier_idx" ON "supplier_invoices" USING btree ("supplier_id");--> statement-breakpoint
-- Crea un proveïdor per cada proveïdor diferent (per NIF o, si no n'hi ha, per nom) de les factures existents
INSERT INTO "suppliers" ("name", "tax_id", "address", "postal_code", "city", "default_vat_rate", "default_irpf_rate")
SELECT DISTINCT ON (coalesce(nullif(trim(i."supplier_tax_id"), ''), lower(trim(i."supplier_name"))))
  i."supplier_name", nullif(trim(i."supplier_tax_id"), ''), i."supplier_address", i."supplier_postal_code", i."supplier_city", i."vat_rate", i."irpf_rate"
FROM "supplier_invoices" i
ORDER BY coalesce(nullif(trim(i."supplier_tax_id"), ''), lower(trim(i."supplier_name"))), i."issue_date" DESC;
--> statement-breakpoint
UPDATE "supplier_invoices" i SET "supplier_id" = s."id"
FROM "suppliers" s
WHERE i."supplier_id" IS NULL
  AND (
    (s."tax_id" IS NOT NULL AND s."tax_id" = nullif(trim(i."supplier_tax_id"), ''))
    OR (s."tax_id" IS NULL AND nullif(trim(i."supplier_tax_id"), '') IS NULL AND lower(trim(s."name")) = lower(trim(i."supplier_name")))
  );
