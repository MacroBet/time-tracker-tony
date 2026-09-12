ALTER TYPE "public"."issue_source" ADD VALUE 'excel';--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "priority" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "priority" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "import_data" jsonb;