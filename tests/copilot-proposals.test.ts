import test from "node:test";
import assert from "node:assert/strict";
import {
  signCopilotProposal,
  verifyCopilotProposal,
} from "../src/lib/copilot-proposals";
const key = "synthetic-session-key-only-for-unit-tests-0000000000000";
const subject = { userId: "manager", projectId: "project", projectVersion: 3 };
const draft = {
  taskId: "task",
  version: 8,
  changes: { title: "Clarify pump inspection" },
  reason: "Explicitly reviewed synthetic task proposal",
};
const now = 1_800_000_000_000;
test("signed task proposal binds exact fields to the user, project, session, project version and expiry", () => {
  const signed = signCopilotProposal(draft, subject, key, now);
  assert.deepEqual(
    verifyCopilotProposal(signed.token, key, subject, now + 1).draft,
    draft,
  );
  assert(!signed.token.includes(key));
  assert.throws(
    () => verifyCopilotProposal(signed.token, key + "other", subject, now),
    /signature/,
  );
  assert.throws(
    () =>
      verifyCopilotProposal(
        signed.token,
        key,
        { ...subject, userId: "other" },
        now,
      ),
    /another/,
  );
  assert.throws(
    () =>
      verifyCopilotProposal(
        signed.token,
        key,
        { ...subject, projectId: "other" },
        now,
      ),
    /another/,
  );
  assert.throws(
    () =>
      verifyCopilotProposal(
        signed.token,
        key,
        { ...subject, projectVersion: 4 },
        now,
      ),
    /changed/,
  );
  assert.throws(
    () => verifyCopilotProposal(signed.token, key, subject, now - 1),
    /expired/,
  );
  assert.throws(
    () =>
      verifyCopilotProposal(
        signed.token,
        key,
        subject,
        new Date(signed.expiresAt).getTime(),
      ),
    /expired/,
  );
});
test("tampered payloads, signature encodings and arbitrary unsigned input are rejected", () => {
  const signed = signCopilotProposal(draft, subject, key, now);
  const [body, signature] = signed.token.split(".");
  const forged = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  forged.draft.changes.title = "Unreviewed replacement";
  assert.throws(
    () =>
      verifyCopilotProposal(
        `${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${signature}`,
        key,
        subject,
        now,
      ),
    /signature/,
  );
  for (const token of [
    "",
    body,
    `${body}.${signature}.extra`,
    `${body}.a`,
    `${body}.${signature}=`,
    "a.b",
  ])
    assert.throws(() => verifyCopilotProposal(token, key, subject, now));
  assert.throws(() =>
    signCopilotProposal(
      { ...draft, changes: { status: "completed" } } as never,
      subject,
      key,
      now,
    ),
  );
});
test("valid long Unicode task descriptions can be confirmed without truncation", () => {
  const longDraft = { ...draft, changes: { description: "界".repeat(10000) } };
  const signed = signCopilotProposal(longDraft, subject, key, now);
  assert(signed.token.length > 24000);
  assert.equal(
    verifyCopilotProposal(signed.token, key, subject, now).draft.changes
      .description,
    longDraft.changes.description,
  );
});
