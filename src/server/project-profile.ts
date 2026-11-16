import { createHash } from "node:crypto";
import { z } from "zod";
import type { Project, User } from "@/lib/domain";
import type { ProjectAuditEvent } from "@/lib/project-audit";

export const createProjectInput = z
  .object({
    name: z.string().trim().min(3).max(150),
    location: z.string().trim().min(2).max(200),
    companyId: z.string().min(1),
    // Older clients remain compatible; the new form retains this key across retries.
    requestId: z.uuid().optional(),
  })
  .strict();
export const renameProjectInput = z
  .object({
    name: z.string().trim().min(3).max(150),
    expectedName: z.string().min(1).max(150),
    reason: z.string().trim().min(10).max(1000),
    requestId: z.uuid(),
    preview: z.boolean().default(false),
  })
  .strict();

/** The same actor/request pair addresses one project, including after a lost response. */
export function projectIdForRequest(actorId: string, requestId: string) {
  const bytes = createHash("sha256")
    .update(JSON.stringify(["fieldtrack-project", actorId, requestId]))
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function projectCreationEvent(
  project: Project,
  actor: User,
  requestId: string,
  at = new Date().toISOString(),
): ProjectAuditEvent {
  return {
    id: `project:create:${actor.id}:${requestId}`,
    at,
    actor: actor.name,
    action: "edit",
    label: "Project created",
    object: project.name,
    detail: `FieldTrack name: ${project.name}\nLocation: ${project.location}\nCompany: ${project.companyId}`,
  };
}

export function projectRenameEvent(
  project: Project,
  actor: User,
  input: z.infer<typeof renameProjectInput>,
  at = new Date().toISOString(),
): ProjectAuditEvent {
  return {
    id: `project:rename:${actor.id}:${input.requestId}`,
    at,
    actor: actor.name,
    action: "edit",
    label: "FieldTrack project renamed",
    object: input.name,
    detail: `FieldTrack name: ${input.expectedName} → ${input.name}\nProject ID: ${project.id}\nReason: ${input.reason}`,
  };
}

export function sameProfileRequest(
  audit: ProjectAuditEvent[],
  event: ProjectAuditEvent,
) {
  return audit.some(
    (row) => row.id === event.id && row.detail === event.detail,
  );
}
