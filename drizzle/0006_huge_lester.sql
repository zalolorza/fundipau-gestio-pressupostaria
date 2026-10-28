ALTER TABLE "payroll_entry_projects" ADD COLUMN "cost_type" text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "vat_deductible_rate" numeric(5, 2) DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "cost_type" text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_entry_projects" ADD CONSTRAINT "payroll_entry_projects_cost_type" CHECK ("payroll_entry_projects"."cost_type" in ('direct', 'indirect'));--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_cost_type" CHECK ("supplier_invoices"."cost_type" in ('direct', 'indirect'));