import { sql } from "drizzle-orm";
import type { Commissioning } from "@/lib/commissioning";
import type { ProjectAuditEvent } from "@/lib/project-audit";

/** Append under the project row lock, without invalidating programme edit versions. */
export function appendProjectAuditQuery(
  projectId: string,
  userId: string,
  event: ProjectAuditEvent,
  fallback: Commissioning,
) {
  return sql`UPDATE projects SET commissioning = jsonb_set(
    coalesce(commissioning, ${JSON.stringify(fallback)}::jsonb), '{_audit}',
    coalesce(commissioning->'_audit', '[]'::jsonb) || ${JSON.stringify([event])}::jsonb
  ) WHERE id = ${projectId} AND EXISTS (
    SELECT 1 FROM project_memberships WHERE project_id = ${projectId} AND user_id = ${userId}
  ) RETURNING id`;
}

/** Use the current persisted audit array, never a client's snapshot of it. */
export function commissioningWithAudit(state: Commissioning) {
  // Bind large source archives once; repeating a parameter duplicates the JSON
  // in the serverless database request even if only one CASE branch is used.
  const incoming = sql`${JSON.stringify(state)}::jsonb`;
  const next = Object.hasOwn(state, "sourceProgramme")
    ? incoming
    : sql`(${incoming} || CASE WHEN commissioning ? 'sourceProgramme'
    THEN jsonb_build_object('sourceProgramme',commissioning->'sourceProgramme') ELSE '{}'::jsonb END)`;
  return sql`jsonb_set(${next}, '{_audit}', coalesce(commissioning->'_audit', '[]'::jsonb))`;
}
