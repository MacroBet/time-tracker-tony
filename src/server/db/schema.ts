import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  integer,
  real,
  timestamp,
  date,
  primaryKey,
  index,
  uniqueIndex,
  check,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "worker",
  "supervisor",
  "manager",
  "admin",
]);
export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "in-progress",
  "blocked",
  "review",
  "completed",
  "not-applicable",
]);
export const priorityEnum = pgEnum("priority", ["P1", "P2", "P3"]);
export const sourceEnum = pgEnum("issue_source", [
  "manual",
  "bim360",
  "acc",
  "procore",
  "excel",
]);
export const shiftStatusEnum = pgEnum("shift_status", [
  "active",
  "completed",
  "pending-approval",
  "approved",
  "rejected",
]);
const time = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "string" });

export const companies = pgTable("companies", {
  id: text().primaryKey(),
  name: text().notNull(),
  logo: text().notNull().default(""),
});
export const users = pgTable("users", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  role: roleEnum().notNull(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  passwordHash: text("password_hash"),
});
export const projects = pgTable("projects", {
  id: text().primaryKey(),
  name: text().notNull(),
  location: text().notNull(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
});
export const memberships = pgTable(
  "project_memberships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.projectId] })],
);
export const tasks = pgTable(
  "tasks",
  {
    id: text().primaryKey(),
    title: text().notNull(),
    description: text().notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    assignedTo: text("assigned_to").references(() => users.id),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    status: taskStatusEnum().notNull().default("pending"),
    priority: priorityEnum(),
    importData:
      jsonb("import_data").$type<import("@/lib/domain").Task["importData"]>(),
    discipline: text().notNull(),
    location: text().notNull().default(""),
    source: sourceEnum().notNull().default("manual"),
    externalId: text("external_id"),
    dueDate: date("due_date"),
    notes: text(),
    completedAt: time("completed_at"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
    version: integer().notNull().default(1),
  },
  (t) => [
    index("tasks_project_status").on(t.projectId, t.status),
    index("tasks_assignee").on(t.assignedTo),
    index("tasks_due_date").on(t.dueDate),
    uniqueIndex("tasks_external_issue").on(t.projectId, t.source, t.externalId),
  ],
);
export const shifts = pgTable(
  "shifts",
  {
    id: text().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    startTime: time("start_time").notNull(),
    endTime: time("end_time"),
    checkInMethod: text("check_in_method").notNull().default("manual"),
    status: shiftStatusEnum().notNull(),
    manualHours: real("manual_hours"),
    notes: text(),
    location: text(),
    approvedBy: text("approved_by").references(() => users.id),
    approvedAt: time("approved_at"),
    rejectionReason: text("rejection_reason"),
    version: integer().notNull().default(1),
  },
  (t) => [
    index("shifts_user").on(t.userId),
    uniqueIndex("one_active_shift_per_user")
      .on(t.userId)
      .where(sql`${t.status} = 'active'`),
    check(
      "shift_end_after_start",
      sql`${t.endTime} IS NULL OR ${t.endTime} >= ${t.startTime}`,
    ),
    check(
      "manual_hours_range",
      sql`${t.manualHours} IS NULL OR ${t.manualHours} BETWEEN 0 AND 12`,
    ),
  ],
);
export const activities = pgTable(
  "task_activities",
  {
    id: text().primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    actorName: text("actor_name").notNull(),
    action: text().notNull(),
    note: text().notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("activity_task").on(t.taskId)],
);
export const attachments = pgTable(
  "attachments",
  {
    id: text().primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
    contentType: text("content_type").notNull(),
    size: integer().notNull(),
    // Bounded MVP storage, behind authenticated routes. Move payloads to object storage for scale.
    data: text().notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("attachments_task").on(t.taskId),
    check("attachment_size_limit", sql`${t.size} > 0 AND ${t.size} <= 2097152`),
  ],
);
export const feedback = pgTable("feedback", {
  id: text().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  description: text().notNull(),
  page: text().notNull(),
  screenshot: text(),
  hasScreenshot: boolean("has_screenshot").notNull().default(false),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: time("expires_at").notNull(),
  },
  (t) => [index("sessions_expiry").on(t.expiresAt)],
);
export const loginAttempts = pgTable("login_attempts", {
  key: text().primaryKey(),
  count: integer().notNull().default(1),
  windowStart: time("window_start").notNull(),
});
