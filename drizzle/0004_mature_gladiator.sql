ALTER TYPE "public"."priority" ADD VALUE 'P4';--> statement-breakpoint
ALTER TYPE "public"."priority" ADD VALUE 'P5';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "commissioning" jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "cx" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "modules" jsonb;