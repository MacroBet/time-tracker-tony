import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { requireUser } from "./auth";
import {
  loadData,
  loadProgrammeSourceIndex,
  saveWorkingSchedule,
} from "./repository";
import { commissioning, hasModule } from "@/lib/commissioning";
import { querySourceProgrammeIndex } from "@/lib/programme-source";
import {
  canConfirmWorkingSchedule,
  managedWorkingSourceIndex,
  nextWorkingActivityCode,
  previewWorkingSchedule,
  resolveWorkingSourceIndex,
  workingDraftKey,
  workingManagedRows,
  workingScheduleDraftSchema,
  type WorkingScheduleDraft,
  type WorkingScheduleIdentity,
  type WorkingSchedulePreview,
} from "@/lib/schedule-working";
import { HttpError, requireCondition } from "./errors";
import { json, readJson } from "./http";
import type { Task, Activity } from "@/lib/domain";
import { activityStepProgress } from "@/lib/project-reports";

const TTL = 10 * 60 * 1000;
const proofSchema = z
  .object({
    purpose: z.literal("fieldtrack-schedule-working-v1"),
    userId: z.string(),
    projectId: z.string(),
    projectVersion: z.number().int(),
    issuedAt: z.number(),
    expiresAt: z.number(),
    draft: workingScheduleDraftSchema,
    identity: z
      .object({
        internalId: z.string(),
        activityId: z.string(),
        taskId: z.string(),
      })
      .optional(),
  })
  .strict();
async function sessionKey() {
  const key = (await cookies()).get("fieldtrack_session")?.value;
  requireCondition(
    key && /^[a-f0-9]{64}$/.test(key),
    401,
    "A valid session is required.",
  );
  return key;
}
const signature = (body: string, key: string) =>
  createHmac("sha256", key)
    .update(`fieldtrack-schedule-working-v1:${body}`)
    .digest();
