ALTER TABLE "projects" ADD COLUMN "direct_budget" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "indirect_budget" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_budget_split" CHECK ((
        ("projects"."direct_budget" is null and "projects"."indirect_budget" is null)
        or (
          "projects"."direct_budget" is not null
          and "projects"."indirect_budget" is not null
          and "projects"."direct_budget" >= 0
          and "projects"."indirect_budget" >= 0
          and "projects"."direct_budget" + "projects"."indirect_budget" = "projects"."max_budget"
        )
      ));