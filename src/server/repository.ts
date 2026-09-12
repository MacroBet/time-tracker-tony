import { assignmentQuery } from "./db/assignment";
import { attachmentInsertQuery } from "./db/attachment-insert";
import { taskUpdateQuery } from "./db/task-update";
import "server-only";
import { and, eq, inArray, getTableColumns, sql } from "drizzle-orm";
import { db } from "./db/client";
import * as tables from "./db/schema";
import { dataMode } from "./config";
import { createDemoData } from "@/lib/demo-data";
import { scopeData } from "@/lib/permissions";
import {
  emptyData,
  type AppData,
  type User,
  type Task,
  type Shift,
  type Activity,
  type Attachment,
  type Feedback,
} from "@/lib/domain";
import { HttpError, requireCondition } from "./errors";

type Session = { tokenHash: string; userId: string; expiresAt: string };
type FileRecord = Attachment & { data: string };
type FeedbackRecord = Feedback & { screenshot?: string };
type DemoStore = {
  data: AppData;
  sessions: Session[];
  files: FileRecord[];
  feedback: FeedbackRecord[];
};
const globalStore = globalThis as typeof globalThis & {
  fieldtrackDemo?: DemoStore;
};
function demo() {
  requireCondition(
    dataMode() === "demo",
    503,
    "Configure the database to continue.",
  );
  return (globalStore.fieldtrackDemo ??= {
    data: createDemoData(),
    sessions: [],
    files: [],
    feedback: [],
  });
}
function usingDemo() {
  const mode = dataMode();
  requireCondition(
    mode !== "unconfigured",
    503,
    "Database not configured. Set DATABASE_URL before deploying.",
  );
  return mode === "demo";
}
function clean<T>(value: unknown): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (v === null ? undefined : v)),
  ) as T;
}
const publicUser = {
  id: tables.users.id,
  name: tables.users.name,
  email: tables.users.email,
  role: tables.users.role,
  companyId: tables.users.companyId,
};
const fileMeta = {
  id: tables.attachments.id,
  taskId: tables.attachments.taskId,
  uploadedBy: tables.attachments.uploadedBy,
  name: tables.attachments.name,
  contentType: tables.attachments.contentType,
  size: tables.attachments.size,
  createdAt: tables.attachments.createdAt,
};
const feedbackMeta = {
  id: tables.feedback.id,
  userId: tables.feedback.userId,
  projectId: tables.feedback.projectId,
  description: tables.feedback.description,
  page: tables.feedback.page,
  createdAt: tables.feedback.createdAt,
  hasScreenshot: tables.feedback.hasScreenshot,
};
export async function findUser(id: string): Promise<User | undefined> {
  if (usingDemo()) return demo().data.users.find((u) => u.id === id);
  return (
    await db()
      .select(publicUser)
      .from(tables.users)
      .where(eq(tables.users.id, id))
  )[0];
}
export async function credentials(email: string) {
  if (usingDemo()) return undefined;
  return (
    await db().select().from(tables.users).where(eq(tables.users.email, email))
  )[0];
}
export async function demoDirectory() {
  const store = demo();
  return { users: store.data.users, companies: store.data.companies };
}
export async function loadData(user: User): Promise<AppData> {
  if (usingDemo())
    return structuredClone(
      scopeData(user, {
        ...demo().data,
        attachments: demo().files.map((file) => ({
          id: file.id,
          taskId: file.taskId,
          uploadedBy: file.uploadedBy,
          name: file.name,
          contentType: file.contentType,
          size: file.size,
          createdAt: file.createdAt,
        })),
        feedback: demo().feedback.map((item) => ({
          id: item.id,
          userId: item.userId,
          projectId: item.projectId,
          description: item.description,
          page: item.page,
          createdAt: item.createdAt,
          hasScreenshot: item.hasScreenshot,
        })),
      }),
    );
  const mine = await db()
    .select()
    .from(tables.memberships)
    .where(eq(tables.memberships.userId, user.id));
  const projectIds = mine.map((m) => m.projectId);
  if (!projectIds.length)
    return { ...structuredClone(emptyData), users: [user] };
  const memberRows = await db()
    .select()
    .from(tables.memberships)
    .where(inArray(tables.memberships.projectId, projectIds));
  const taskScope = and(
    inArray(tables.tasks.projectId, projectIds),
    user.role === "worker" ? eq(tables.tasks.assignedTo, user.id) : undefined,
  );
  const [projects, users, companies, tasks, shiftRows, feedback] =
    await Promise.all([
      db()
        .select()
        .from(tables.projects)
        .where(inArray(tables.projects.id, projectIds)),
      db()
        .select(publicUser)
        .from(tables.users)
        .where(
          inArray(
            tables.users.id,
            memberRows.map((m) => m.userId),
          ),
        ),
      db().select().from(tables.companies),
      db().select().from(tables.tasks).where(taskScope),
      db()
        .select(getTableColumns(tables.shifts))
        .from(tables.shifts)
        .innerJoin(tables.users, eq(tables.shifts.userId, tables.users.id))
        .where(
          and(
            inArray(tables.shifts.projectId, projectIds),
            user.role === "worker"
              ? eq(tables.shifts.userId, user.id)
              : undefined,
          ),
        ),
      db()
        .select(feedbackMeta)
        .from(tables.feedback)
        .where(
          and(
            inArray(tables.feedback.projectId, projectIds),
            user.role === "manager" || user.role === "admin"
              ? undefined
              : eq(tables.feedback.userId, user.id),
          ),
        ),
    ]);
  const taskIds = tasks.map((t) => t.id);
  const [activities, attachments] = taskIds.length
    ? await Promise.all([
        db()
          .select()
          .from(tables.activities)
          .where(inArray(tables.activities.taskId, taskIds)),
        db()
          .select(fileMeta)
          .from(tables.attachments)
          .where(inArray(tables.attachments.taskId, taskIds)),
      ])
    : [[], []];
  return scopeData(
    user,
    clean<AppData>({
      projects,
      users,
      companies,
      tasks,
      shifts: shiftRows,
      activities,
      attachments,
      feedback,
      memberships: memberRows,
    }),
  );
}
export async function insertTask(task: Task, activity: Activity) {
  if (usingDemo()) {
    demo().data.tasks.push(task);
    demo().data.activities.push(activity);
    return;
  }
  await db().batch([
    db().insert(tables.tasks).values(task),
    db().insert(tables.activities).values(activity),
  ]);
}
export async function updateTask(
  task: Task,
  activity: Activity,
  expectedVersion: number,
) {
  if (usingDemo()) {
    const index = demo().data.tasks.findIndex(
      (t) => t.id === task.id && t.version === expectedVersion,
    );
    requireCondition(
      index >= 0,
      409,
      "This task changed. Refresh before saving again.",
    );
    demo().data.tasks[index] = task;
    demo().data.activities.push(activity);
    return;
  }
  // One statement: the audit entry only exists if the versioned update succeeded.
  const result = await db().execute(
    taskUpdateQuery(task, activity, expectedVersion),
  );
  requireCondition(
    result.rows.length,
    409,
    "This task changed. Refresh before saving again.",
  );
}
export async function insertShift(shift: Shift) {
  if (usingDemo()) {
    requireCondition(
      !demo().data.shifts.some(
        (s) => s.userId === shift.userId && s.status === "active",
      ),
      409,
      "You already have an active shift.",
    );
    demo().data.shifts.push(shift);
    return;
  }
  try {
    await db().insert(tables.shifts).values(shift);
  } catch (error) {
    const cause = error as { cause?: { code?: string }; code?: string };
    if ((cause.cause?.code ?? cause.code) === "23505")
      throw new HttpError(409, "You already have an active shift.");
    throw error;
  }
}
export async function updateShift(shift: Shift, expectedVersion: number) {
  if (usingDemo()) {
    const index = demo().data.shifts.findIndex(
      (s) => s.id === shift.id && s.version === expectedVersion,
    );
    requireCondition(
      index >= 0,
      409,
      "This timesheet changed. Refresh and try again.",
    );
    demo().data.shifts[index] = shift;
    return;
  }
  const rows = await db()
    .update(tables.shifts)
    .set({
      ...shift,
      approvedBy: shift.approvedBy ?? null,
      approvedAt: shift.approvedAt ?? null,
      rejectionReason: shift.rejectionReason ?? null,
    })
    .where(
      and(
        eq(tables.shifts.id, shift.id),
        eq(tables.shifts.version, expectedVersion),
      ),
    )
    .returning({ id: tables.shifts.id });
  requireCondition(
    rows.length,
    409,
    "This timesheet changed. Refresh and try again.",
  );
}
export async function insertAttachment(
  file: FileRecord,
  activity: Activity,
  expectedVersion: number,
) {
  if (usingDemo()) {
    const task = demo().data.tasks.find((t) => t.id === file.taskId);
    requireCondition(
      task &&
        task.version === expectedVersion &&
        !["completed", "not-applicable"].includes(task.status),
      409,
      "This activity changed. Refresh before uploading again.",
    );
    task.updatedAt = file.createdAt;
    task.version += 1;
    demo().files.push(file);
    demo().data.activities.push(activity);
    return;
  }
  const result = await db().execute(
    attachmentInsertQuery(file, activity, expectedVersion),
  );
  requireCondition(
    result.rows.length,
    409,
    "This activity changed. Refresh before uploading again.",
  );
}
export async function attachment(id: string): Promise<FileRecord | undefined> {
  if (usingDemo()) return demo().files.find((f) => f.id === id);
  return (
    await db()
      .select()
      .from(tables.attachments)
      .where(eq(tables.attachments.id, id))
  )[0];
}
export async function insertFeedback(item: FeedbackRecord) {
  if (usingDemo()) {
    demo().feedback.push(item);
    return;
  }
  await db().insert(tables.feedback).values(item);
}
export async function feedbackScreenshot(id: string) {
  if (usingDemo()) return demo().feedback.find((f) => f.id === id)?.screenshot;
  return (
    await db()
      .select({ screenshot: tables.feedback.screenshot })
      .from(tables.feedback)
      .where(eq(tables.feedback.id, id))
  )[0]?.screenshot;
}
export async function putSession(session: Session) {
  if (usingDemo()) {
    demo().sessions = demo().sessions.filter(
      (s) => new Date(s.expiresAt) > new Date(),
    );
    demo().sessions.push(session);
    return;
  }
  await db().insert(tables.sessions).values(session);
}
export async function getSession(hash: string) {
  if (usingDemo())
    return demo().sessions.find(
      (s) => s.tokenHash === hash && new Date(s.expiresAt) > new Date(),
    );
  return (
    await db()
      .select()
      .from(tables.sessions)
      .where(
        and(
          eq(tables.sessions.tokenHash, hash),
          sql`${tables.sessions.expiresAt} > now()`,
        ),
      )
  )[0];
}
export async function deleteSession(hash: string) {
  if (usingDemo()) {
    demo().sessions = demo().sessions.filter((s) => s.tokenHash !== hash);
    return;
  }
  await db().delete(tables.sessions).where(eq(tables.sessions.tokenHash, hash));
}
export async function consumeLoginAttempt(key: string, limit: number) {
  // Shared across Vercel instances, unlike an in-process rate limiter.
  const result = await db().execute(sql`
    INSERT INTO login_attempts (key, count, window_start) VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN login_attempts.window_start < now() - interval '15 minutes' THEN 1 ELSE login_attempts.count + 1 END,
      window_start = CASE WHEN login_attempts.window_start < now() - interval '15 minutes' THEN now() ELSE login_attempts.window_start END
    RETURNING count`);
  requireCondition(
    Number(result.rows[0]?.count) <= limit,
    429,
    "Too many sign-in attempts. Try again in 15 minutes.",
  );
}

