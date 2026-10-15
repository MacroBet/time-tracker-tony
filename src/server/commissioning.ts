import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Task } from "@/lib/domain";
import { requireUser } from "./auth";
import {
  loadData,
  saveCommissioning,
  saveUserModules,
  insertTagTasks,
} from "./repository";
import { json, readJson } from "./http";
import { requireCondition } from "./errors";
import { canManage } from "@/lib/permissions";
import {
  commissioning,
  configSchema,
  hasModule,
  MODULES,
  scheduleSchema,
} from "@/lib/commissioning";
import {
  mergeRegister,
  registerImportSchema,
} from "@/lib/commissioning-import";

const base = {
  version: z.number().int().min(0),
  reason: z.string().trim().min(10).max(1000),
};
export async function updateRegister(request: Request, projectId: string) {
  const user = await requireUser();
  requireCondition(
    canManage(user) && hasModule(user, "commissioning"),
    403,
    "Commissioning management access required.",
  );
  const input = z
    .discriminatedUnion("action", [
      z
        .object({
          ...base,
          action: z.literal("configure"),
          config: configSchema,
        })
        .strict(),
      z
        .object({
          ...base,
          action: z.literal("import"),
          data: registerImportSchema,
          preview: z.boolean().default(false),
        })
        .strict(),
      z.object({ ...base, action: z.literal("generate-tags") }).strict(),
      z
        .object({
          ...base,
          action: z.literal("schedule"),
          activity: scheduleSchema,
          preview: z.boolean().default(false),
        })
        .strict(),
    ])
    .parse(await readJson(request, 8 * 1024 * 1024));
  const data = await loadData(user);
  const project = data.projects.find((p) => p.id === projectId);
  requireCondition(project, 404, "Project not found.");
  const state = commissioning(project);
  requireCondition(
    state.version === input.version,
    409,
    "Project changed. Refresh and preview again.",
  );
  if (input.action === "generate-tags") {
    const now = new Date().toISOString();
    const rows: Task[] = state.assets.flatMap((asset) =>
      asset.levels
        .filter(
          (level) =>
            state.config.levels.includes(level) &&
            !data.tasks.some(
              (t) =>
                t.projectId === projectId &&
                t.cx?.kind === "tag" &&
                t.cx.assetId === asset.id &&
                t.cx.level === level,
            ),
        )
        .map((level) => ({
          id: randomUUID(),
          title: `${asset.id} · ${level} tag`,
          description: `Complete the ${level} commissioning checks for ${asset.name}. Record the test outcome and submit evidence for approval.`,
          projectId,
          companyId: project.companyId,
          createdBy: user.id,
          notes: input.reason,
          status: "pending" as const,
          discipline: "Commissioning",
          location: asset.location,
          source: "manual" as const,
          cx: {
            kind: "tag" as const,
            assetId: asset.id,
            level,
            activityId: asset.levelActivities?.[level],
            result: "untested" as const,
          },
          createdAt: now,
          updatedAt: now,
          version: 1,
        })),
    );
    const batch = rows.slice(0, 1000);
    return json({
      created: await insertTagTasks(batch),
      remaining: Math.max(0, rows.length - batch.length),
    });
  }
  let next = { ...state },
    changes: string[];
  if (input.action === "configure") {
    requireCondition(
      user.role === "admin",
      403,
      "Only admins can configure project levels and priorities.",
    );
    changes = [
      `Project setup: levels ${input.config.levels.join(", ") || "none"}; priorities ${input.config.priorities.join(", ")}`,
    ];
    next.config = input.config;
  } else {
    const registerData =
      input.action === "schedule"
        ? { assets: [], schedule: [input.activity] }
        : input.data;
    const result = mergeRegister(state, registerData);
    // Retain the applicability of existing records. Disabling project display is a separate setup action.
    for (const asset of registerData.assets) {
      if (
        data.tasks.some(
          (t) =>
            t.projectId === projectId &&
            t.cx?.assetId === asset.id &&
            t.cx.level &&
            !asset.levels.includes(t.cx.level),
        )
      )
        result.errors.push(
          `${asset.id}: retain levels referenced by existing activities.`,
        );
    }
    if (input.preview)
      return json({
        changes: result.changes,
        errors: result.errors,
        assets: result.assets.length,
        schedule: result.schedule.length,
        activities: input.action === "schedule" ? result.schedule : undefined,
      });
    requireCondition(!result.errors.length, 400, result.errors.join(" "));
    changes = result.changes;
    next = { ...next, assets: result.assets, schedule: result.schedule };
  }
  if (!changes.length) return json({ updated: false, version: state.version });
  next = {
    ...next,
    version: state.version + 1,
    revisions: [
      ...state.revisions,
      {
        at: new Date().toISOString(),
        actor: user.name,
        action:
          input.action === "import" ? ("upload" as const) : ("edit" as const),
        reason: input.reason,
        changes,
      },
    ],
  };
  await saveCommissioning(projectId, next, state.version);
  return json({ updated: true, version: next.version });
}

export async function updateModules(request: Request, id: string) {
  const admin = await requireUser();
  requireCondition(
    admin.role === "admin",
    403,
    "Only admins can change feature access.",
  );
  const input = z
    .object({ modules: z.array(z.enum(MODULES)).min(1).max(MODULES.length) })
    .strict()
    .parse(await readJson(request));
  const data = await loadData(admin);
  const target = data.users.find((u) => u.id === id);
  requireCondition(target, 404, "Account not found in your projects.");
  requireCondition(
    target.role !== "admin",
    400,
    "Administrator access cannot be restricted here.",
  );
  requireCondition(
    input.modules.includes("tasks"),
    400,
    "Keep task access enabled.",
  );
  requireCondition(
    target.role !== "worker" ||
      input.modules.every((m) =>
        ["tasks", "time", "commissioning", "feedback"].includes(m),
      ),
    400,
    "Worker profiles cannot access management modules.",
  );
  requireCondition(
    input.modules.includes("time") ||
      !data.shifts.some((s) => s.userId === id && s.status === "active"),
    409,
    "End the active shift before disabling time access.",
  );
  await saveUserModules(id, [...new Set(input.modules)]);
  return json({ updated: true });
}
