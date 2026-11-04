-- Completa invoice_projects (aplicat parcialment abans de 0012 a alguns entorns).
DO $$ BEGIN
  ALTER TABLE "invoice_projects" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_projects" ADD COLUMN "client_id" uuid;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_projects" ADD COLUMN "subsidy_id" uuid;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_projects" DROP CONSTRAINT "invoice_projects_invoice_id_project_id_pk";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_projects" ADD CONSTRAINT "invoice_projects_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition OR duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_projects" ADD CONSTRAINT "invoice_projects_funder_xor" CHECK (not ("client_id" is not null and "subsidy_id" is not null));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_projects" ADD CONSTRAINT "invoice_projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_projects" ADD CONSTRAINT "invoice_projects_subsidy_id_subsidies_id_fk" FOREIGN KEY ("subsidy_id") REFERENCES "public"."subsidies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_projects_invoice_idx" ON "invoice_projects" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_projects_project_idx" ON "invoice_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_projects_client_idx" ON "invoice_projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_projects_subsidy_idx" ON "invoice_projects" USING btree ("subsidy_id");
