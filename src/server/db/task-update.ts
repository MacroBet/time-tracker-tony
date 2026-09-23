import { sql } from "drizzle-orm";
import type { Task, Activity } from "@/lib/domain";
export function taskUpdateQuery(
  task: Task,
  activity: Activity,
  expectedVersion: number,
) {
  return sql`
    WITH changed AS (
      UPDATE tasks SET status = ${task.status}, assigned_to = ${task.assignedTo ?? null}, notes = ${task.notes ?? null},
        completed_at = ${task.completedAt ?? null}, cx = ${JSON.stringify(task.cx ?? null)}::jsonb, updated_at = ${task.updatedAt}, version = version + 1
      WHERE id = ${task.id} AND version = ${expectedVersion} RETURNING id
    )
    INSERT INTO task_activities (id, task_id, actor_id, actor_name, action, note, created_at)
    SELECT ${activity.id}, id, ${activity.actorId}, ${activity.actorName}, ${activity.action}, ${activity.note}, ${activity.createdAt}::timestamptz
    FROM changed RETURNING id`;
}
