import { z } from "zod";
import { criticalityCoverage } from "./source-criticality";
import type { Commissioning, ScheduleActivity } from "./commissioning";
import type {
  SourceActivityView,
  SourceProgrammeIndex,
  SourceRelationshipView,
} from "./programme-source";

const key = z.string().trim().min(1).max(150);
const assetIdsSchema = z
  .array(key)
  .max(200)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Choose each linked asset once",
  );
const date = z.iso.date();
const sourceHash = z.union([
  z.string().regex(/^[a-f0-9]{64}$/),
  z.literal("managed"),
]);
const linkSchema = z
  .object({
    predecessorId: key,
    successorId: key,
    type: z.enum(["PR_FS", "PR_SS", "PR_FF", "PR_SF"]),
    lagHours: z.number().finite().min(-1000000).max(1000000),
  })
  .strict();
const base = {
  sourceSha256: sourceHash,
  idempotencyKey: z.string().trim().min(8).max(150),
  reason: z.string().trim().min(10).max(1000),
};
export const workingScheduleDraftSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...base,
      kind: z.literal("edit-activity"),
      internalId: key,
      start: date.optional(),
      finish: date.optional(),
      assetIds: assetIdsSchema.optional(),
      addLinks: z.array(linkSchema).max(100).optional(),
      removeLinkIds: z.array(z.number().int()).max(100).optional(),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("create-asset-activity"),
      assetId: key,
      title: z.string().trim().min(1).max(150),
      description: z.string().trim().max(5000).optional(),
      start: date.optional(),
      deadline: date,
    })
    .strict(),
]);
export type WorkingScheduleDraft = z.infer<typeof workingScheduleDraftSchema>;
const patchSchema = z
  .object({
    internalId: key,
    start: date.optional(),
    finish: date.optional(),
    assetIds: assetIdsSchema.optional(),
  })
  .strict();
const addedSchema = z
  .object({
    internalId: key,
    activityId: key,
    name: z.string().max(150),
    assetId: key,
    taskId: key,
    start: date.optional(),
    finish: date,
    createdBy: key,
    createdAt: z.iso.datetime(),
  })
  .strict();
const savedLink = linkSchema.extend({
  sourceLine: z.number().int().negative(),
});
export const workingScheduleSchema = z
  .object({
    sourceSha256: sourceHash,
    revision: z.number().int().min(0),
    activityPatches: z.array(patchSchema).max(50000),
    addedActivities: z.array(addedSchema).max(15000),
    removedLinkIds: z.array(z.number().int()).max(100000),
    addedLinks: z.array(savedLink).max(100000),
    receipts: z
      .array(
        z
          .object({
            idempotencyKey: key,
            draftKey: z.string().max(96000),
            internalId: key,
            activityId: key,
            taskId: key.optional(),
            userId: key,
          })
          .strict(),
      )
      .max(5000),
  })
  .strict();
export type WorkingSchedule = z.infer<typeof workingScheduleSchema>;
export type WorkingScheduleIdentity = {
  internalId: string;
  activityId: string;
  taskId: string;
};
export type WorkingSchedulePreview = {
  errors: string[];
  changes: string[];
  next: WorkingSchedule;
  activity: SourceActivityView | null;
  impactedActivities: {
    internalId: string;
    activityId: string;
    name: string;
    start?: string;
    finish?: string;
    datesChanged: boolean;
  }[];
  impactedCount: number;
  recalculation: "explicit-dates-only";
  replay: boolean;
  createdTask?: {
    id: string;
    assetId: string;
    activityId: string;
    title: string;
    description: string;
    dueDate: string;
    start?: string;
  };
};
export const canConfirmWorkingSchedule = (role: string) =>
  role === "admin" || role === "manager";
export const workingDraftKey = (draft: WorkingScheduleDraft) =>
  JSON.stringify(workingScheduleDraftSchema.parse(draft));
