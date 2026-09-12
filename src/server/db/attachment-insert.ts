import { sql } from "drizzle-orm";
import type { Attachment, Activity } from "@/lib/domain";
export function attachmentInsertQuery(
  file: Attachment & { data: string },
  activity: Activity,
  expectedVersion: number,
) {
  return sql`
    WITH changed AS (
      UPDATE tasks SET updated_at = ${file.createdAt}, version = version + 1
      WHERE id = ${file.taskId} AND version = ${expectedVersion}
        AND status NOT IN ('completed', 'not-applicable') RETURNING id
    ), uploaded AS (
      INSERT INTO attachments (id, task_id, uploaded_by, name, content_type, size, data, created_at)
      SELECT ${file.id}, id, ${file.uploadedBy}, ${file.name}, ${file.contentType}, ${file.size}, ${file.data}, ${file.createdAt}::timestamptz
      FROM changed RETURNING task_id
    )
    INSERT INTO task_activities (id, task_id, actor_id, actor_name, action, note, created_at)
    SELECT ${activity.id}, task_id, ${activity.actorId}, ${activity.actorName}, ${activity.action}, ${activity.note}, ${activity.createdAt}::timestamptz
    FROM uploaded RETURNING id`;
}
