import test from "node:test";
import assert from "node:assert/strict";
import {
  assistantIntentScope,
  initialAssistantIntent,
  reduceAssistantIntent,
} from "../src/lib/assistant-intent";
const voice = { projectId: "A", input: "voice" as const, sourceView: true };
test("A voice gesture is consumed when leaving a project, so A to B to A stays closed until a new gesture", () => {
  let state = initialAssistantIntent("A");
  state = reduceAssistantIntent(state, {
    type: "open",
    scope: "A",
    request: voice,
  });
  assert.equal(state.request?.input, "voice");
  state = reduceAssistantIntent(state, { type: "scope", scope: "B" });
  state = reduceAssistantIntent(state, { type: "scope", scope: "A" });
  assert.equal(state.request, null);
  state = reduceAssistantIntent(state, {
    type: "open",
    scope: "A",
    request: { ...voice, input: "text" },
  });
  assert.equal(state.request?.input, "text");
  assert.equal(state.sequence, 2);
});
test("stale events cannot reopen a replaced identity/access scope and closing never replays an intent", () => {
  let state = initialAssistantIntent("A");
  state = reduceAssistantIntent(state, {
    type: "scope",
    scope: "changed-user",
  });
  assert.equal(
    reduceAssistantIntent(state, { type: "open", scope: "A", request: voice }),
    state,
  );
  state = reduceAssistantIntent(state, {
    type: "open",
    scope: "changed-user",
    request: voice,
  });
  state = reduceAssistantIntent(state, { type: "close" });
  assert.equal(state.request, null);
  assert.equal(state.sequence, 1);
});
test("project, user, role, module and membership changes each invalidate gesture scope; array order alone does not", () => {
  const user = {
      id: "u",
      role: "manager",
      modules: ["tasks", "commissioning"],
    },
    a = assistantIntentScope(user, "A", ["A", "B"]);
  assert.equal(
    assistantIntentScope(
      { ...user, modules: ["commissioning", "tasks"] },
      "A",
      ["B", "A"],
    ),
    a,
  );
  for (const changed of [
    assistantIntentScope(user, "B", ["A", "B"]),
    assistantIntentScope({ ...user, id: "other" }, "A", ["A", "B"]),
    assistantIntentScope({ ...user, role: "worker" }, "A", ["A", "B"]),
    assistantIntentScope({ ...user, modules: ["tasks"] }, "A", ["A", "B"]),
    assistantIntentScope(user, "A", ["A"]),
  ])
    assert.notEqual(changed, a);
});
