CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"tax_id" text,
	"address" text,
	"postal_code" text,
	"city" text,
	"province" text,
	"country" text DEFAULT 'Espanya',
	"email" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_projects" (
	"invoice_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	CONSTRAINT "invoice_projects_invoice_id_project_id_pk" PRIMARY KEY("invoice_id","project_id"),
	CONSTRAINT "invoice_projects_pct" CHECK ("invoice_projects"."percentage" > 0 and "invoice_projects"."percentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE "payroll_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_id" uuid NOT NULL,
	"month" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_entry_projects" (
	"entry_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	CONSTRAINT "payroll_entry_projects_entry_id_project_id_pk" PRIMARY KEY("entry_id","project_id"),
	CONSTRAINT "payroll_entry_projects_pct" CHECK ("payroll_entry_projects"."percentage" > 0 and "payroll_entry_projects"."percentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE "payrolls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_name" text NOT NULL,
	"person_tax_id" text,
	"role" text,
	"monthly_amount" numeric(12, 2) NOT NULL,
	"start_month" date NOT NULL,
	"end_month" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_clients" (
	"project_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	CONSTRAINT "project_clients_project_id_client_id_pk" PRIMARY KEY("project_id","client_id"),
	CONSTRAINT "project_clients_pct" CHECK ("project_clients"."percentage" > 0 and "project_clients"."percentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"opened_at" date,
	"closed_at" date,
	"max_budget" numeric(12, 2) DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"issue_date" date NOT NULL,
	"description" text,
	"supplier_name" text NOT NULL,
	"supplier_tax_id" text,
	"supplier_address" text,
	"supplier_postal_code" text,
	"supplier_city" text,
	"base_amount" numeric(12, 2) NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT 21 NOT NULL,
	"vat_amount" numeric(12, 2) NOT NULL,
	"irpf_rate" numeric(5, 2) DEFAULT 0 NOT NULL,
	"irpf_amount" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_projects" ADD CONSTRAINT "invoice_projects_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_projects" ADD CONSTRAINT "invoice_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_payroll_id_payrolls_id_fk" FOREIGN KEY ("payroll_id") REFERENCES "public"."payrolls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entry_projects" ADD CONSTRAINT "payroll_entry_projects_entry_id_payroll_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."payroll_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entry_projects" ADD CONSTRAINT "payroll_entry_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_clients" ADD CONSTRAINT "project_clients_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_clients" ADD CONSTRAINT "project_clients_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_entries_payroll_month_uq" ON "payroll_entries" USING btree ("payroll_id","month");--> statement-breakpoint
CREATE INDEX "payroll_entries_month_idx" ON "payroll_entries" USING btree ("month");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "supplier_invoices_date_idx" ON "supplier_invoices" USING btree ("issue_date");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");