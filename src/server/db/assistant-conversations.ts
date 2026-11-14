import { sql } from "drizzle-orm";
import type { ConversationInput } from "@/lib/assistant-conversations";
import { conversationTitle } from "@/lib/assistant-conversations";

/** Evaluated inside every statement, independently of the HTTP authorization snapshot. */
export const conversationAccess = (
  userId: string,
  projectId: string,
) => sql`EXISTS (
  SELECT 1 FROM project_memberships m JOIN users u ON u.id=m.user_id
  WHERE m.project_id=${projectId} AND u.id=${userId}
    AND u.role IN ('admin','manager','supervisor')
    AND (u.role='admin' OR u.modules IS NULL OR (u.modules ? 'tasks' AND u.modules ? 'commissioning'))
)`;
const fields = sql`id, project_id AS "projectId", title, messages, report_state AS "reportState", version, created_at AS "createdAt", updated_at AS "updatedAt"`;
export function conversationDetailQuery(
  userId: string,
  projectId: string,
  id: string,
) {
  return sql`SELECT ${fields} FROM assistant_conversations WHERE id=${id}::uuid AND user_id=${userId} AND project_id=${projectId} AND ${conversationAccess(userId, projectId)}`;
}
export function conversationListQuery(
  userId: string,
  projectId: string,
  offset: number,
  limit: number,
) {
  return sql`WITH visible AS (
    SELECT id,project_id AS "projectId",title,version,created_at AS "createdAt",updated_at AS "updatedAt",jsonb_array_length(messages) AS "messageCount"
    FROM assistant_conversations WHERE user_id=${userId} AND project_id=${projectId} AND ${conversationAccess(userId, projectId)}
  ), page AS (SELECT * FROM visible ORDER BY "updatedAt" DESC,id DESC LIMIT ${limit} OFFSET ${offset})
  SELECT (SELECT count(*)::integer FROM visible) AS total, coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY "updatedAt" DESC,id DESC) FROM page),'[]'::jsonb) AS conversations`;
}
export function conversationCreateQuery(
  userId: string,
  projectId: string,
  input: ConversationInput,
) {
  return sql`INSERT INTO assistant_conversations(id,user_id,project_id,title,messages,report_state)
    SELECT ${input.id}::uuid,${userId},${projectId},${conversationTitle(input.messages)},${JSON.stringify(input.messages)}::jsonb,${input.reportState ? JSON.stringify(input.reportState) : null}::jsonb
    WHERE ${conversationAccess(userId, projectId)} ON CONFLICT(id) DO NOTHING RETURNING ${fields}`;
}
export function conversationUpdateQuery(
  userId: string,
  projectId: string,
  input: ConversationInput,
) {
  return sql`UPDATE assistant_conversations SET title=${conversationTitle(input.messages)},messages=${JSON.stringify(input.messages)}::jsonb,report_state=${input.reportState ? JSON.stringify(input.reportState) : null}::jsonb,version=version+1,updated_at=clock_timestamp()
    WHERE id=${input.id}::uuid AND user_id=${userId} AND project_id=${projectId} AND version=${input.version} AND version<2147483647 AND ${conversationAccess(userId, projectId)} RETURNING ${fields}`;
}
export function conversationDeleteQuery(
  userId: string,
  projectId: string,
  id: string,
  version: number,
) {
  return sql`DELETE FROM assistant_conversations WHERE id=${id}::uuid AND user_id=${userId} AND project_id=${projectId} AND version=${version} AND ${conversationAccess(userId, projectId)} RETURNING id`;
}
