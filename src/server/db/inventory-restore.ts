import { sql } from "drizzle-orm";
import type { Commissioning } from "@/lib/commissioning";
import type { Activity, Task } from "@/lib/domain";
import { commissioningWithAudit } from "./project-audit";

/**
 * New task→asset associations update the project row and increment its version.
 * A row lock alone is insufficient: a waiting READ COMMITTED restore could still
 * use an older task-table snapshot. The changed version makes its CAS fail.
 * Every writer of a new association must use the guards below.
 */
export function inventoryRestoreQuery(
  projectId: string,
  state: Commissioning,
  expectedVersion: number,
  removedAssetIds: readonly string[],
) {
  if (!removedAssetIds.length)
    throw new Error("Restore requires explicit asset IDs.");
  return sql`UPDATE projects SET commissioning = ${commissioningWithAudit(state)}
    WHERE id = ${projectId}
      AND coalesce((commissioning->>'version')::integer, 0) = ${expectedVersion}
      AND NOT EXISTS (
        SELECT 1 FROM tasks t WHERE t.project_id = ${projectId}
          AND t.cx->>'assetId' IN (
            SELECT jsonb_array_elements_text(${JSON.stringify(removedAssetIds)}::jsonb)
          )
      ) RETURNING id`;
}

function taskRow(task: Task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    project_id: task.projectId,
    company_id: task.companyId,
    assigned_to: task.assignedTo ?? null,
    created_by: task.createdBy,
    status: task.status,
    priority: task.priority ?? null,
    cx: task.cx ?? null,
    import_data: task.importData ?? null,
    discipline: task.discipline,
    location: task.location,
    source: task.source,
    external_id: task.externalId ?? null,
    due_date: task.dueDate ?? null,
    notes: task.notes ?? null,
    completed_at: task.completedAt ?? null,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    version: task.version,
  };
}

const taskColumns = sql.raw(
  "id,title,description,project_id,company_id,assigned_to,created_by,status,priority,cx,import_data,discipline,location,source,external_id,due_date,notes,completed_at,created_at,updated_at,version",
);
const selectedColumns = sql.raw(
  "i.id,i.title,i.description,i.project_id,i.company_id,i.assigned_to,i.created_by,i.status,i.priority,i.cx,i.import_data,i.discipline,i.location,i.source,i.external_id,i.due_date,i.notes,i.completed_at,i.created_at,i.updated_at,i.version",
);

function eventInsert(activity: Activity) {
  return sql`INSERT INTO task_activities(id,task_id,actor_id,actor_name,action,note,created_at)
    SELECT ${activity.id}, id, ${activity.actorId}, ${activity.actorName}, ${activity.action},
      ${activity.note}, ${activity.createdAt}::timestamptz FROM changed RETURNING id`;
}

/** Zero returned rows means the proposed asset link no longer exists. */
export function guardedTaskInsertQuery(task: Task, activity?: Activity) {
  const assetId = task.cx?.assetId;
  const projectGuard = assetId
    ? sql`UPDATE projects p SET commissioning = jsonb_set(p.commissioning, '{version}',
          to_jsonb(coalesce((p.commissioning->>'version')::integer, 0) + 1))
        WHERE p.id = ${task.projectId} AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(coalesce(p.commissioning->'assets','[]'::jsonb)) a
          WHERE a->>'id' = ${assetId}
        ) RETURNING p.id`
    : sql`SELECT id FROM projects WHERE id = ${task.projectId}`;
  return sql`WITH input AS (
      SELECT * FROM jsonb_populate_recordset(NULL::tasks, ${JSON.stringify([taskRow(task)])}::jsonb)
    ), guarded AS (${projectGuard}), changed AS (
      INSERT INTO tasks (${taskColumns}) SELECT ${selectedColumns} FROM input i
      JOIN guarded p ON p.id = i.project_id RETURNING id
    ) ${activity ? eventInsert(activity) : sql`SELECT id FROM changed`}`;
}

/**
 * Update keeps task CAS and audit atomic. Only a newly added/different asset link
 * increments the project version; existing links are already visible to restore.
 */