/** Readable project references; internal UUID identity and revision CAS remain independent. */
export function nextWorkingActivityCode(codes: Iterable<string>): string {
  const used = new Set(Array.from(codes, (code) => code.trim().toUpperCase()));
  let next = 1;
  while (used.has(`FT-${String(next).padStart(5, "0")}`)) next++;
  return `FT-${String(next).padStart(5, "0")}`;
}
const empty = (sha: string): WorkingSchedule => ({
  sourceSha256: sha,
  revision: 0,
  activityPatches: [],
  addedActivities: [],
  removedLinkIds: [],
  addedLinks: [],
  receipts: [],
});

/** A projection only: source fields, calendars, dates and original links are never mutated. */
export function resolveWorkingSourceIndex(
  source: SourceProgrammeIndex,
  working?: WorkingSchedule,
): SourceProgrammeIndex {
  if (!working) return source;
  if (working.sourceSha256 !== source.summary.sha256)
    throw new Error(
      "The source schedule changed. Preview against its current source hash.",
    );
  const patches = new Map(
    working.activityPatches.map((p) => [p.internalId, p]),
  );
  const activities = source.activities.map((row) => {
    const patch = patches.get(row.internalId);
    return {
      ...row,
      ...(patch?.start
        ? { start: patch.start, startField: "working_start_date" }
        : {}),
      ...(patch?.finish
        ? { finish: patch.finish, finishField: "working_finish_date" }
        : {}),
    };
  });
  const existing = new Set(activities.map((row) => row.internalId));
  for (const row of working.addedActivities) {
    if (existing.has(row.internalId)) continue; // Managed rows already include their persisted mirror.
    const patch = patches.get(row.internalId);
    activities.push({
      criticality: {
        state: "unknown",
        totalFloatHours: null,
        freeFloatHours: null,
        projectId: null,
        reason: "not-in-p6-source",
      },
      internalId: row.internalId,
      activityId: row.activityId,
      name: row.name,
      wbsId: "",
      wbsPath: "Added in FieldTrack",
      calendarId: "",
      calendarName: "Not recorded",
      status: "TK_NotStart",
      taskType: row.start ? "FT_Activity" : "FT_Deadline",
      milestone: false,
      durationHours: "",
      predecessorCount: 0,
      successorCount: 0,
      start: patch?.start ?? row.start,
      finish: patch?.finish ?? row.finish,
      startField:
        (patch?.start ?? row.start) ? "working_start_date" : undefined,
      finishField: "working_finish_date",
    });
  }
  const codes = new Map(
    activities.map((row) => [row.internalId, row.activityId]),
  );
  const removed = new Set(working.removedLinkIds);
  const links: SourceRelationshipView[] = source.links
    .filter((link) => !removed.has(link.sourceLine))
    .map((link) => ({ ...link, fields: { ...link.fields } }));
  for (const link of working.addedLinks)
    links.push({
      ...link,
      lagHours: String(link.lagHours),
      predecessorActivityId:
        codes.get(link.predecessorId) ?? link.predecessorId,
      successorActivityId: codes.get(link.successorId) ?? link.successorId,
      fields: {
        origin: "FieldTrack working revision",
        pred_type: link.type,
        lag_hr_cnt: String(link.lagHours),
      },
    });
  const incoming = new Map<string, SourceRelationshipView[]>(),
    outgoing = new Map<string, SourceRelationshipView[]>();
  for (const link of links) {
    incoming.set(link.successorId, [
      ...(incoming.get(link.successorId) ?? []),
      link,
    ]);
    outgoing.set(link.predecessorId, [
      ...(outgoing.get(link.predecessorId) ?? []),
      link,
    ]);
  }
  const byId: SourceProgrammeIndex["byId"] = new Map();
  const sourceWbsSearch = new Map(
    source.activities.map((activity, index) => [
      activity.internalId,
      source.wbsSearch[index],
    ]),
  );
  for (const activity of activities) {
    activity.predecessorCount = incoming.get(activity.internalId)?.length ?? 0;
    activity.successorCount = outgoing.get(activity.internalId)?.length ?? 0;
    const original = source.byId.get(activity.internalId);
    const patch = patches.get(activity.internalId);
    byId.set(activity.internalId, {
      activity,
      sourceLine: original?.sourceLine ?? 0,
      fields: {
        ...(original?.fields ?? {}),
        ...(patch?.start ? { working_start_date: patch.start } : {}),
        ...(patch?.finish ? { working_finish_date: patch.finish } : {}),
      },
      relationships: [
        ...(incoming.get(activity.internalId) ?? []),
        ...(outgoing.get(activity.internalId) ?? []),
      ],
    });
  }
  return {
    ...source,
    ...(source.criticality
      ? {
          criticality: {
            ...source.criticality,
            coverage: criticalityCoverage(activities),
            workingRevision: working.revision,
            workingStale:
              source.criticality.workingStale ||
              Boolean(
                working.addedActivities.length ||
                working.addedLinks.length ||
                working.removedLinkIds.length ||
                working.activityPatches.some(
                  (patch) => patch.start || patch.finish,
                ),
              ),
          },
        }
      : {}),
    summary: {
      ...source.summary,
      activities: activities.length,
      relationships: links.length,
    },
    activities,
    byId,
    links,
    filters: {
      calendars: [...source.filters.calendars],
      statuses: [...new Set(activities.map((a) => a.status))],
    },
    search: activities.map((a) =>
      `${a.internalId} ${a.activityId} ${a.name}`.toLowerCase(),
    ),
    wbsSearch: activities.map(
      (a) =>
        sourceWbsSearch.get(a.internalId) ??
        `${a.wbsId} ${a.wbsPath}`.toLowerCase(),
    ),
  };
}

