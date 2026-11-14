CREATE TABLE "assistant_conversations" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "project_id" text NOT NULL,
  "title" text NOT NULL,
  "messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "report_state" jsonb,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "assistant_conversations_title" CHECK (char_length("title") BETWEEN 1 AND 80),
  CONSTRAINT "assistant_conversations_version" CHECK ("version" > 0),
  CONSTRAINT "assistant_conversations_messages" CHECK (
    jsonb_typeof("messages")='array' AND
    jsonb_array_length("messages")<=200 AND
    octet_length("messages"::text)<=1048576 AND
    NOT jsonb_path_exists("messages", '$[*] ? (@.type() != "object" || !exists(@.id) || !exists(@.role) || !exists(@.text) || @.id.type() != "string" || @.text.type() != "string" || (exists(@.error) && @.error.type() != "string") || (@.role != "user" && @.role != "assistant"))') AND
    NOT jsonb_path_exists("messages", '$[*].keyvalue() ? (@.key != "id" && @.key != "role" && @.key != "text" && @.key != "error")')
  ),
  CONSTRAINT "assistant_conversations_report_scope" CHECK (
    "report_state" IS NULL OR (jsonb_typeof("report_state")='object' AND "report_state"->>'projectId' IS NOT NULL AND "report_state"->>'projectId'="project_id")
  )
);
--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "assistant_conversations_owner_project_updated_idx" ON "assistant_conversations" USING btree ("user_id","project_id","updated_at" DESC,"id" DESC);
