import { z } from "zod";
import type { Asset } from "./commissioning";
import type { Task, User } from "./domain";

const id = z.string().trim().min(1).max(150);
const level = z.enum(["L1", "L2", "L2A", "L2B", "L3", "L4", "L5", "L6"]);
const role = z.enum(["worker", "supervisor", "manager", "admin"]);
const timestamp = z.iso.datetime();
const source = z
  .object({
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    document: z.string().min(1).max(500),
    sheet: z.string().min(1).max(200),
  })
  .strict();
export const checksheetRequirementSchema = z
  .object({
    id,
    item: z.string().max(100).optional(),
    requirement: z
      .string()
      .min(1)
      .max(20000)
      .refine((v) => !!v.trim(), "Requirement is empty"),
    equipment: z.string().max(500).optional(),
    discipline: z.string().max(500).optional(),
    notes: z.string().max(30000).optional(),
    sourceRef: z.string().max(300).optional(),
    required: z.boolean().default(true),
  })
  .strict();
const requirements = z
  .array(checksheetRequirementSchema)
  .min(1)
  .max(500)
  .refine(
    (rows) => new Set(rows.map((r) => r.id)).size === rows.length,
    "Duplicate requirement IDs",
  );
export const checksheetTemplateSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(300),
    revision: z.string().trim().min(1).max(100),
    source: source.optional(),
    requirements,
  })
  .strict();
export const signatorySlotSchema = z
  .object({
    id,
    label: z.string().trim().min(1).max(150),
    level: level.optional(),
    userIds: z.array(id).max(100),
    roles: z.array(role).max(4),
  })
  .strict()
  .refine(
    (s) => s.userIds.length + s.roles.length > 0,
    "Choose an existing user or role for each signatory",
  );
export const checksheetResponseSchema = z
  .object({
    stepId: id,
    answer: z.string().max(10000),
    result: z.enum(["passed", "failed", "not-applicable"]).optional(),
    updatedBy: id,
    updatedAt: timestamp,
  })
  .strict();
const signatureSchema = z
  .object({
    slotId: id,
    label: z.string().min(1).max(150),
    userId: id,
    userName: z.string().min(1).max(300),
    signedAt: timestamp,
    invalidatedAt: timestamp.optional(),
    invalidationReason: z.string().max(300).optional(),
  })
  .strict();
export const checksheetInstanceSchema = z
  .object({
    id,
    assetId: id,
    templateId: id,
    templateName: z.string().min(1).max(300),
    templateRevision: z.string().min(1).max(100),
    level: level.optional(),
    requirements,
    responses: z.array(checksheetResponseSchema).max(500),
    signatures: z.array(signatureSchema).max(500),
    createdBy: id,
    createdAt: timestamp,
  })
  .strict();
export const worksToGoSchema = z
  .object({
    id,
    title: z.string().trim().min(1).max(500),
    notes: z.string().trim().max(10000).default(""),
    assetId: id.optional(),
    taskId: id.optional(),
    status: z.enum(["open", "done"]),
    createdBy: id,
    createdAt: timestamp,
    updatedBy: id,
    updatedAt: timestamp,
  })
  .strict();
export const projectChecksheetStateSchema = z
  .object({
    templates: z.array(checksheetTemplateSchema).max(100).default([]),
    sheets: z.array(checksheetInstanceSchema).max(10000).default([]),
    signatorySlots: z.array(signatorySlotSchema).max(50).default([]),
    worksToGo: z.array(worksToGoSchema).max(10000).default([]),
  })
  .strict()
  .refine(
    (s) =>
      [s.templates, s.sheets, s.signatorySlots, s.worksToGo].every(
        (rows) => new Set(rows.map((r) => r.id)).size === rows.length,
      ),
    "Duplicate record IDs",
  );