/** Adapt managed rows to the same validation graph; this is never presented as an imported P6 source. */
export function managedWorkingSourceIndex(
  schedule: readonly ScheduleActivity[],
  working?: WorkingSchedule,
): SourceProgrammeIndex {
  const aliases = new Map(
    (working?.addedActivities ?? []).map((row) => [
      row.activityId,
      row.internalId,
    ]),
  );
  const identity = (id: string) => aliases.get(id) ?? id;
  const activities: SourceActivityView[] = schedule.map((row) => ({
    internalId: identity(row.activityId),
    activityId: row.activityId,
    name: row.name,
    start: row.start,
    finish: row.finish,
    startField: row.start ? "start" : undefined,
    finishField: row.finish ? "finish" : undefined,
    calendarId: "app-monday-friday",
    calendarName: "App Monday–Friday",
    wbsId: "",
    wbsPath: "",
    status: row.actualFinish ? "TK_Complete" : "TK_NotStart",
    taskType: row.start ? "FT_Activity" : "FT_Deadline",
    milestone: false,
    durationHours: "",
    durationDays: row.durationDays,
    predecessorCount: row.predecessors?.length ?? 0,
    successorCount: schedule.filter((next) =>
      next.predecessors?.some((p) => p.activityId === row.activityId),
    ).length,
  }));
  let line = 1;
  const links: SourceRelationshipView[] = schedule.flatMap((row) =>
    (row.predecessors ?? []).map((p) => ({
      sourceLine: line++,
      predecessorId: identity(p.activityId),
      predecessorActivityId: p.activityId,
      successorId: identity(row.activityId),
      successorActivityId: row.activityId,
      type: "PR_FS",
      lagHours: String(p.lagDays * 8),
      fields: { managed_lag_days: String(p.lagDays) },
    })),
  );
  return {
    summary: {
      format: "p6-xer-v1",
      sha256: "managed",
      fileName: "Managed schedule",
      projectId: "",
      projectName: "Managed schedule",
      activities: activities.length,
      relationships: links.length,
      calendars: 1,
      wbs: 0,
      sourceRecords: 0,
      recalculation: "source-dates-only",
    },
    activities,
    links,
    byId: new Map(
      activities.map((activity) => {
        const row = schedule.find((r) => r.activityId === activity.activityId)!;
        return [
          activity.internalId,
          {
            activity,
            sourceLine: 0,
            fields: {
              ...(row.actualFinish ? { act_end_date: row.actualFinish } : {}),
              ...(row.baselineStart
                ? { baseline_start: row.baselineStart }
                : {}),
              ...(row.baselineFinish
                ? { baseline_finish: row.baselineFinish }
                : {}),
            },
            relationships: links.filter(
              (l) =>
                l.predecessorId === activity.internalId ||
                l.successorId === activity.internalId,
            ),
          },
        ];
      }),
    ),
    filters: {
      calendars: [{ id: "app-monday-friday", name: "App Monday–Friday" }],
      statuses: ["TK_NotStart", "TK_Complete"],
    },
    search: activities.map((a) => `${a.activityId} ${a.name}`.toLowerCase()),
    wbsSearch: activities.map(() => ""),
  };
}

