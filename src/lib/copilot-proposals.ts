import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { copilotDraftSchema, type CopilotTaskProposalDraft } from "./copilot";
const TTL = 10 * 60 * 1000;
const proofSchema = z
  .object({
    purpose: z.literal("fieldtrack-task-preview-v1"),
    userId: z.string().min(1).max(150),
    projectId: z.string().min(1).max(150),
    projectVersion: z.number().int().min(0),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().nonnegative(),
    draft: copilotDraftSchema,
  })
  .strict();
export type CopilotProposalProof = z.infer<typeof proofSchema>;
const signature = (body: string, sessionKey: string) =>
  createHmac("sha256", sessionKey)
    .update(`fieldtrack-copilot-confirm-v1:${body}`)
    .digest();
/** The caller supplies only the authenticated HTTP-only session token; never send that key to a model. */
export function signCopilotProposal(
  draft: CopilotTaskProposalDraft,
  subject: { userId: string; projectId: string; projectVersion: number },
  sessionKey: string,
  now = Date.now(),
) {
  if (!sessionKey || sessionKey.length < 32)
    throw new Error("A valid session is required to prepare a proposal.");
  const payload = proofSchema.parse({
    purpose: "fieldtrack-task-preview-v1",
    ...subject,
    issuedAt: now,
    expiresAt: now + TTL,
    draft,
  });
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    token: `${body}.${signature(body, sessionKey).toString("base64url")}`,
    expiresAt: new Date(payload.expiresAt).toISOString(),
  };
}
export function verifyCopilotProposal(
  token: string,
  sessionKey: string,
  subject: { userId: string; projectId: string; projectVersion: number },
  now = Date.now(),
): CopilotProposalProof {
  if (!sessionKey || sessionKey.length < 32 || token.length > 64000)
    throw new Error("Invalid proposal confirmation.");
  const parts = token.split(".");
  if (
    parts.length !== 2 ||
    !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))
  )
    throw new Error("Invalid proposal confirmation.");
  const supplied = Buffer.from(parts[1], "base64url"),
    expected = signature(parts[0], sessionKey);
  if (
    supplied.length !== expected.length ||
    supplied.toString("base64url") !== parts[1] ||
    !timingSafeEqual(supplied, expected)
  )
    throw new Error("Invalid proposal signature. Preview the change again.");
  let proof: CopilotProposalProof;
  try {
    proof = proofSchema.parse(
      JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")),
    );
  } catch {
    throw new Error("Invalid proposal confirmation.");
  }
  if (proof.userId !== subject.userId || proof.projectId !== subject.projectId)
    throw new Error("This proposal belongs to another project or user.");
  if (proof.projectVersion !== subject.projectVersion)
    throw new Error("Project changed. Preview the task change again.");
  if (
    proof.issuedAt > now ||
    proof.expiresAt <= now ||
    proof.expiresAt - proof.issuedAt !== TTL
  )
    throw new Error("Proposal expired. Preview the change again.");
  return proof;
}
