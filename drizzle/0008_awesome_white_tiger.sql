CREATE TABLE "cost_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_categories" (
	"invoice_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "invoice_categories_invoice_id_category_id_pk" PRIMARY KEY("invoice_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "payroll_entry_project_categories" (
	"entry_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "payroll_entry_project_categories_entry_id_project_id_category_id_pk" PRIMARY KEY("entry_id","project_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "invoice_categories" ADD CONSTRAINT "invoice_categories_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_categories" ADD CONSTRAINT "invoice_categories_category_id_cost_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."cost_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entry_project_categories" ADD CONSTRAINT "payroll_entry_project_categories_category_id_cost_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."cost_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entry_project_categories" ADD CONSTRAINT "pep_categories_allocation_fk" FOREIGN KEY ("entry_id","project_id") REFERENCES "public"."payroll_entry_projects"("entry_id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cost_categories_name_uq" ON "cost_categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "invoice_categories_category_idx" ON "invoice_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "payroll_entry_project_categories_category_idx" ON "payroll_entry_project_categories" USING btree ("category_id");