export async function assignTasks(
  updates: { task: Task; activity: Activity; expectedVersion: number }[],
) {
  if (usingDemo()) {
    requireCondition(
      updates.every((u) =>
        demo().data.tasks.some(
          (t) => t.id === u.task.id && t.version === u.expectedVersion,
        ),
      ),
      409,
      "An activity changed. Refresh and try again.",
    );
    for (const u of updates) {
      demo().data.tasks[
        demo().data.tasks.findIndex((t) => t.id === u.task.id)
      ] = u.task;
      demo().data.activities.push(u.activity);
    }
    return;
  }
  const result = await db().execute(assignmentQuery(updates));
  requireCondition(
    result.rows.length === updates.length,
    409,
    "An activity changed. No assignments were saved. Refresh and try again.",
  );
}
export async function planTask(
  task: Task,
  activity: Activity,
  version: number,
) {
  if (usingDemo()) {
    await updateTask(task, activity, version);
    return;
  }
  const result = await db().execute(sql`
    WITH changed AS (UPDATE tasks SET title=${task.title},description=${task.description},priority=${task.priority ?? null},due_date=${task.dueDate ?? null},discipline=${task.discipline},location=${task.location},version=version+1,updated_at=${task.updatedAt} WHERE id=${task.id} AND version=${version} RETURNING id)
    INSERT INTO task_activities(id,task_id,actor_id,actor_name,action,note,created_at) SELECT ${activity.id},id,${activity.actorId},${activity.actorName},${activity.action},${activity.note},${activity.createdAt}::timestamptz FROM changed RETURNING id`);
  requireCondition(
    result.rows.length,
    409,
    "Activity changed. Refresh and try again.",
  );
}