function graphErrors(index: SourceProgrammeIndex) {
  const errors: string[] = [],
    indegree = new Map(index.activities.map((row) => [row.internalId, 0])),
    out = new Map<string, string[]>();
  for (const link of index.links) {
    if (!indegree.has(link.predecessorId) || !indegree.has(link.successorId)) {
      errors.push("A dependency references an activity outside this schedule.");
      continue;
    }
    if (link.predecessorId === link.successorId)
      errors.push("An activity cannot depend on itself.");
    indegree.set(link.successorId, indegree.get(link.successorId)! + 1);
    out.set(link.predecessorId, [
      ...(out.get(link.predecessorId) ?? []),
      link.successorId,
    ]);
  }
  const queue = [...indegree].filter(([, n]) => !n).map(([id]) => id);
  for (let cursor = 0; cursor < queue.length; cursor++)
    for (const id of out.get(queue[cursor]) ?? []) {
      const n = indegree.get(id)! - 1;
      indegree.set(id, n);
      if (!n) queue.push(id);
    }
  if (queue.length !== indegree.size)
    errors.push("The complete schedule dependency graph contains a cycle.");
  return errors;
}

export function previewWorkingSchedule(
  source: SourceProgrammeIndex,
  previous: WorkingSchedule | undefined,
  input: WorkingScheduleDraft,
  context: {
    userId: string;
    now: string;
    identity?: WorkingScheduleIdentity;
    assetIds: readonly string[];
  },
): WorkingSchedulePreview {
  const draft = workingScheduleDraftSchema.parse(input);
  const next = structuredClone(previous ?? empty(draft.sourceSha256));
  const result: WorkingSchedulePreview = {
    errors: [],
    changes: [],
    next,
    activity: null,
    impactedActivities: [],
    impactedCount: 0,
    recalculation: "explicit-dates-only",
    replay: false,
  };
  if (
    source.summary.sha256 !== draft.sourceSha256 ||
    next.sourceSha256 !== draft.sourceSha256
  ) {
    result.errors.push(
      "The source schedule hash changed. Preview against the current source.",
    );
    return result;
  }
  const receipt = next.receipts.find(
    (r) => r.idempotencyKey === draft.idempotencyKey,
  );
  if (receipt) {
    if (
      receipt.draftKey !== workingDraftKey(draft) ||
      receipt.userId !== context.userId
    )
      result.errors.push(
        "This request identifier was already used for another proposal.",
      );
    else {
      result.replay = true;
      result.activity =
        resolveWorkingSourceIndex(source, previous).byId.get(receipt.internalId)
          ?.activity ?? null;
    }
    return result;
  }
  const before = resolveWorkingSourceIndex(source, previous);
  let targetId: string;
  if (draft.kind === "edit-activity") {
    targetId = draft.internalId;
    const old = before.byId.get(targetId);
    if (!old) {
      result.errors.push("Choose a saved activity in this schedule.");
      return result;
    }
    if (draft.start && old.fields.act_start_date)
      result.errors.push(
        "Actual start is protected; it cannot be replaced by a working forecast.",
      );
    if (draft.finish && old.fields.act_end_date)
      result.errors.push(
        "Actual finish is protected; it cannot be replaced by a working forecast.",
      );
    const start = draft.start ?? old.activity.start,
      finish = draft.finish ?? old.activity.finish;
    if (start && finish && finish < start)
      result.errors.push("Finish cannot precede start.");
    const patch = {
      ...(next.activityPatches.find((p) => p.internalId === targetId) ?? {
        internalId: targetId,
      }),
      ...(draft.start ? { start: draft.start } : {}),
      ...(draft.finish ? { finish: draft.finish } : {}),
      ...(draft.assetIds !== undefined
        ? { assetIds: [...draft.assetIds] }
        : {}),
    };
    if (draft.assetIds !== undefined) {
      if (draft.assetIds.some((id) => !context.assetIds.includes(id)))
        result.errors.push(
          "A linked asset is missing or belongs to another project.",
        );
      const oldIds =
        previous?.activityPatches.find((p) => p.internalId === targetId)
          ?.assetIds ?? [];
      if (
        JSON.stringify([...oldIds].sort()) !==
        JSON.stringify([...draft.assetIds].sort())
      )
        result.changes.push(
          `${old.activity.activityId}: linked assets ${oldIds.join(", ") || "none"} → ${draft.assetIds.join(", ") || "none"}`,
        );
    }
    if (draft.start && draft.start !== old.activity.start)
      result.changes.push(
        `${old.activity.activityId}: start ${old.activity.start ?? "not recorded"} → ${draft.start}`,
      );
    if (draft.finish && draft.finish !== old.activity.finish)
      result.changes.push(
        `${old.activity.activityId}: finish ${old.activity.finish ?? "not recorded"} → ${draft.finish}`,
      );
    next.activityPatches = [
      ...next.activityPatches.filter((p) => p.internalId !== targetId),
      patch,
    ];
    for (const id of draft.removeLinkIds ?? []) {
      const link = before.links.find((l) => l.sourceLine === id);
      if (
        !link ||
        (link.predecessorId !== targetId && link.successorId !== targetId)
      ) {
        result.errors.push(
          `Dependency ${id} does not belong to this activity.`,
        );
        continue;
      }
      if (id < 0)
        next.addedLinks = next.addedLinks.filter((l) => l.sourceLine !== id);
      else next.removedLinkIds = [...new Set([...next.removedLinkIds, id])];
      result.changes.push(
        `Remove ${link.predecessorActivityId} → ${link.successorActivityId} (${link.type}, ${link.lagHours}h)`,
      );
    }
    let line =
      next.addedLinks.reduce(
        (minimum, link) => Math.min(minimum, link.sourceLine),
        0,
      ) - 1;
    for (const link of draft.addLinks ?? []) {
      if (link.predecessorId !== targetId && link.successorId !== targetId) {
        result.errors.push(
          "Every proposed dependency must touch the selected activity.",
        );
        continue;
      }
      if (
        !before.byId.has(link.predecessorId) ||
        !before.byId.has(link.successorId)
      ) {
        result.errors.push(
          "A proposed dependency references a missing activity.",
        );
        continue;
      }
      const duplicate = resolveWorkingSourceIndex(source, next).links.some(
        (l) =>
          l.predecessorId === link.predecessorId &&
          l.successorId === link.successorId &&
          l.type === link.type &&
          Number(l.lagHours || 0) === link.lagHours,
      );
      if (duplicate) {
        result.errors.push("This exact dependency already exists.");
        continue;
      }
      next.addedLinks.push({ ...link, sourceLine: line-- });
      result.changes.push(
        `Add ${before.byId.get(link.predecessorId)!.activity.activityId} → ${before.byId.get(link.successorId)!.activity.activityId} (${link.type}, ${link.lagHours}h)`,
      );
    }
  } else {
    if (!context.assetIds.includes(draft.assetId))
      result.errors.push("Choose an asset in this project.");
    if (draft.start && draft.deadline < draft.start)
      result.errors.push("The deadline cannot precede start.");
    const identity = context.identity;
    if (!identity) {
      result.errors.push(
        "The server must prepare the activity and task identities.",
      );
      return result;
    }
    targetId = identity.internalId;
    if (
      before.byId.has(targetId) ||
      before.activities.some(
        (a) =>
          a.activityId.trim().toUpperCase() ===
          identity.activityId.trim().toUpperCase(),
      )
    )
      result.errors.push(
        "The generated activity identity is already in use. Preview again.",
      );
    next.addedActivities.push({
      ...identity,
      name: draft.title,
      assetId: draft.assetId,
      start: draft.start,
      finish: draft.deadline,
      createdBy: context.userId,
      createdAt: context.now,
    });
    result.createdTask = {
      id: identity.taskId,
      assetId: draft.assetId,
      activityId: identity.activityId,
      title: draft.title,
      description: draft.description ?? "",
      dueDate: draft.deadline,
      start: draft.start,
    };
    result.changes.push(
      `Add ${identity.activityId}: ${draft.title}; asset ${draft.assetId}; deadline ${draft.deadline}${draft.start ? `; start ${draft.start}` : "; start and duration not recorded"}`,
      "Create one unassigned task linked to the same asset and schedule activity.",
    );
  }
  if (
    draft.sourceSha256 === "managed" &&
    draft.kind === "edit-activity" &&
    draft.addLinks?.some(
      (link) =>
        link.type !== "PR_FS" || link.lagHours < 0 || link.lagHours % 8 !== 0,
    )
  )
    result.errors.push(
      "The managed calendar supports finish-to-start links with non-negative whole working-day lag only. No unsupported relation will be saved.",
    );
  const projected = resolveWorkingSourceIndex(source, next);
  result.errors.push(...graphErrors(projected));
  const outgoing = new Map<string, string[]>();
  for (const link of [...before.links, ...projected.links])
    outgoing.set(link.predecessorId, [
      ...(outgoing.get(link.predecessorId) ?? []),
      link.successorId,
    ]);
  const affected = new Set([targetId]),
    queue = [targetId];
  for (let cursor = 0; cursor < queue.length; cursor++)
    for (const id of outgoing.get(queue[cursor]) ?? [])
      if (!affected.has(id)) {
        affected.add(id);
        queue.push(id);
      }
  result.impactedActivities = [...affected]
    .map((id) => projected.byId.get(id)?.activity)
    .filter((a): a is SourceActivityView => !!a)
    .map((a) => ({
      internalId: a.internalId,
      activityId: a.activityId,
      name: a.name,
      start: a.start,
      finish: a.finish,
      datesChanged: idDatesChanged(before.byId.get(a.internalId)?.activity, a),
    }));
  result.impactedCount = result.impactedActivities.length;
  result.activity = projected.byId.get(targetId)?.activity ?? null;
  if (!result.errors.length && result.changes.length) {
    next.revision++;
    next.receipts.push({
      idempotencyKey: draft.idempotencyKey,
      draftKey: workingDraftKey(draft),
      internalId: targetId,
      activityId: result.activity!.activityId,
      taskId: result.createdTask?.id,
      userId: context.userId,
    });
  }
  return result;
}
function idDatesChanged(
  before: SourceActivityView | undefined,
  after: SourceActivityView,
) {
  return (
    !before || before.start !== after.start || before.finish !== after.finish
  );
}

