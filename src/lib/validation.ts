import { z } from "zod";
const id = z.string().min(1).max(100);
const note = z.string().trim().max(5000);
const dueDate = z.iso.date().optional();
export const createTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(3).max(5000),
    projectId: id,
    assignedTo: id,
    priority: z.enum(["P1", "P2", "P3"]).default("P2"),
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
        "completed",
        "not-applicable",
      ])
      .optional(),
    notes: note.optional(),
  })
  .strict()
  .refine(
    (v) => v.status !== undefined || v.notes !== undefined,
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
