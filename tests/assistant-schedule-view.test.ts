import test from "node:test";
import assert from "node:assert/strict";
import { parseAssistantViewCommand } from "../src/lib/assistant-view-commands";
import { configSchema } from "../src/lib/commissioning";
import {
  DEFAULT_PROJECT_VIEW,
  parseViewPreference,
  resolveProjectViewDefaults,
  serializeViewPreference,
  viewPreferenceKey,
} from "../src/lib/project-view-settings";
import {
  assertScheduleViewCommands,
  reduceSourceGanttView,
  sourceGanttInitialView,
} from "../src/lib/source-gantt";
import {
  scheduleViewSnapshotSchema,
  resolveScheduleViewCommand,
  resolveScheduleViewRow,
} from "../src/lib/schedule-view-context";
import {
  sourceProgrammeSchema,
  indexSourceProgramme,
} from "../src/lib/programme-source";
import { applyAssistantView } from "../src/app/components/assistant-view-dispatch";

test("the three requested phrases change the current display while report requests remain reports", () => {
  assert.deepEqual(
    parseAssistantViewCommand("show schedule in months")?.commands,
    [{ type: "scale", scale: "month" }],
  );
  assert.deepEqual(parseAssistantViewCommand("show task progress")?.commands, [
    { type: "column", column: "progress", visible: true },
  ]);
  assert.deepEqual(
    parseAssistantViewCommand("show 2 week look ahead")?.commands,
    [{ type: "today" }, { type: "horizon", horizon: 14 }],
  );
  assert.deepEqual(
    parseAssistantViewCommand("hide progress, start and finish columns")
      ?.commands,
    [
      { type: "column", column: "progress", visible: false },
      { type: "column", column: "start", visible: false },
      { type: "column", column: "finish", visible: false },
    ],
  );
  for (const message of [
    "show a 2 week lookahead report",
    "show me the next two weeks look ahead",
    'say "show schedule in months"',
    "do not show task progress",
    "show progress and delete row 4",
  ])
    assert.equal(parseAssistantViewCommand(message), null);
});

test("legacy and new defaults keep calendar scale separate from duration and reset/open Today", () => {
  const legacy = resolveProjectViewDefaults({
    dashboardPanels: ["summary"],
    durationMode: "hours",
  });
  assert.equal(legacy.calendarScale, "day");
  const defaults = configSchema.parse({
    levels: ["L1"],
    priorities: ["P1"],
    viewDefaults: {
      ...DEFAULT_PROJECT_VIEW,
      calendarScale: "month",
      durationMode: "hidden",
    },
  }).viewDefaults!;
  assert.equal(defaults.calendarScale, "month");
  assert.equal(defaults.durationMode, "hidden");
  const starting = {
    scale: defaults.calendarScale,
    durationMode: defaults.durationMode,
  };
  const open = sourceGanttInitialView("2026-11-16", starting);
  const override = reduceSourceGanttView(
    open,
    { type: "scale", scale: "week" },
    open.anchor,
    starting,
  );
  assert.equal(override.durationMode, "hidden");
  assert.equal(
    reduceSourceGanttView(override, { type: "reset" }, "2026-11-17", starting)
      .scale,
    "month",
  );
  assert.equal(
    reduceSourceGanttView(override, { type: "reset" }, "2026-11-17", starting)
      .anchor,
    "2026-11-17",
  );
  assert.equal(
    sourceGanttInitialView("2026-11-16", { scale: "day" }).scale,
    "day",
  );
});

test("legacy personal preferences inherit only the new calendar field until explicitly selected, scoped by account/project", () => {
  const legacy = JSON.stringify({
    dashboardPanels: ["reports", "summary"],
    durationMode: "hours",
  });
  const month = { ...DEFAULT_PROJECT_VIEW, calendarScale: "month" as const };
  const week = { ...month, calendarScale: "week" as const };
  const first = parseViewPreference(legacy, month)!;
  assert.equal(first.calendarScale, "month");
  assert.equal(first.durationMode, "hours");
  assert.deepEqual(first.dashboardPanels, ["reports", "summary"]);
  const otherEdit = serializeViewPreference(
    { ...first, durationMode: "hidden" },
    legacy,
  );
  assert.equal(Object.hasOwn(JSON.parse(otherEdit), "calendarScale"), false);
  assert.equal(parseViewPreference(otherEdit, week)?.calendarScale, "week");
  const explicit = serializeViewPreference(
    { ...first, calendarScale: "day" },
    legacy,
    "calendarScale",
  );
  assert.equal(parseViewPreference(explicit, week)?.calendarScale, "day");
  const laterEdit = serializeViewPreference(
    { ...parseViewPreference(explicit, week)!, durationMode: "days" },
    explicit,
  );
  assert.equal(parseViewPreference(laterEdit, month)?.calendarScale, "day");
  const storage = new Map([
    [viewPreferenceKey("u1", "p1"), otherEdit],
    [viewPreferenceKey("u2", "p1"), explicit],
  ]);
  assert.equal(
    parseViewPreference(storage.get(viewPreferenceKey("u1", "p1"))!, month)
      ?.calendarScale,
    "month",
  );
  assert.equal(
    parseViewPreference(storage.get(viewPreferenceKey("u2", "p1"))!, month)
      ?.calendarScale,
    "day",
  );
  assert.equal(
    parseViewPreference(
      storage.get(viewPreferenceKey("u1", "p2")) ?? null,
      month,
    ),
    null,
  );
});