export async function putAccount(
  user: User,
  passwordHash: string,
  projectIds: string[],
) {
  requireCondition(
    !usingDemo(),
    400,
    "Account provisioning requires a connected database.",
  );
  try {
    await db().batch([
      db()
        .insert(tables.users)
        .values({ ...user, passwordHash }),
      db()
        .insert(tables.memberships)
        .values(
          projectIds.map((projectId) => ({ userId: user.id, projectId })),
        ),
    ]);
  } catch (error) {
    const e = error as { cause?: { code?: string } };
    if (e.cause?.code === "23505")
      throw new HttpError(409, "Email already exists.");
    throw error;
  }
}
export async function putProject(
  project: AppData["projects"][number],
  userId: string,
) {
  requireCondition(
    !usingDemo(),
    400,
    "Project provisioning requires a connected database.",
  );
  await db().batch([
    db().insert(tables.projects).values(project),
    db().insert(tables.memberships).values({ userId, projectId: project.id }),
  ]);
}
export async function changePassword(userId: string, passwordHash: string) {
  requireCondition(
    !usingDemo(),
    400,
    "Password changes require a connected database.",
  );
  await db().batch([
    db()
      .update(tables.users)
      .set({ passwordHash })
      .where(eq(tables.users.id, userId)),
    db().delete(tables.sessions).where(eq(tables.sessions.userId, userId)),
  ]);
}

export async function setProjectAccess(
  userId: string,
  managedProjectIds: string[],
  projectIds: string[],
) {
  requireCondition(
    !usingDemo(),
    400,
    "Project access changes require a connected database.",
  );
  // Revoke sessions as part of the change; subsequent API calls always recheck membership.
  const queries = [
    db()
      .delete(tables.memberships)
      .where(
        and(
          eq(tables.memberships.userId, userId),
          inArray(tables.memberships.projectId, managedProjectIds),
        ),
      ),
    db().delete(tables.sessions).where(eq(tables.sessions.userId, userId)),
  ] as const;
  if (projectIds.length)
    await db().batch([
      ...queries,
      db()
        .insert(tables.memberships)
        .values(projectIds.map((projectId) => ({ userId, projectId }))),
    ]);
  else await db().batch([...queries]);
}