/** Keep the existing managed task-link consumers on exactly the same new/edited row. */
export function workingManagedRows(
  state: Commissioning,
  next: WorkingSchedule,
): ScheduleActivity[] {
  const rows = state.schedule.map((row) => ({ ...row }));
  for (const added of next.addedActivities) {
    const patch = next.activityPatches.find(
      (p) => p.internalId === added.internalId,
    );
    const row = {
      activityId: added.activityId,
      name: added.name,
      start: patch?.start ?? added.start,
      finish: patch?.finish ?? added.finish,
    };
    const existing = rows.findIndex((r) => r.activityId === added.activityId);
    if (existing < 0) rows.push(row);
    else rows[existing] = { ...rows[existing], ...row };
  }
  if (next.sourceSha256 === "managed")
    for (const patch of next.activityPatches) {
      const row = rows.find((r) => r.activityId === patch.internalId);
      if (row) {
        if (patch.start) row.start = patch.start;
        if (patch.finish) row.finish = patch.finish;
      }
    }
  if (next.sourceSha256 === "managed") {
    const projection = resolveWorkingSourceIndex(
      managedWorkingSourceIndex(state.schedule, state.workingSchedule),
      next,
    );
    const byId = new Map(
      projection.activities.map((row) => [row.internalId, row.activityId]),
    );
    for (const row of rows) {
      const target = projection.activities.find(
        (item) => item.activityId === row.activityId,
      );
      if (target)
        row.predecessors = projection.links
          .filter((link) => link.successorId === target.internalId)
          .map((link) => ({
            activityId: byId.get(link.predecessorId)!,
            lagDays: Number(link.lagHours || 0) / 8,
          }));
    }
  }
  return rows;
}
