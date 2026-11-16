import { sql } from "drizzle-orm";

/** One read statement / one project. No evidence blobs, feedback, shifts or other projects cross the DB transport. */
export function copilotSnapshotQuery(
  projectId: string,
  userId: string,
  includeTasks: boolean,
  worker: boolean,
) {
  const fields = {
    id: sql`t.id`,
    title: sql`t.title`,
    description: sql`t.description`,
    projectId: sql`t.project_id`,
    companyId: sql`t.company_id`,
    assignedTo: sql`t.assigned_to`,
    createdBy: sql`t.created_by`,
    status: sql`t.status`,
    priority: sql`t.priority`,
    cx: sql`t.cx`,
    importData: sql`t.import_data`,
    discipline: sql`t.discipline`,
    location: sql`t.location`,
    source: sql`t.source`,
    externalId: sql`t.external_id`,
    dueDate: sql`t.due_date`,
    notes: sql`t.notes`,
    completedAt: sql`t.completed_at`,
    createdAt: sql`t.created_at`,
    updatedAt: sql`t.updated_at`,
    version: sql`t.version`,
  };
  const task = sql`jsonb_build_object(${sql.join(
    Object.entries(fields).flatMap(([name, value]) => [
      sql`${name}::text`,
      value,
    ]),
    sql`, `,
  )})`;
  return sql`SELECT jsonb_build_object('id',p.id,'name',p.name,'location',p.location,'companyId',p.company_id,
    'commissioning',p.commissioning - 'sourceProgramme' - '_audit') AS project,
    (SELECT coalesce(jsonb_agg(${task}), '[]'::jsonb) FROM tasks t WHERE t.project_id=p.id
      AND ${includeTasks} AND (${!worker} OR t.assigned_to=${userId})) AS tasks
    FROM projects p WHERE p.id=${projectId}
      AND EXISTS (SELECT 1 FROM project_memberships m WHERE m.project_id=p.id AND m.user_id=${userId})`;
}

export function copilotProjectAccessQuery(
  projectId: string,
  userId: string,
  taskVersions = false,
) {
  return sql`SELECT p.id,p.name,coalesce((p.commissioning->>'version')::integer,0) AS version,
    CASE WHEN ${taskVersions} THEN (SELECT coalesce(jsonb_agg(jsonb_build_array(t.id,t.version) ORDER BY t.id),'[]'::jsonb)
      FROM tasks t WHERE t.project_id=p.id) END AS "taskVersions"
    FROM projects p WHERE p.id=${projectId}
      AND EXISTS (SELECT 1 FROM project_memberships m WHERE m.project_id=p.id AND m.user_id=${userId})`;
}