export function guardedTaskUpdateQuery(
  task: Task,
  activity: Activity,
  expectedVersion: number,
) {
  return taskMutationQuery(task, activity, expectedVersion, false);
}

/** Planning also writes cx and therefore participates in the same link guard. */
export function guardedTaskPlanQuery(
  task: Task,
  activity: Activity,
  expectedVersion: number,
) {
  return taskMutationQuery(task, activity, expectedVersion, true);
}

function taskMutationQuery(
  task: Task,
  activity: Activity,
  expectedVersion: number,
  plan: boolean,
) {
  const assetId = task.cx?.assetId;
  return sql`WITH input AS (
      SELECT * FROM jsonb_populate_recordset(NULL::tasks, ${JSON.stringify([taskRow(task)])}::jsonb)
    ), guarded AS (
      UPDATE projects p SET commissioning = CASE WHEN ${assetId ?? null}::text IS NOT NULL
        AND EXISTS (SELECT 1 FROM tasks old WHERE old.id = ${task.id}
          AND old.cx->>'assetId' IS DISTINCT FROM ${assetId ?? null}::text)
        THEN jsonb_set(p.commissioning, '{version}',
          to_jsonb(coalesce((p.commissioning->>'version')::integer, 0) + 1))
        ELSE p.commissioning END
      WHERE p.id = ${task.projectId}
        AND EXISTS (SELECT 1 FROM tasks old WHERE old.id = ${task.id}
          AND old.project_id = p.id AND old.version = ${expectedVersion})
        AND (${assetId ?? null}::text IS NULL OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(coalesce(p.commissioning->'assets','[]'::jsonb)) a
          WHERE a->>'id' = ${assetId ?? null}::text
        )) RETURNING p.id
    ), changed AS (
      UPDATE tasks t SET ${
        plan
          ? sql`title = i.title, description = i.description, priority = i.priority,
          due_date = i.due_date, discipline = i.discipline, location = i.location,`
          : sql`status = i.status, assigned_to = i.assigned_to,
          notes = i.notes, completed_at = i.completed_at,`
      }
        cx = i.cx,
        updated_at = i.updated_at, version = t.version + 1
      FROM input i JOIN guarded p ON p.id = i.project_id
      WHERE t.id = i.id AND t.project_id = p.id AND t.version = ${expectedVersion}
      RETURNING t.id
    ) ${eventInsert(activity)}`;
}

/** One project, at most1000 tags. Unknown asset cancels the complete batch. */
export function guardedTagTasksQuery(tasks: readonly Task[]) {
  if (
    !tasks.length ||
    tasks.length > 1000 ||
    tasks.some(
      (task) => task.projectId !== tasks[0].projectId || !task.cx?.assetId,
    )
  )
    throw new Error("Use one project and 1–1000 asset-linked tag tasks.");
  return sql`WITH input AS (
      SELECT * FROM jsonb_populate_recordset(NULL::tasks, ${JSON.stringify(tasks.map(taskRow))}::jsonb)
    ), guarded AS (
      UPDATE projects p SET commissioning = jsonb_set(p.commissioning, '{version}',
        to_jsonb(coalesce((p.commissioning->>'version')::integer, 0) + 1))
      WHERE p.id = ${tasks[0].projectId} AND EXISTS (
        SELECT 1 FROM input i WHERE NOT EXISTS (
          SELECT 1 FROM tasks old WHERE old.id = i.id OR (
            old.project_id = i.project_id AND old.cx->>'kind' = 'tag'
            AND old.cx->>'assetId' = i.cx->>'assetId'
            AND old.cx->>'level' = i.cx->>'level'
          )
        )
      ) AND NOT EXISTS (
        SELECT 1 FROM input i WHERE NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(coalesce(p.commissioning->'assets','[]'::jsonb)) a
          WHERE a->>'id' = i.cx->>'assetId'
        )
      ) RETURNING p.id
    ), changed AS (
      INSERT INTO tasks (${taskColumns}) SELECT ${selectedColumns} FROM input i
      JOIN guarded p ON p.id = i.project_id ON CONFLICT DO NOTHING RETURNING id
    ) SELECT id FROM changed`;
}
