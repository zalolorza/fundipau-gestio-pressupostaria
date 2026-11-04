CREATE TABLE "project_subsidies" (
	"project_id" uuid NOT NULL,
	"subsidy_id" uuid NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	CONSTRAINT "project_subsidies_project_id_subsidy_id_pk" PRIMARY KEY("project_id","subsidy_id"),
	CONSTRAINT "project_subsidies_pct" CHECK ("project_subsidies"."percentage" > 0 and "project_subsidies"."percentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE "subsidies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subsidy_clients" (
	"subsidy_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	CONSTRAINT "subsidy_clients_subsidy_id_client_id_pk" PRIMARY KEY("subsidy_id","client_id"),
	CONSTRAINT "subsidy_clients_pct" CHECK ("subsidy_clients"."percentage" > 0 and "subsidy_clients"."percentage" <= 100)
);
--> statement-breakpoint
ALTER TABLE "project_subsidies" ADD CONSTRAINT "project_subsidies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_subsidies" ADD CONSTRAINT "project_subsidies_subsidy_id_subsidies_id_fk" FOREIGN KEY ("subsidy_id") REFERENCES "public"."subsidies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsidy_clients" ADD CONSTRAINT "subsidy_clients_subsidy_id_subsidies_id_fk" FOREIGN KEY ("subsidy_id") REFERENCES "public"."subsidies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subsidy_clients" ADD CONSTRAINT "subsidy_clients_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;