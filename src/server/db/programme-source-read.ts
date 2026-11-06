import { sql } from "drizzle-orm";

/** Metadata and membership are read afresh even on a process-cache hit. */
export function programmeSourceMetadataQuery(
  projectId: string,
  userId: string,
) {
  return sql`SELECT
    coalesce((p.commissioning->>'version')::integer,0) AS version,
    p.commissioning->>'sourceProgrammeContentHash' AS "contentHash",
    p.commissioning->'sourceProgrammeSummary' AS summary
    FROM projects p WHERE p.id=${projectId}
    AND EXISTS (SELECT 1 FROM project_memberships m WHERE m.project_id=p.id AND m.user_id=${userId})`;
}

/** The archive is retained in storage, but resource/assignment/opaque tables never
 * cross the database transport for Gantt reads. A revision race returns no row.
 */
export function programmeSourceProjectionQuery(
  projectId: string,
  userId: string,
  version: number,
  contentHash: string | undefined,
) {
  return sql`SELECT jsonb_build_object(
    'format',p.commissioning->'sourceProgramme'->'format',
    'source',p.commissioning->'sourceProgramme'->'source',
    'tables',jsonb_strip_nulls(jsonb_build_object(
      'TASK',p.commissioning->'sourceProgramme'->'tables'->'TASK',
      'TASKPRED',p.commissioning->'sourceProgramme'->'tables'->'TASKPRED',
      'PROJWBS',p.commissioning->'sourceProgramme'->'tables'->'PROJWBS',
      'CALENDAR',p.commissioning->'sourceProgramme'->'tables'->'CALENDAR',
      'PROJECT',p.commissioning->'sourceProgramme'->'tables'->'PROJECT'
    ))) AS source FROM projects p WHERE p.id=${projectId}
    AND coalesce((p.commissioning->>'version')::integer,0)=${version}
    AND coalesce(p.commissioning->>'sourceProgrammeContentHash','')=${contentHash ?? ""}
    AND p.commissioning->'sourceProgramme' IS NOT NULL
    AND EXISTS (SELECT 1 FROM project_memberships m WHERE m.project_id=p.id AND m.user_id=${userId})`;
}
