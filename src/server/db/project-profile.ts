import { sql } from "drizzle-orm";
import type { Project } from "@/lib/domain";
import type { Commissioning } from "@/lib/commissioning";
import type { ProjectAuditEvent } from "@/lib/project-audit";

/** Creation, creator membership and retry detection are one database statement. */
export function projectCreateQuery(
  project: Project,
  actorId: string,
  state: Commissioning,
  event: ProjectAuditEvent,
) {
  return sql`WITH saved AS (
    INSERT INTO projects AS current (id, name, location, company_id, commissioning)
    SELECT ${project.id}, ${project.name}, ${project.location}, ${project.companyId}, ${JSON.stringify(state)}::jsonb
    WHERE EXISTS (SELECT 1 FROM users WHERE id = ${actorId} AND role = 'admin')
      AND EXISTS (SELECT 1 FROM companies WHERE id = ${project.companyId})
    ON CONFLICT (id) DO UPDATE SET id = current.id
    WHERE EXISTS (SELECT 1 FROM users WHERE id = ${actorId} AND role = 'admin')
      AND EXISTS (SELECT 1 FROM project_memberships WHERE user_id = ${actorId} AND project_id = current.id)
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(current.commissioning->'_audit', '[]'::jsonb)) entry
        WHERE entry->>'id' = ${event.id} AND entry->>'detail' = ${event.detail})
    RETURNING id, name, location, company_id
  ), granted AS (
    INSERT INTO project_memberships (user_id, project_id)
    SELECT ${actorId}, id FROM saved
    ON CONFLICT DO NOTHING RETURNING project_id
  ) SELECT id, name, location, company_id AS "companyId" FROM saved`;
}

/** A profile rename changes no programme version or source archive. Audit is atomic. */
export function projectRenameQuery(
  projectId: string,
  actorId: string,
  expectedName: string,
  name: string,
  event: ProjectAuditEvent,
  fallback: Commissioning,
) {
  const matches = sql`EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(commissioning->'_audit', '[]'::jsonb)) entry
    WHERE entry->>'id' = ${event.id} AND entry->>'detail' = ${event.detail})`;
  // A consumed request returns the current profile; it must never undo a later rename (including A→B→A).
  return sql`UPDATE projects SET name = CASE WHEN ${matches} THEN name ELSE ${name} END, commissioning = jsonb_set(
    coalesce(commissioning, ${JSON.stringify(fallback)}::jsonb), '{_audit}',
    CASE WHEN ${matches} THEN coalesce(commissioning->'_audit', '[]'::jsonb)
      ELSE coalesce(commissioning->'_audit', '[]'::jsonb) || ${JSON.stringify([event])}::jsonb END
  ) WHERE id = ${projectId}
    AND (${matches} OR name = ${expectedName})
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(commissioning->'_audit', '[]'::jsonb)) entry
      WHERE entry->>'id' = ${event.id} AND entry->>'detail' <> ${event.detail})
    AND EXISTS (SELECT 1 FROM users WHERE id = ${actorId} AND role = 'admin')
    AND EXISTS (SELECT 1 FROM project_memberships WHERE user_id = ${actorId} AND project_id = ${projectId})
    RETURNING id, name, location, company_id AS "companyId"`;
}
