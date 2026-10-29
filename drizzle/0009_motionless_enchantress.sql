CREATE TABLE "project_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_projects" ADD COLUMN "activity_id" uuid;--> statement-breakpoint
ALTER TABLE "payroll_entry_projects" ADD COLUMN "activity_id" uuid;--> statement-breakpoint
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_activities_project_idx" ON "project_activities" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_activities_project_name_uq" ON "project_activities" USING btree ("project_id","name");--> statement-breakpoint
ALTER TABLE "invoice_projects" ADD CONSTRAINT "invoice_projects_activity_id_project_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."project_activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entry_projects" ADD CONSTRAINT "payroll_entry_projects_activity_id_project_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."project_activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_projects_activity_idx" ON "invoice_projects" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "payroll_entry_projects_activity_idx" ON "payroll_entry_projects" USING btree ("activity_id");