export type ChecksheetTemplate = z.infer<typeof checksheetTemplateSchema>;
export type ChecksheetInstance = z.infer<typeof checksheetInstanceSchema>;
export type SignatorySlot = z.infer<typeof signatorySlotSchema>;
export type WorksToGo = z.infer<typeof worksToGoSchema>;
export type ProjectChecksheetState = z.infer<
  typeof projectChecksheetStateSchema
>;
export const checksheetCommandSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("save-templates"),
      templates: z.array(checksheetTemplateSchema).min(1).max(100),
    })
    .strict(),
  z
    .object({
      kind: z.literal("configure-signatories"),
      slots: z.array(signatorySlotSchema).max(50),
    })
    .strict(),
  z
    .object({
      kind: z.literal("associate"),
      id,
      assetId: id,
      templateId: id,
      level: level.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("save-response"),
      sheetId: id,
      stepId: id,
      answer: z.string().max(10000),
      result: z.enum(["passed", "failed", "not-applicable"]).optional(),
    })
    .strict(),
  z.object({ kind: z.literal("sign"), sheetId: id, slotId: id }).strict(),
  z
    .object({
      kind: z.literal("add-work"),
      id,
      title: z.string().trim().min(1).max(500),
      notes: z.string().trim().max(10000).default(""),
      assetId: id.optional(),
      taskId: id.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("set-work-status"),
      id,
      status: z.enum(["open", "done"]),
    })
    .strict(),
]);
export type ChecksheetCommand = z.infer<typeof checksheetCommandSchema>;
export type ChecksheetContext = {
  actor: User;
  assets: Asset[];
  users: User[];
  tasks: Task[];
  now: string;
};
export function emptyChecksheetState(): ProjectChecksheetState {
  return { templates: [], sheets: [], signatorySlots: [], worksToGo: [] };
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function need(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
export function canWorkOnAsset(actor: User, assetId: string, tasks: Task[]) {
  return (
    actor.role !== "worker" ||
    tasks.some((t) => t.assignedTo === actor.id && t.cx?.assetId === assetId)
  );
}
export function signatoryApplies(
  slot: SignatorySlot,
  sheet: Pick<ChecksheetInstance, "level">,
) {
  return !slot.level || slot.level === sheet.level;
}
export function canSignChecksheet(slot: SignatorySlot, actor: User) {
  return slot.userIds.includes(actor.id) || slot.roles.includes(actor.role);
}
export function checksheetProgress(sheet: ChecksheetInstance) {
  const answered = sheet.requirements.filter((r) =>
    sheet.responses.some((a) => a.stepId === r.id && !!a.answer.trim()),
  ).length;
  const required = sheet.requirements.filter((r) => r.required);
  return {
    answered,
    total: sheet.requirements.length,
    requiredAnswered: required.filter((r) =>
      sheet.responses.some((a) => a.stepId === r.id && !!a.answer.trim()),
    ).length,
    requiredTotal: required.length,
    activeSignatures: sheet.signatures.filter((s) => !s.invalidatedAt).length,
  };
}
export function scopeChecksheetState(
  state: ProjectChecksheetState | undefined,
  ctx: Pick<ChecksheetContext, "actor" | "assets" | "tasks">,
): ProjectChecksheetState {
  const s = state ?? emptyChecksheetState();
  if (ctx.actor.role !== "worker") return s;
  const assets = new Set(
    ctx.assets
      .filter((a) => canWorkOnAsset(ctx.actor, a.id, ctx.tasks))
      .map((a) => a.id),
  );
  const sheets = s.sheets.filter((x) => assets.has(x.assetId));
  const templates = new Set(sheets.map((x) => x.templateId));
  return {
    templates: s.templates.filter((x) => templates.has(x.id)),
    sheets,
    signatorySlots: s.signatorySlots
      .filter((slot) => sheets.some((sheet) => signatoryApplies(slot, sheet)))
      .map((slot) => ({
        ...slot,
        userIds: slot.userIds.filter((id) => id === ctx.actor.id),
      })),
    worksToGo: s.worksToGo.filter(
      (x) =>
        x.createdBy === ctx.actor.id ||
        (x.assetId && assets.has(x.assetId)) ||
        (x.taskId &&
          ctx.tasks.some(
            (t) => t.id === x.taskId && t.assignedTo === ctx.actor.id,
          )),
    ),
  };
}
export function applyChecksheetCommand(
  state: ProjectChecksheetState | undefined,
  raw: unknown,
  ctx: ChecksheetContext,
): { state: ProjectChecksheetState; changes: string[] } {
  const command = checksheetCommandSchema.parse(raw);
  const before = state ?? emptyChecksheetState();
  const next = structuredClone(before);
  const changes: string[] = [];
  const manage = ctx.actor.role !== "worker";
  timestamp.parse(ctx.now);
  const invalidate = (sheet: ChecksheetInstance, reason: string) => {
    sheet.signatures = sheet.signatures.map((sig) =>
      sig.invalidatedAt
        ? sig
        : { ...sig, invalidatedAt: ctx.now, invalidationReason: reason },
    );
  };
  const assetFor = (assetId: string) => {
    const asset = ctx.assets.find((a) => a.id === assetId);
    need(asset, "Asset not found in this project.");
    need(
      canWorkOnAsset(ctx.actor, assetId, ctx.tasks),
      "Only assigned asset work is available.",
    );
    return asset;
  };
  if (command.kind === "save-templates") {
    need(manage, "Only project management can edit requirement templates.");
    need(
      new Set(command.templates.map((t) => t.id)).size ===
        command.templates.length,
      "Duplicate template IDs.",
    );
    for (const template of command.templates) {
      const index = next.templates.findIndex((t) => t.id === template.id);
      if (index < 0) {
        next.templates.push(template);
        changes.push(`Requirement template added: ${template.name}`);
      } else if (!same(next.templates[index], template)) {
        next.templates[index] = template;
        changes.push(
          `Requirement template updated: ${template.name}; existing sheets retain their requirement snapshot`,
        );
      }
    }
  } else if (command.kind === "configure-signatories") {
    need(manage, "Only project management can configure signatories.");
    need(
      new Set(command.slots.map((s) => s.id)).size === command.slots.length,
      "Duplicate signatory slots.",
    );
    for (const slot of command.slots)
      for (const userId of slot.userIds)
        need(
          ctx.users.some((u) => u.id === userId),
          "Choose a signatory who belongs to this project.",
        );
    if (!same(before.signatorySlots, command.slots)) {
      next.signatorySlots = command.slots;
      next.sheets.forEach((s) => invalidate(s, "Project signatories changed"));
      changes.push(
        "Project signatory configuration updated; previous signatures retained as invalidated",
      );
    }
  } else if (command.kind === "associate") {
    need(
      manage,
      "Only project management can associate templates with equipment.",
    );
    assetFor(command.assetId);
    const template = next.templates.find((t) => t.id === command.templateId);
    need(template, "Requirement template not found.");
    need(
      !next.sheets.some((s) => s.id === command.id),
      "Checksheet ID already exists.",
    );
    need(
      !next.sheets.some(
        (s) =>
          s.assetId === command.assetId &&
          s.templateId === template.id &&
          s.templateRevision === template.revision &&
          s.level === command.level,
      ),
      "This template revision is already associated with the equipment and level.",
    );
    next.sheets.push({
      id: command.id,
      assetId: command.assetId,
      templateId: template.id,
      templateName: template.name,
      templateRevision: template.revision,
      level: command.level,
      requirements: structuredClone(template.requirements),
      responses: [],
      signatures: [],
      createdBy: ctx.actor.id,
      createdAt: ctx.now,
    });
    changes.push(
      `Checksheet associated: ${template.name} → ${command.assetId}; answers and signatures empty`,
    );
  } else if (command.kind === "save-response" || command.kind === "sign") {
    const sheet = next.sheets.find((s) => s.id === command.sheetId);
    need(sheet, "Checksheet not found.");
    assetFor(sheet.assetId);
    if (command.kind === "save-response") {
      need(
        sheet.requirements.some((s) => s.id === command.stepId),
        "Requirement not found in this checksheet.",
      );
      need(
        !command.result || !!command.answer.trim(),
        "Record an answer before choosing a result.",
      );
      const previous = sheet.responses.find((r) => r.stepId === command.stepId);
      if (
        !previous ||
        previous.answer !== command.answer ||
        previous.result !== command.result
      ) {
        const response = {
          stepId: command.stepId,
          answer: command.answer,
          result: command.result,
          updatedBy: ctx.actor.id,
          updatedAt: ctx.now,
        };
        sheet.responses = [
          ...sheet.responses.filter((r) => r.stepId !== command.stepId),
          response,
        ];
        invalidate(sheet, "Checksheet answer changed");
        changes.push(
          `Checksheet answer saved: ${sheet.id} / ${command.stepId}`,
        );
      }
    } else {
      const slot = next.signatorySlots.find((s) => s.id === command.slotId);
      need(
        slot && signatoryApplies(slot, sheet),
        "Signatory slot is not configured for this checksheet level.",
      );
      need(
        canSignChecksheet(slot, ctx.actor),
        "You are not a configured signatory for this slot.",
      );
      const progress = checksheetProgress(sheet);
      need(
        progress.requiredAnswered === progress.requiredTotal,
        "Answer every required requirement before signing.",
      );
      need(
        !sheet.signatures.some((s) => s.slotId === slot.id && !s.invalidatedAt),
        "This slot already has a current signature.",
      );
      sheet.signatures.push({
        slotId: slot.id,
        label: slot.label,
        userId: ctx.actor.id,
        userName: ctx.actor.name,
        signedAt: ctx.now,
      });
      changes.push(
        `Checksheet signed: ${sheet.id} / ${slot.label} by ${ctx.actor.name}`,
      );
    }
  } else if (command.kind === "add-work") {
    need(
      !next.worksToGo.some((w) => w.id === command.id),
      "Works-to-go ID already exists.",
    );
    if (command.assetId) assetFor(command.assetId);
    if (command.taskId) {
      const task = ctx.tasks.find((t) => t.id === command.taskId);
      need(task, "Task not found in this project.");
      need(
        manage || task.assignedTo === ctx.actor.id,
        "Only your assigned tasks are available.",
      );
      need(
        !command.assetId || task.cx?.assetId === command.assetId,
        "Selected task does not belong to this asset.",
      );
    }
    need(
      manage || command.assetId || command.taskId,
      "Choose your assigned equipment or task.",
    );
    const { kind: _kind, ...fields } = command;
    void _kind;
    next.worksToGo.push({
      ...fields,
      status: "open",
      createdBy: ctx.actor.id,
      createdAt: ctx.now,
      updatedBy: ctx.actor.id,
      updatedAt: ctx.now,
    });
    changes.push(`Works to go added: ${command.title}`);
  } else {
    const work = next.worksToGo.find((w) => w.id === command.id);
    need(work, "Works-to-go item not found.");
    need(
      manage ||
        work.createdBy === ctx.actor.id ||
        (work.assetId && canWorkOnAsset(ctx.actor, work.assetId, ctx.tasks)) ||
        (work.taskId &&
          ctx.tasks.some(
            (t) => t.id === work.taskId && t.assignedTo === ctx.actor.id,
          )),
      "Only your assigned work is available.",
    );
    if (work.status !== command.status) {
      work.status = command.status;
      work.updatedBy = ctx.actor.id;
      work.updatedAt = ctx.now;
      changes.push(
        `Works to go ${command.status === "done" ? "completed" : "reopened"}: ${work.title}`,
      );
    }
  }
  return { state: projectChecksheetStateSchema.parse(next), changes };
}
export function worksToGoSummary(state: ProjectChecksheetState | undefined) {
  const rows = state?.worksToGo ?? [];
  return {
    open: rows.filter((w) => w.status === "open").length,
    done: rows.filter((w) => w.status === "done").length,
    total: rows.length,
  };
}
