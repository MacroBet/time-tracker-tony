import { z } from "zod";
import { cxSchema, PRIORITIES } from "./commissioning";
const id = z.string().min(1).max(100);
const note = z.string().trim().max(5000);
const dueDate = z.iso.date().optional();
export const createTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(3).max(5000),
    projectId: id,
    assignedTo: id,
    priority: z.enum(PRIORITIES).default("P2"),
    cx: cxSchema.optional(),
    discipline: z.string().trim().min(1).max(100),
    location: z.string().trim().max(200).default(""),
    dueDate,
  })
  .strict();
export const updateTaskSchema = z
  .object({
    version: z.number().int().positive(),
    status: z
      .enum([
        "pending",
        "in-progress",
        "blocked",
        "review",
        "completed",
        "not-applicable",
      ])
      .optional(),
    notes: note.optional(),
    result: z.enum(["untested", "passed", "failed", "retest"]).optional(),
    progress: z.number().min(0).max(100).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.status !== undefined ||
      v.notes !== undefined ||
      v.result !== undefined ||
      v.progress !== undefined,
    "Provide an update.",
  );
export const createShiftSchema = z.object({ projectId: id }).strict();
export const updateShiftSchema = z
  .object({
    version: z.number().int().positive(),
    action: z.enum(["end", "submit", "approve", "reject"]),
    manualHours: z.number().finite().min(0).max(12).optional(),
    notes: note.optional(),
    rejectionReason: z.string().trim().min(3).max(1000).optional(),
  })
  .strict();
export const feedbackSchema = z
  .object({
    projectId: id,
    description: z.string().trim().min(10).max(5000),
    page: z.string().startsWith("/").max(500),
    screenshot: z.string().max(1500000).optional(),
  })
  .strict();
export const loginSchema = z.union([
  z.object({ userId: id }).strict(),
  z
    .object({
      email: z
        .email()
        .max(254)
        .transform((v) => v.toLowerCase()),
      password: z.string().min(1).max(256),
    })
    .strict(),
]);

export const assignmentSchema = z
  .object({
    tasks: z
      .array(z.object({ id, version: z.number().int().positive() }).strict())
      .min(1)
      .max(50),
    assignedTo: id.nullable(),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict()
  .refine(
    (v) => new Set(v.tasks.map((t) => t.id)).size === v.tasks.length,
    "Duplicate activity selection",
  );
export const taskPlanSchema = z
  .object({
    version: z.number().int().positive(),
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(10000),
    priority: z.enum(PRIORITIES).nullable(),
    cx: cxSchema.optional(),
    dueDate: z.iso.date().nullable(),
    discipline: z.string().trim().min(1).max(200),
    location: z.string().trim().max(500),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
