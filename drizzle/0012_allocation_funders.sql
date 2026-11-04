-- invoice_projects ja migrat en un intent previ; completa payroll_entry_projects + categories.

-- Categories: drop FK antics abans de canviar la PK de payroll_entry_projects
ALTER TABLE "payroll_entry_project_categories" DROP CONSTRAINT "pep_categories_allocation_fk";--> statement-breakpoint

ALTER TABLE "payroll_entry_projects" DROP CONSTRAINT "payroll_entry_projects_entry_id_project_id_pk";--> statement-breakpoint
ALTER TABLE "payroll_entry_projects" ADD CONSTRAINT "payroll_entry_projects_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "payroll_entry_projects" ADD CONSTRAINT "payroll_entry_projects_funder_xor" CHECK (not ("client_id" is not null and "subsidy_id" is not null));--> statement-breakpoint
ALTER TABLE "payroll_entry_projects" ADD CONSTRAINT "payroll_entry_projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entry_projects" ADD CONSTRAINT "payroll_entry_projects_subsidy_id_subsidies_id_fk" FOREIGN KEY ("subsidy_id") REFERENCES "public"."subsidies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payroll_entry_projects_entry_idx" ON "payroll_entry_projects" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "payroll_entry_projects_project_idx" ON "payroll_entry_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "payroll_entry_projects_client_idx" ON "payroll_entry_projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "payroll_entry_projects_subsidy_idx" ON "payroll_entry_projects" USING btree ("subsidy_id");--> statement-breakpoint

ALTER TABLE "payroll_entry_project_categories" ADD COLUMN "allocation_id" uuid;--> statement-breakpoint
UPDATE "payroll_entry_project_categories" pepc
SET "allocation_id" = pep."id"
FROM "payroll_entry_projects" pep
WHERE pepc."entry_id" = pep."entry_id" AND pepc."project_id" = pep."project_id";--> statement-breakpoint
ALTER TABLE "payroll_entry_project_categories" ALTER COLUMN "allocation_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_entry_project_categories" DROP CONSTRAINT "payroll_entry_project_categories_entry_id_project_id_category_i";--> statement-breakpoint
ALTER TABLE "payroll_entry_project_categories" DROP COLUMN "entry_id";--> statement-breakpoint
ALTER TABLE "payroll_entry_project_categories" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "payroll_entry_project_categories" ADD CONSTRAINT "payroll_entry_project_categories_allocation_id_category_id_pk" PRIMARY KEY ("allocation_id","category_id");--> statement-breakpoint
ALTER TABLE "payroll_entry_project_categories" ADD CONSTRAINT "payroll_entry_project_categories_allocation_id_payroll_entry_projects_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."payroll_entry_projects"("id") ON DELETE cascade ON UPDATE no action;
