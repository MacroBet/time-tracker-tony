import { sql } from "drizzle-orm";
import type { Commissioning } from "@/lib/commissioning";
import type { Task, Activity } from "@/lib/domain";
import { commissioningWithAudit } from "./project-audit";

/** One PostgreSQL statement: membership/role/source/CAS, working revision, optional task and task audit. */
export function workingScheduleCommitQuery(
  projectId: string,
  actorId: string,
  state: Commissioning,
  expectedVersion: number,
  sourceSha256: string,
  task?: Task,
  activity?: Activity,
) {
  const taskInput = task
    ? [
        {
          id: task.id,
          title: task.title,
          description: task.description,
          project_id: task.projectId,
          company_id: task.companyId,
          created_by: task.createdBy,
          status: task.status,
          cx: task.cx,
          discipline: task.discipline,
          location: task.location,
          source: task.source,
          due_date: task.dueDate,
          notes: task.notes,
          created_at: task.createdAt,
          updated_at: task.updatedAt,
          version: task.version,
          assigned_to: null,
        },
      ]
    : [];
  return sql`WITH guarded AS (
    UPDATE projects p SET commissioning = ${commissioningWithAudit(state)}
    WHERE p.id = ${projectId}
      AND coalesce((p.commissioning->>'version')::integer,0) = ${expectedVersion}
      AND coalesce(p.commissioning#>>'{sourceProgrammeSummary,sha256}','managed') = ${sourceSha256}
      AND EXISTS (SELECT 1 FROM project_memberships m JOIN users u ON u.id=m.user_id
        WHERE m.project_id=p.id AND u.id=${actorId} AND u.role IN ('admin','manager')
          AND (u.role='admin' OR u.modules IS NULL OR u.modules ? 'commissioning')
          AND (${task?.id ?? null}::text IS NULL OR u.role='admin' OR u.modules IS NULL OR u.modules ? 'tasks'))
      AND (${task?.cx?.assetId ?? null}::text IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(p.commissioning->'assets','[]'::jsonb)) a WHERE a->>'id'=${task?.cx?.assetId ?? null}::text))
    RETURNING p.id
  ), input AS (
    SELECT * FROM jsonb_populate_recordset(NULL::tasks,${JSON.stringify(taskInput)}::jsonb)
  ), inserted AS (
    INSERT INTO tasks(id,title,description,project_id,company_id,created_by,status,cx,discipline,location,source,due_date,notes,created_at,updated_at,version,assigned_to)
    SELECT i.id,i.title,i.description,i.project_id,i.company_id,i.created_by,i.status,i.cx,i.discipline,i.location,i.source,i.due_date,i.notes,i.created_at,i.updated_at,i.version,NULL
    FROM input i JOIN guarded g ON g.id=i.project_id RETURNING id
  ), event AS (
    INSERT INTO task_activities(id,task_id,actor_id,actor_name,action,note,created_at)
    SELECT ${activity?.id ?? ""}, t.id, ${actorId}, ${activity?.actorName ?? ""}, ${activity?.action ?? ""}, ${activity?.note ?? ""}, ${activity?.createdAt ?? new Date(0).toISOString()}::timestamptz
    FROM inserted t RETURNING id
  ) SELECT (SELECT count(*)::integer FROM guarded) AS projects, (SELECT count(*)::integer FROM inserted) AS tasks, (SELECT count(*)::integer FROM event) AS events`;
}
