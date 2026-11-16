import { test } from "node:test";
import assert from "node:assert/strict";
import { configSchema } from "../src/lib/commissioning";
import {
  DEFAULT_PROJECT_VIEW,
  parseViewPreference,
  viewPreferenceKey,
} from "../src/lib/project-view-settings";
import {
  parseAssistantViewCommand,
  parseVoiceReviewCommand,
  resolveVoiceReview,
} from "../src/lib/assistant-view-commands";

test("view defaults survive configuration validation without changing commissioning values", () => {
  const parsed = configSchema.parse({
    levels: ["L1"],
    priorities: ["P1"],
    viewDefaults: {
      dashboardPanels: ["attention", "summary"],
      durationMode: "hidden",
    },
  });
  assert.deepEqual(parsed.levels, ["L1"]);
  assert.deepEqual(parsed.viewDefaults?.dashboardPanels, [
    "attention",
    "summary",
  ]);
  assert.equal(
    configSchema.safeParse({
      ...parsed,
      viewDefaults: {
        ...parsed.viewDefaults,
        dashboardPanels: ["summary", "summary"],
      },
    }).success,
    false,
  );
});
test("private browser preferences reject corruption and isolate identities and projects", () => {
  assert.equal(parseViewPreference("bad"), null);
  assert.equal(
    parseViewPreference('{"dashboardPanels":[],"durationMode":"days"}'),
    null,
  );
  assert.deepEqual(
    parseViewPreference(JSON.stringify(DEFAULT_PROJECT_VIEW)),
    DEFAULT_PROJECT_VIEW,
  );
  assert.notEqual(viewPreferenceKey("u1", "p1"), viewPreferenceKey("u1", "p2"));
  assert.notEqual(viewPreferenceKey("u1", "p1"), viewPreferenceKey("u2", "p1"));
});
test("known view intents separate viewport, reports, data mutations and quoted commands", () => {
  assert.deepEqual(parseAssistantViewCommand("Show months")?.commands, [
    { type: "scale", scale: "month" },
  ]);
  assert.equal(
    parseAssistantViewCommand("Show monthly view.")?.commands[0].type,
    "scale",
  );
  assert.equal(
    parseAssistantViewCommand("Show the schedule for next two weeks")
      ?.commands[1].type,
    "horizon",
  );
  assert.equal(
    parseAssistantViewCommand("Show me the next two weeks look ahead."),
    null,
  );
  assert.equal(
    parseAssistantViewCommand("Show critical path")?.commands[0].type,
    "critical",
  );
  assert.equal(parseAssistantViewCommand("Hide dates")?.commands.length, 2);
  for (const text of [
    'Say "show progress"',
    "Show progress and change row 5",
    "Delete activities",
    "Show dates after Friday",
    "Do not show progress",
  ])
    assert.equal(parseAssistantViewCommand(text), null);
});
test("voice review only accepts explicit standalone review phrases", () => {
  assert.equal(parseVoiceReviewCommand("Send question."), "send");
  assert.equal(parseVoiceReviewCommand("edit question"), "edit");
  for (const text of [
    "send",
    "send this",
    "please send question",
    "do not send question",
    'say "send question"',
    "we will send question tomorrow",
  ])
    assert.equal(parseVoiceReviewCommand(text), null);
});

test("voice Send cannot send a changed or empty draft; Edit and quoted dictation remain separate", () => {
  assert.equal(
    resolveVoiceReview("Send question", "Show months", "Show months"),
    "send",
  );
  assert.equal(
    resolveVoiceReview("Send question", "Show months", "Change task 4"),
    "draft-changed",
  );
  assert.equal(resolveVoiceReview("Send question", "", ""), "draft-changed");
  assert.equal(
    resolveVoiceReview(
      "The task title is send question",
      "Show months",
      "Show months",
    ),
    "unknown",
  );
  assert.equal(
    resolveVoiceReview("Edit question", "Show months", "Show months"),
    "edit",
  );
});
