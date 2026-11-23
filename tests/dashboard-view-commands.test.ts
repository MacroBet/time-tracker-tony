import test from "node:test";
import assert from "node:assert/strict";
import { parseDashboardViewCommand } from "../src/lib/dashboard-view-commands";
import {
  dashboardViewCommandEvent,
  dashboardViewCommandResultEvent,
  dashboardViewCommandSchema,
  dashboardViewRequestSchema,
  resolveDashboardViewCommand,
} from "../src/lib/dashboard-view-context";
import { applyDashboardView } from "../src/app/components/dashboard-view-dispatch";

test("the requested Dashboard display phrases resolve to one saved-data view", () => {
  const phrases = [
    ["show me critical path", { kind: "progress", comparison: "critical" }],
    ["show me critival path", { kind: "progress", comparison: "critical" }],
    [
      "show the saved P6 critical path",
      { kind: "progress", comparison: "critical" },
    ],
    ["show me 2 week look ahead", { kind: "lookahead", weeks: 2 }],
    ["open the four-week lookahead report", { kind: "lookahead", weeks: 4 }],
    ["show me the next six weeks", { kind: "lookahead", weeks: 6 }],
    ["show look ahead for the next 2 weeks", { kind: "lookahead", weeks: 2 }],
    ["show me tag report", { kind: "report", report: "tags" }],
    ["open tags report", { kind: "report", report: "tags" }],
    ["show test step progress", { kind: "report", report: "tagging" }],
    ["review the import", { kind: "readiness" }],
    ["check project import", { kind: "readiness" }],
    ["show me missing report criteria", { kind: "readiness" }],
    ["show dashboard", { kind: "overview" }],
    ["show original vs current", { kind: "progress", comparison: "current" }],
    [
      "show original versus current curves",
      { kind: "progress", comparison: "current" },
    ],
    ["show me overall progress", { kind: "progress", comparison: "overall" }],
  ] as const;
  for (const [phrase, view] of phrases)
    assert.deepEqual(parseDashboardViewCommand(phrase)?.view, view, phrase);
});

test("supplier display commands preserve the exact supplied name without inferring a vendor", () => {
  assert.deepEqual(
    parseDashboardViewCommand("show me vendor Schneider Electric progress")
      ?.view,
    { kind: "vendor-progress", vendor: "Schneider Electric" },
  );
  assert.deepEqual(
    parseDashboardViewCommand("open supplier O'Reilly (UK) progress")?.view,
    { kind: "vendor-progress", vendor: "O'Reilly (UK)" },
  );
  assert.deepEqual(
    parseDashboardViewCommand("show me vendor Acme  Europe progress")?.view,
    { kind: "vendor-progress", vendor: "Acme  Europe" },
  );
  for (const message of [
    "show me vendor progress",
    "show vendor X and Y progress",
    "show vendor X then delete tasks progress",
    "show vendor X progress and email Tony",
  ])
    assert.equal(parseDashboardViewCommand(message), null, message);
});

test("questions, quoted examples, compound filters and mutations are never guessed as display commands", () => {
  for (const message of [
    "what is the critical path?",
    "show critical path?",
    'say "show me critical path"',
    "do not show tag report",
    "show tag report and delete tasks",
    "review the import and fix missing suppliers",
    "show critical path to Phase 1",
    "show the 3 week lookahead",
    "show next two weeks for vendor X",
    "show tag report; approve all tags",
    "show dashboard\nremove all assets",
    "hide the critical path",
    "import the project",
  ])
    assert.equal(parseDashboardViewCommand(message), null, message);
});

test("Dashboard commands reject forged payloads and stale or different project revisions", () => {
  const input = {
    projectId: "p1",
    projectVersion: 3,
    requestId: crypto.randomUUID(),
    view: { kind: "report", report: "tags" },
  };
  assert.deepEqual(
    resolveDashboardViewCommand(input, { projectId: "p1", projectVersion: 3 }),
    input.view,
  );
  for (const subject of [
    { projectId: "p2", projectVersion: 3 },
    { projectId: "p1", projectVersion: 4 },
  ])
    assert.throws(() => resolveDashboardViewCommand(input, subject), /changed/);
  assert.equal(
    dashboardViewCommandSchema.safeParse({ ...input, requestId: "forged" })
      .success,
    false,
  );
  assert.equal(
    dashboardViewRequestSchema.safeParse({
      kind: "vendor-progress",
      vendor: "",
    }).success,
    false,
  );
  assert.equal(
    dashboardViewRequestSchema.safeParse({
      kind: "report",
      report: "tags",
      approveAll: true,
    }).success,
    false,
  );
});

test("the dispatcher accepts only acknowledgements from the requested live project revision", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const events = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    value: events,
    configurable: true,
  });
  const intent = parseDashboardViewCommand("show me tag report")!;
  let view: unknown;
  events.addEventListener(dashboardViewCommandEvent, (event) => {
    const detail = (event as CustomEvent).detail;
    view = resolveDashboardViewCommand(detail, {
      projectId: "p1",
      projectVersion: 3,
    });
    for (const wrongScope of [
      { projectId: "p2", projectVersion: 3 },
      { projectId: "p1", projectVersion: 2 },
    ])
      events.dispatchEvent(
        new CustomEvent(dashboardViewCommandResultEvent, {
          detail: {
            ...wrongScope,
            requestId: detail.requestId,
            ok: false,
            error: "Wrong scope must be ignored",
          },
        }),
      );
    events.dispatchEvent(
      new CustomEvent(dashboardViewCommandResultEvent, {
        detail: {
          requestId: detail.requestId,
          projectId: "p1",
          projectVersion: 3,
          ok: true,
        },
      }),
    );
  });
  try {
    const reply = await applyDashboardView(
      intent,
      "p1",
      3,
      new AbortController().signal,
    );
    assert.deepEqual(view, { kind: "report", report: "tags" });
    assert.equal(reply.mode, "view");
    assert.match(reply.text, /no AI generation/);
    assert.match(reply.text, /unchanged/);
    assert.deepEqual(reply.proposals, []);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("aborted, refused or unmounted views cannot be reported as applied", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const events = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    value: events,
    configurable: true,
  });
  const intent = parseDashboardViewCommand("show me critical path")!;
  let dispatched = 0;
  const refused = (event: Event) => {
    dispatched++;
    const detail = (event as CustomEvent).detail;
    events.dispatchEvent(
      new CustomEvent(dashboardViewCommandResultEvent, {
        detail: {
          requestId: detail.requestId,
          projectId: "p1",
          projectVersion: 3,
          ok: false,
          error: "No saved critical activities are available.",
        },
      }),
    );
  };
  events.addEventListener(dashboardViewCommandEvent, refused);
  try {
    const aborted = new AbortController();
    aborted.abort();
    await assert.rejects(applyDashboardView(intent, "p1", 3, aborted.signal), {
      name: "AbortError",
    });
    assert.equal(dispatched, 0);
    await assert.rejects(
      applyDashboardView(intent, "p1", 3, new AbortController().signal),
      /No saved critical activities/,
    );
    assert.equal(dispatched, 1);
    events.removeEventListener(dashboardViewCommandEvent, refused);
    await assert.rejects(
      applyDashboardView(intent, "p1", 3, new AbortController().signal),
      /Dashboard is not ready/,
    );
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