test("managed display identity cannot masquerade as a P6 import or resolve a filtered row number", () => {
  const snapshot = scheduleViewSnapshotSchema.parse({
    projectId: "p1",
    sourceSha256: "managed",
    projectVersion: 2,
    mode: "working",
    page: 0,
    query: { q: "Pump" },
    display: sourceGanttInitialView("2026-11-16"),
  });
  assert.deepEqual(
    resolveScheduleViewCommand(
      {
        projectId: snapshot.projectId,
        sourceSha256: snapshot.sourceSha256,
        projectVersion: snapshot.projectVersion,
        command: { type: "show" },
      },
      { projectId: "p1", sourceSha256: "managed", projectVersion: 2 },
    ),
    { type: "show" },
  );
  const source = sourceProgrammeSchema.parse({
    format: "p6-xer-v1",
    source: {
      fileName: "synthetic.xer",
      sha256: "a".repeat(64),
      encoding: "utf-8",
      header: "Synthetic",
    },
    tables: {
      TASK: {
        fields: ["task_id", "task_code", "task_name"],
        rows: [["t1", "ACT-1", "Pump"]],
        lines: [1],
      },
    },
  });
  assert.equal(
    sourceProgrammeSchema.safeParse({
      ...source,
      source: { ...source.source, sha256: "managed" },
    }).success,
    false,
  );
  assert.throws(
    () =>
      resolveScheduleViewRow(
        indexSourceProgramme(source),
        snapshot,
        { projectId: "p1", projectVersion: 2 },
        1,
      ),
    /Use the stable Activity ID/,
  );
});

test("managed capabilities preflight the complete intent before changing any display state", () => {
  const initial = sourceGanttInitialView("2026-11-16");
  const before = JSON.stringify(initial);
  const commands = [
    { type: "column", column: "progress", visible: false },
    { type: "column", column: "wbs", visible: true },
  ] as const;
  assert.throws(
    () => assertScheduleViewCommands(commands, "managed"),
    /WBS column is unavailable/,
  );
  assert.equal(JSON.stringify(initial), before);
  assert.throws(
    () =>
      assertScheduleViewCommands(
        [{ type: "critical", filter: "yes" }],
        "managed",
      ),
    /P6 criticality is unavailable/,
  );
  assert.throws(
    () =>
      assertScheduleViewCommands(
        [{ type: "duration", mode: "hours" }],
        "managed",
      ),
    /without saved source hours/,
  );
  assert.doesNotThrow(() =>
    assertScheduleViewCommands(
      parseAssistantViewCommand("show 2 week look ahead")!.commands,
      "managed",
    ),
  );
});

test("the dispatcher changes only acknowledged live views, and a mixed unsupported managed intent dispatches nothing", async () => {
  const previous = globalThis.window;
  const events = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    value: events,
    configurable: true,
    writable: true,
  });
  const snapshot = scheduleViewSnapshotSchema.parse({
    projectId: "p1",
    sourceSha256: "managed",
    projectVersion: 2,
    mode: "working",
    page: 0,
    query: { q: "Pump" },
    display: sourceGanttInitialView("2026-11-16"),
  });
  let display = snapshot.display!,
    dispatched = 0;
  const captured = JSON.stringify(snapshot);
  events.addEventListener("fieldtrack:schedule-view-command", (event) => {
    const detail = (event as CustomEvent).detail;
    const command = resolveScheduleViewCommand(detail, {
      projectId: "p1",
      sourceSha256: "managed",
      projectVersion: 2,
    });
    display = reduceSourceGanttView(display, command, "2026-11-16");
    dispatched++;
    events.dispatchEvent(
      new CustomEvent("fieldtrack:schedule-view-command-result", {
        detail: { requestId: detail.requestId, projectId: "p1", ok: true },
      }),
    );
  });
  try {
    for (const phrase of [
      "show schedule in months",
      "show task progress",
      "show 2 week look ahead",
    ])
      await applyAssistantView(
        parseAssistantViewCommand(phrase)!,
        snapshot,
        "p1",
        2,
        new AbortController().signal,
      );
    assert.equal(display.scale, "month");
    assert.equal(display.horizon, 14);
    assert.equal(display.columns.includes("progress"), true);
    assert.equal(JSON.stringify(snapshot), captured);
    const accepted = dispatched;
    await assert.rejects(
      () =>
        applyAssistantView(
          {
            commands: [
              { type: "column", column: "progress", visible: false },
              { type: "column", column: "wbs", visible: true },
            ],
            description: "mixed",
          },
          snapshot,
          "p1",
          2,
          new AbortController().signal,
        ),
      /WBS column is unavailable/,
    );
    assert.equal(dispatched, accepted);
    await assert.rejects(
      () =>
        applyAssistantView(
          parseAssistantViewCommand("show task progress")!,
          snapshot,
          "p1",
          3,
          new AbortController().signal,
        ),
      /out of date/,
    );
    assert.equal(dispatched, accepted);
  } finally {
    Object.defineProperty(globalThis, "window", {
      value: previous,
      configurable: true,
      writable: true,
    });
  }
});
