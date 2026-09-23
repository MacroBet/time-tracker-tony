import { z } from "zod";
import {
  isClosed,
  projectDate,
  type Project,
  type Task,
  type User,
} from "./domain";

export const LEVELS = [
  "L1",
  "L2",
  "L2A",
  "L2B",
  "L3",
  "L4",
  "L5",
  "L6",
] as const;
export const PRIORITIES = ["P1", "P2", "P3", "P4", "P5"] as const;
export const MODULES = [
  "tasks",
  "time",
  "dashboard",
  "commissioning",
  "reports",
  "team",
  "feedback",
] as const;
export type Level = (typeof LEVELS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Module = (typeof MODULES)[number];
const key = z.string().trim().min(1).max(150);
const date = z.iso.date().optional();
const levels = z
  .array(z.enum(LEVELS))
  .max(8)
  .refine((v) => new Set(v).size === v.length, "Duplicate levels");
export const assetSchema = z
  .object({
    id: key,
    name: key,
    equipmentType: key,
    location: z.string().trim().max(250).default(""),
    levels,
    deliveryActivityId: key.optional(),
    expectedDelivery: date,
    levelActivities: z.partialRecord(z.enum(LEVELS), key).optional(),
  })
  .strict();
export const scheduleSchema = z
  .object({
    activityId: key,
    name: z.string().trim().min(1).max(500),
    baselineStart: date,
    baselineFinish: date,
    start: date,
    finish: date,
    actualFinish: date,
    progress: z.number().min(0).max(100).optional(),
    source: z.string().max(300).optional(),
  })
  .strict()
  .refine(
    (v) => !v.start || !v.finish || v.start <= v.finish,
    "Finish precedes start",
  );
export const configSchema = z
  .object({
    levels,
    priorities: z
      .array(z.enum(PRIORITIES))
      .min(1)
      .max(5)
      .refine((v) => new Set(v).size === v.length, "Duplicate priorities"),
  })
  .strict();
export const cxSchema = z
  .object({
    kind: z.enum(["task", "issue", "tag", "documentation"]).default("task"),
    assetId: key.optional(),
    activityId: key.optional(),
    level: z.enum(LEVELS).optional(),
    qualityTag: z.string().trim().max(100).optional(),
    progress: z.number().min(0).max(100).optional(),
    result: z
      .enum(["untested", "passed", "failed", "retest"])
      .default("untested"),
    blockerRisk: z.string().trim().max(2000).optional(),
    handoverType: z
      .enum(["manual", "warranty", "training", "sign-off", "test-report"])
      .optional(),
    conforming: z.number().int().min(0).max(100000).optional(),
    nonConforming: z.number().int().min(0).max(100000).optional(),
  })
  .strict()
  .refine(
    (v) => v.kind !== "tag" || (!!v.assetId && !!v.level),
    "Tags require an asset and level",
  );
export type Asset = z.infer<typeof assetSchema>;
export type ScheduleActivity = z.infer<typeof scheduleSchema>;
export type CommissioningTask = z.infer<typeof cxSchema>;
export type ProjectConfig = z.infer<typeof configSchema>;
export interface Commissioning {
  version: number;
  config: ProjectConfig;
  assets: Asset[];
  schedule: ScheduleActivity[];
  revisions: { at: string; actor: string; reason: string; changes: string[] }[];
}
export function commissioning(project?: Project): Commissioning {
  return (
    project?.commissioning ?? {
      version: 0,
      config: { levels: [], priorities: ["P1", "P2", "P3"] },
      assets: [],
      schedule: [],
      revisions: [],
    }
  );
}
export function hasModule(user: User, module: Module) {
  if (user.role === "admin") return true;
  const allowed =
    user.role === "worker"
      ? ["tasks", "time", "commissioning", "feedback"]
      : MODULES;
  return (
    allowed.includes(module) &&
    (
      user.modules ?? [
        "tasks",
        "time",
        "dashboard",
        "commissioning",
        "reports",
        "team",
        "feedback",
      ]
    ).includes(module)
  );
}
export const dueDateFor = (task: Task) => task.scheduleDueDate ?? task.dueDate;
export const taskKind = (task: Task) =>
  task.cx?.kind ?? (task.source !== "manual" ? "issue" : "task");
export function taskAsset(task: Task, project?: Project) {
  return commissioning(project).assets.find((a) => a.id === task.cx?.assetId);
}
export function linkError(
  cx: CommissioningTask | undefined,
  project: Project,
  tasks: Task[],
  taskId?: string,
): string | null {
  if (!cx) return null;
  const state = commissioning(project);
  const asset = state.assets.find((a) => a.id === cx.assetId);
  if (cx.assetId && !asset) return "Choose an asset in this project.";
  if (
    cx.activityId &&
    !state.schedule.some((a) => a.activityId === cx.activityId)
  )
    return "Choose a schedule Activity ID in this project.";
  if (
    cx.level &&
    (!state.config.levels.includes(cx.level) ||
      (asset && !asset.levels.includes(cx.level)))
  )
    return "This level is not applicable to the project or asset.";
  if (
    cx.kind === "tag" &&
    tasks.some(
      (t) =>
        t.id !== taskId &&
        t.projectId === project.id &&
        t.cx?.kind === "tag" &&
        t.cx.assetId === cx.assetId &&
        t.cx.level === cx.level,
    )
  )
    return "This asset already has a tag record for this level. Update that record.";
  return null;
}
export function tagRows(project: Project, tasks: Task[]) {
  const state = commissioning(project);
  const records = new Map(
    tasks
      .filter((t) => t.projectId === project.id && t.cx?.kind === "tag")
      .map((t) => [`${t.cx?.assetId}\0${t.cx?.level}`, t]),
  );
  return state.assets.flatMap((asset) =>
    asset.levels
      .filter((l) => state.config.levels.includes(l))
      .map((level) => {
        const task = records.get(`${asset.id}\0${level}`);
        return {
          asset,
          level,
          task,
          status: task?.status ?? "pending",
          applicable: task?.status !== "not-applicable",
        };
      }),
  );
}

export function tagTimeline(project: Project, tasks: Task[]) {
  const state = commissioning(project),
    schedule = new Map(state.schedule.map((s) => [s.activityId, s]));
  const rows = tagRows(project, tasks)
    .filter((r) => r.applicable)
    .map((r) => {
      const activity = schedule.get(
        r.task?.cx?.activityId ?? r.asset.levelActivities?.[r.level] ?? "",
      );
      return {
        baseline: activity?.baselineFinish,
        forecast: activity?.finish,
        achieved:
          r.task?.status === "completed"
            ? r.task.completedAt?.slice(0, 10)
            : undefined,
      };
    });
  const dates = [
    ...new Set(
      rows.flatMap((r) =>
        [r.baseline, r.forecast, r.achieved].filter((d): d is string => !!d),
      ),
    ),
  ].sort();
  return {
    total: rows.length,
    scheduled: rows.filter((r) => r.forecast).length,
    baselineRecorded: rows.filter((r) => r.baseline).length,
    points: dates.map((date) => ({
      date,
      baseline: rows.filter((r) => r.baseline && r.baseline <= date).length,
      forecast: rows.filter((r) => r.forecast && r.forecast <= date).length,
      achieved: rows.filter((r) => r.achieved && r.achieved <= date).length,
    })),
  };
}
export function tagSummary(project: Project, tasks: Task[], level?: Level) {
  const rows = tagRows(project, tasks).filter(
    (r) => (!level || r.level === level) && r.applicable,
  );
  const completed = rows.filter((r) => r.status === "completed").length;
  return {
    total: rows.length,
    completed,
    percent: rows.length ? Math.round((completed / rows.length) * 100) : null,
  };
}
export interface TaskFilters {
  query?: string;
  priority?: string;
  level?: string;
  equipmentType?: string;
  status?: string;
  dueFrom?: string;
  dueTo?: string;
  kind?: string;
  attention?: string;
}
export function filterTasks(
  tasks: Task[],
  project: Project,
  f: TaskFilters,
  now = new Date(),
) {
  return tasks.filter((t) => {
    const asset = taskAsset(t, project),
      due = dueDateFor(t);
    return (
      t.projectId === project.id &&
      (!f.query ||
        [
          t.id,
          t.externalId,
          t.title,
          t.cx?.activityId,
          asset?.id,
          asset?.name,
          t.cx?.qualityTag,
        ]
          .join(" ")
          .toLowerCase()
          .includes(f.query.trim().toLowerCase())) &&
      (!f.priority || t.priority === f.priority) &&
      (!f.level || t.cx?.level === f.level) &&
      (!f.equipmentType || asset?.equipmentType === f.equipmentType) &&
      (!f.status || t.status === f.status) &&
      (!f.kind || taskKind(t) === f.kind) &&
      (!f.dueFrom || (!!due && due >= f.dueFrom)) &&
      (!f.dueTo || (!!due && due <= f.dueTo)) &&
      (!f.attention ||
        (f.attention === "overdue"
          ? !isClosed(t) && !!due && due < projectDate(now)
          : f.attention === "blocked"
            ? t.status === "blocked"
            : f.attention === "failed"
              ? t.cx?.result === "failed" || t.cx?.result === "retest"
              : f.attention === "unassigned"
                ? !t.assignedTo && !isClosed(t)
                : true))
    );
  });
}