async function authorized(projectId: string) {
  const user = await requireUser();
  requireCondition(
    user.role !== "worker" && hasModule(user, "commissioning"),
    403,
    "Schedule management access required.",
  );
  const data = await loadData(user),
    project = data.projects.find((row) => row.id === projectId);
  requireCondition(project, 404, "Project not found.");
  const state = commissioning(project);
  const source = state.sourceProgrammeSummary
    ? await loadProgrammeSourceIndex(projectId, user.id)
    : managedWorkingSourceIndex(state.schedule, state.workingSchedule);
  requireCondition(
    source,
    409,
    "The source schedule could not be loaded. Refresh before proposing changes.",
  );
  return { user, data, project, state, source };
}
function publicProposal(preview: WorkingSchedulePreview, reason: string) {
  return {
    errors: preview.errors,
    changes: preview.changes,
    activity: preview.activity,
    impactedActivities: preview.impactedActivities.slice(0, 100),
    impactedCount: preview.impactedCount,
    impactRowsShown: Math.min(100, preview.impactedCount),
    recalculation: preview.recalculation,
    replay: preview.replay,
    createdTask: preview.createdTask,
    reason,
    limitation:
      "Only explicit forecast dates and dependency links change. Downstream dates, calendar definitions, source durations, baselines and actuals are not recalculated.",
  };
}
export type WorkingScheduleProposal = ReturnType<typeof publicProposal>;
export async function prepareWorkingScheduleProposal(
  projectId: string,
  input: WorkingScheduleDraft,
) {
  const { user, state, source } = await authorized(projectId);
  const draft = workingScheduleDraftSchema.parse(input);
  requireCondition(
    draft.kind !== "create-asset-activity" || hasModule(user, "tasks"),
    403,
    "Task access is required to create an asset activity and its task.",
  );
  const identity: WorkingScheduleIdentity | undefined =
    draft.kind === "create-asset-activity"
      ? {
          internalId: `app-${randomUUID()}`,
          activityId: nextWorkingActivityCode([
            ...resolveWorkingSourceIndex(
              source,
              state.workingSchedule,
            ).activities.map((row) => row.activityId),
            ...state.schedule.map((row) => row.activityId),
          ]),
          taskId: randomUUID(),
        }
      : undefined;
  const preview = previewWorkingSchedule(source, state.workingSchedule, draft, {
    userId: user.id,
    now: new Date().toISOString(),
    identity,
    assetIds: state.assets.map((a) => a.id),
  });
  const now = Date.now(),
    proof = proofSchema.parse({
      purpose: "fieldtrack-schedule-working-v1",
      userId: user.id,
      projectId,
      projectVersion: state.version,
      issuedAt: now,
      expiresAt: now + TTL,
      draft,
      identity,
    });
  const body = Buffer.from(JSON.stringify(proof)).toString("base64url"),
    key = await sessionKey();
  return {
    proposal: publicProposal(preview, draft.reason),
    token: `${body}.${signature(body, key).toString("base64url")}`,
    expiresAt: new Date(proof.expiresAt).toISOString(),
    projectVersion: state.version,
    canConfirm:
      canConfirmWorkingSchedule(user.role) &&
      !preview.errors.length &&
      !!preview.changes.length,
  };
}
export async function confirmWorkingScheduleProposal(
  projectId: string,
  token: string,
) {
  const { user, project, state, source } = await authorized(projectId);
  requireCondition(
    canConfirmWorkingSchedule(user.role),
    403,
    "Only an administrator or manager can confirm their own schedule proposal. Supervisors can preview only.",
  );
  const key = await sessionKey();
  const parts = token.split(".");
  requireCondition(
    token.length < 128000 &&
      parts.length === 2 &&
      parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part)),
    400,
    "Invalid schedule confirmation.",
  );
  const supplied = Buffer.from(parts[1], "base64url"),
    expected = signature(parts[0], key);
  requireCondition(
    supplied.length === expected.length && timingSafeEqual(supplied, expected),
    400,
    "Invalid schedule signature. Preview again.",
  );
  let proof: z.infer<typeof proofSchema>;
  try {
    proof = proofSchema.parse(
      JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")),
    );
  } catch {
    throw new HttpError(400, "Invalid schedule confirmation.");
  }
  requireCondition(
    proof.userId === user.id && proof.projectId === projectId,
    403,
    "This proposal belongs to another user or project.",
  );
  requireCondition(
    proof.expiresAt > Date.now() &&
      proof.issuedAt <= Date.now() &&
      proof.expiresAt - proof.issuedAt === TTL,
    400,
    "This proposal expired. Preview again.",
  );
  const receipt = state.workingSchedule?.receipts.find(
    (r) => r.idempotencyKey === proof.draft.idempotencyKey,
  );
  if (receipt) {
    requireCondition(
      receipt.userId === user.id &&
        receipt.draftKey === workingDraftKey(proof.draft),
      409,
      "This request identifier was used for another proposal.",
    );
    return {
      updated: false,
      replay: true,
      version: state.version,
      activityId: receipt.activityId,
      internalId: receipt.internalId,
      taskId: receipt.taskId,
    };
  }
  requireCondition(
    state.version === proof.projectVersion,
    409,
    "Project changed. Preview the schedule change again.",
  );
  const now = new Date().toISOString();
  const preview = previewWorkingSchedule(
    source,
    state.workingSchedule,
    proof.draft,
    {
      userId: user.id,
      now,
      identity: proof.identity,
      assetIds: state.assets.map((a) => a.id),
    },
  );
  requireCondition(
    !preview.errors.length && !!preview.changes.length,
    409,
    preview.errors.join(" ") || "No changes to save.",
  );
  const schedule = workingManagedRows(state, preview.next);
  if (proof.draft.sourceSha256 === "managed") {
    preview.next.removedLinkIds = [];
    preview.next.addedLinks = [];
  }
  const next = {
    ...state,
    workingSchedule: preview.next,
    schedule,
    version: state.version + 1,
    revisions: [
      ...state.revisions,
      {
        at: now,
        actor: user.name,
        action: "edit" as const,
        reason: proof.draft.reason,
        changes: preview.changes,
      },
    ],
  };
  let task: Task | undefined, activity: Activity | undefined;
  if (preview.createdTask) {
    requireCondition(
      hasModule(user, "tasks"),
      403,
      "Task access changed. Preview again.",
    );
    const created = preview.createdTask,
      asset = state.assets.find((a) => a.id === created.assetId)!;
    task = {
      id: created.id,
      title: created.title,
      description: created.description,
      projectId,
      companyId: project.companyId,
      createdBy: user.id,
      status: "pending",
      cx: {
        kind: "task",
        assetId: created.assetId,
        activityId: created.activityId,
        result: "untested",
      },
      discipline: asset.discipline ?? "",
      location: asset.location,
      source: "manual",
      dueDate: created.dueDate,
      notes: proof.draft.reason,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    activity = {
      id: randomUUID(),
      taskId: task.id,
      actorId: user.id,
      actorName: user.name,
      action: "Created with schedule activity",
      note: proof.draft.reason,
      createdAt: now,
    };
  }
  await saveWorkingSchedule(
    projectId,
    user.id,
    next,
    state.version,
    proof.draft.sourceSha256,
    task,
    activity,
  );
  return {
    updated: true,
    replay: false,
    version: next.version,
    workingRevision: preview.next.revision,
    activityId: preview.activity!.activityId,
    internalId: preview.activity!.internalId,
    taskId: preview.createdTask?.id,
  };
}
export async function getWorkingSchedule(request: Request, projectId: string) {
  const { user, state, source, data } = await authorized(projectId);
  const params = new URL(request.url).searchParams,
    original = params.get("view") === "source";
  const index = original
    ? source
    : resolveWorkingSourceIndex(source, state.workingSchedule);
  const page = querySourceProgrammeIndex(index, {
    q: params.get("q") ?? undefined,
    wbs: params.get("wbs") ?? undefined,
    calendar: params.get("calendar") ?? undefined,
    status: params.get("status") ?? undefined,
    page: Number(params.get("page") ?? 0),
    pageSize: 50,
    internalId: params.get("internalId") ?? undefined,
  });
  return json({
    ...page,
    sourceSummary: source.summary,
    projectVersion: state.version,
    workingRevision: state.workingSchedule?.revision ?? 0,
    projection: original ? "source" : "working",
    canConfirm: canConfirmWorkingSchedule(user.role),
    activityProgress: Object.fromEntries(
      page.activities.map((row) => [
        row.internalId,
        activityStepProgress(
          state,
          data.tasks,
          index.summary.sha256 === "managed"
            ? row.activityId
            : `source:${index.summary.sha256}:${row.internalId}`,
          undefined,
          index,
        ),
      ]),
    ),
  });
}
export async function proposeWorkingSchedule(
  request: Request,
  projectId: string,
) {
  const input = z
    .object({ draft: workingScheduleDraftSchema })
    .strict()
    .parse(await readJson(request, 96000));
  return json(await prepareWorkingScheduleProposal(projectId, input.draft));
}
export async function commitWorkingSchedule(
  request: Request,
  projectId: string,
) {
  const input = z
    .object({
      token: z.string().min(1).max(128000),
      confirmed: z.literal(true),
    })
    .strict()
    .parse(await readJson(request, 140000));
  return json(await confirmWorkingScheduleProposal(projectId, input.token));
}
