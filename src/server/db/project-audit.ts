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
  return sql`jsonb_set(${JSON.stringify(state)}::jsonb, '{_audit}', coalesce(commissioning->'_audit', '[]'::jsonb))`;
}
