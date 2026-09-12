import { sql } from "drizzle-orm";
import type { Task, Activity } from "@/lib/domain";
export function assignmentQuery(
  updates: { task: Task; activity: Activity; expectedVersion: number }[],
) {
  const payload = updates.map((u) => ({
    id: u.task.id,
    version: u.expectedVersion,
    assigned_to: u.task.assignedTo ?? null,
    status: u.task.status,
    updated_at: u.task.updatedAt,
    event_id: u.activity.id,
    actor_id: u.activity.actorId,
    actor_name: u.activity.actorName,
    action: u.activity.action,
    note: u.activity.note,
  }));
  return sql`
    WITH input AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS x(id text,version integer,assigned_to text,status text,updated_at timestamptz,event_id text,actor_id text,actor_name text,action text,note text)),
    locked AS MATERIALIZED (SELECT t.id FROM tasks t JOIN input i ON t.id=i.id AND t.version=i.version FOR UPDATE OF t),
    changed AS (UPDATE tasks t SET assigned_to=i.assigned_to,status=i.status::task_status,updated_at=i.updated_at,version=t.version+1 FROM input i WHERE t.id=i.id AND t.version=i.version AND (SELECT count(*) FROM locked)=${updates.length} RETURNING t.id)
    INSERT INTO task_activities(id,task_id,actor_id,actor_name,action,note,created_at)
    SELECT i.event_id,c.id,i.actor_id,i.actor_name,i.action,i.note,i.updated_at FROM changed c JOIN input i ON i.id=c.id RETURNING id`;
}
