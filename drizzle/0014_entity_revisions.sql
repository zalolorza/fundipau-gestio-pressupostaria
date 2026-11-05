CREATE TABLE "entity_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"summary" text NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_revisions" ADD CONSTRAINT "entity_revisions_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "entity_revisions_entity_idx" ON "entity_revisions" USING btree ("entity_type","entity_id","created_at");
--> statement-breakpoint
CREATE INDEX "entity_revisions_created_idx" ON "entity_revisions" USING btree ("created_at");
