import type { AppData, Project, Task } from "./domain";
import type {
  Asset,
  Commissioning,
  Level,
  ScheduleActivity,
  TagReview,
} from "./commissioning";
import { addWorkdays, nextWorkday, recalculateSchedule } from "./scheduling";

/** Opt-in LOCAL fixture. No Tony files, external data, uploads or remote writes. */
export const DEMO_RICH_PROJECT = "p-demo-rich";
export const DEMO_EMPTY_PROJECT = "p-demo-empty";
const SYNTHETIC =
  "SYNTHETIC local demonstration; no client data or external connection.";
const LEVELS: Level[] = ["L2A", "L2B", "L3", "L4"];
const phaseNames = [
  "Delivery inspection",
  "Installation checks",
  "Pre-functional test",
  "Functional verification",
];
const equipment = [
  ["SWB", "Switchboard", "Electrical"],
  ["UPS", "UPS", "Electrical"],
  ["CRAH", "CRAH", "Mechanical"],
  ["PMP", "Pump", "Mechanical"],
  ["BMS", "Controls panel", "Controls"],
  ["AHU", "Air handling unit", "Mechanical"],
] as const;
const areas = [
  { id: "A", phase: "Phase 1", floor: "Ground floor", area: "Energy centre" },
  { id: "B", phase: "Phase 1", floor: "Level 1", area: "Data hall A" },
  { id: "C", phase: "Phase 2", floor: "Level 1", area: "Data hall B" },
  { id: "D", phase: "Phase 2", floor: "Roof", area: "Roof plant" },
];
const scenarios: {
  status: Task["status"];
  result: "untested" | "passed" | "failed" | "retest";
  progress: number;
  review?: TagReview;
}[] = [
  { status: "completed", result: "passed", progress: 100, review: "approved" },
  {
    status: "review",
    result: "passed",
    progress: 100,
    review: "approved-comments",
  },
  { status: "review", result: "passed", progress: 100, review: "issued" },
  { status: "blocked", result: "failed", progress: 65, review: "rejected" },
  { status: "in-progress", result: "retest", progress: 55 },
  { status: "pending", result: "untested", progress: 0 },
  { status: "in-progress", result: "passed", progress: 90, review: "issued" },
  { status: "completed", result: "passed", progress: 100, review: "approved" },
  { status: "not-applicable", result: "untested", progress: 0 },
  {
    status: "review",
    result: "passed",
    progress: 100,
    review: "approved-comments",
  },
];

/** Reapplying replaces only these two fixtures. Original projects and records are preserved. */
export function withDemoShowcase(data: AppData, now: Date): AppData {
  const today = now.toISOString().slice(0, 10);
  const ago = (days: number) =>
    new Date(now.getTime() - days * 86_400_000).toISOString();
  const anchor = nextWorkday(ago(21).slice(0, 10));
  const config: Commissioning["config"] = {
    levels: [...LEVELS],
    priorities: ["P1", "P2", "P3", "P4", "P5"],
    projectType: "SYNTHETIC · Local commissioning demonstration",
    location: "Northbank demonstration campus (fictional)",
    capacityMw: 24,
    phasePresentation: {
      L2A: { label: "Delivery inspection", color: "#0369a1" },
      L2B: { label: "Installation", color: "#7c3aed" },
      L3: { label: "Pre-functional test", color: "#b45309" },
      L4: { label: "Functional test", color: "#047857" },
    },
  };
  const assets: Asset[] = [];
  const proposed: ScheduleActivity[] = [];
  for (const [areaIndex, area] of areas.entries()) {
    const parent = `DEMO-NB-AREA-${area.id}`;
    const location = `${area.floor} · ${area.area}`;
    const readinessId = `${parent}-READY`;
    assets.push({
      id: parent,
      name: `${area.area} system group`,
      equipmentType: "System group",
      location,
      phase: area.phase,
      floor: area.floor,
      area: area.area,
      levels: [],
      clientSupplied: null,
      discipline: "Multidiscipline",
      owner: "DEMO main contractor",
    });
    proposed.push({
      activityId: readinessId,
      name: `${area.area} access and installation readiness`,
      notBefore: addWorkdays(anchor, areaIndex * 3),
      durationDays: 1,
      source: SYNTHETIC,
    });
    for (const [
      equipmentIndex,
      [code, equipmentType, discipline],
    ] of equipment.entries()) {
      const id = `DEMO-NB-${area.id}-${code}-01`;
      const requested = addWorkdays(anchor, areaIndex * 3 + equipmentIndex * 2);
      const levelActivities = Object.fromEntries(
        LEVELS.map((level) => [level, `${id}-${level}`]),
      );
      assets.push({
        id,
        clientAssetId: `DEMO-CLIENT-${area.id}-${code}-01`,
        programmeActivityId: levelActivities.L2A,
        name: `${equipmentType} ${area.id}01`,
        equipmentType,
        discipline,
        location,
        phase: area.phase,
        floor: area.floor,
        area: area.area,
        parentAssetId: parent,
        levels: [...LEVELS],
        clientSupplied:
          equipmentIndex % 3 === 0
            ? true
            : equipmentIndex % 3 === 1
              ? false
              : null,
        serialNumber: `SYNTH-${area.id}-${code}-0001`,
        owner:
          equipmentIndex % 3 === 0
            ? "DEMO client team"
            : "DEMO installation team",
        deliveryActivityId: levelActivities.L2A,
        expectedDelivery: requested,
        levelActivities,
      });
      for (const [levelIndex, level] of LEVELS.entries())
        proposed.push({
          activityId: levelActivities[level]!,
          name: `${equipmentType} ${area.id}01 · ${phaseNames[levelIndex]}`,
          notBefore: requested,
          durationDays: [1, 2, 2, 1][levelIndex],
          predecessors: [
            {
              activityId:
                levelIndex === 0
                  ? readinessId
                  : levelActivities[LEVELS[levelIndex - 1]]!,
              lagDays: 0,
            },
          ],
          source: SYNTHETIC,
        });
    }
  }
  const first = recalculateSchedule(proposed);
  if (first.errors.length)
    throw new Error(`Invalid synthetic programme: ${first.errors.join(" ")}`);
  // Two explicit forecast changes show preserved baselines without invented P6 imports.
  const revised = first.schedule.map((row) =>
    ["DEMO-NB-A-UPS-01-L2A", "DEMO-NB-B-CRAH-01-L2A"].includes(row.activityId)
      ? { ...row, notBefore: addWorkdays(row.notBefore!, 2) }
      : row,
  );
  const calculated = recalculateSchedule(revised);
  if (calculated.errors.length)
    throw new Error(
      `Invalid synthetic forecast: ${calculated.errors.join(" ")}`,
    );
  const programme = calculated.schedule;
  const schedule = new Map(programme.map((row) => [row.activityId, row]));
  const assignees = ["u1", "u2", "u6"];
  const companyFor = (userId: string) =>
    data.users.find((user) => user.id === userId)!.companyId;
  const tasks: Task[] = [];
  const baseTask = (
    id: string,
    asset: Asset,
    assignedTo: string | undefined,
  ): Task => ({
    id,
    title: "",
    description: SYNTHETIC,
    projectId: DEMO_RICH_PROJECT,
    companyId: assignedTo ? companyFor(assignedTo) : "c1",
    assignedTo,
    createdBy: "u3",
    status: "pending",
    priority: "P3",
    discipline: asset.discipline ?? "Commissioning",
    location: asset.location,
    source: "manual",
    createdAt: ago(18),
    updatedAt: ago(1),
    version: 1,
  });
  const leaves = assets.filter((asset) => asset.parentAssetId);
  for (const [assetIndex, asset] of leaves.entries()) {
    for (const [levelIndex, level] of LEVELS.entries()) {
      const row = schedule.get(asset.levelActivities![level]!)!;
      const scenario =
        row.start! > today
          ? scenarios[5]
          : row.finish! >= today
            ? scenarios[4]
            : scenarios[(assetIndex * 4 + levelIndex) % scenarios.length];
      const task = baseTask(
        `demo-nb-tag-${asset.id}-${level}`,
        asset,
        (assetIndex + levelIndex) % 11 === 0
          ? undefined
          : assignees[assetIndex % 3],
      );
      Object.assign(task, {
        title: `${asset.id} · ${level} test record`,
        status: scenario.status,
        priority: scenario.status === "blocked" ? "P1" : "P3",
        notes: `${SYNTHETIC} ${scenario.review === "approved-comments" ? "Review accepted with open demonstration comments; this is not full approval." : scenario.result === "passed" && scenario.review !== "approved" ? "Passing test outcome is recorded separately from tag approval." : scenario.status === "blocked" ? "Synthetic failed inspection requires correction and retest." : "Demonstration test and review record."}`,
        completedAt:
          scenario.status === "completed" ||
          scenario.status === "not-applicable"
            ? `${row.finish}T15:00:00.000Z`
            : undefined,
        cx: {
          kind: "tag",
          assetId: asset.id,
          level,
          activityId: row.activityId,
          result: scenario.result,
          progress: scenario.progress,
          tagReview: scenario.review,
          blockerRisk:
            scenario.status === "blocked"
              ? "SYNTHETIC: control interlock evidence must be corrected before retest."
              : undefined,
        },
      });
      // Programme bars show recorded execution, never the tag review decision.
      row.progress = scenario.progress;
      if (scenario.progress === 100 && scenario.result === "passed")
        row.actualFinish = row.finish;
      tasks.push(task);
    }
    if (assetIndex % 2 === 0) {
      const state: Task["status"] = [
        "completed",
        "in-progress",
        "blocked",
        "pending",
        "not-applicable",
        "review",
      ][(assetIndex / 2) % 6] as Task["status"];
      tasks.push({
        ...baseTask(
          `demo-nb-build-${asset.id}`,
          asset,
          assignees[assetIndex % 3],
        ),
        title: `Install and inspect ${asset.name}`,
        status: state,
        notes: `${SYNTHETIC} Construction progress is separate from commissioning tags.`,
        completedAt:
          state === "completed" || state === "not-applicable"
            ? ago(2)
            : undefined,
        cx: {
          kind: "task",
          assetId: asset.id,
          activityId: asset.levelActivities!.L2B,
          result: "untested",
          progress:
            state === "completed"
              ? 100
              : state === "in-progress"
                ? 55
                : state === "review"
                  ? 90
                  : 0,
        },
      });
    }
    if (assetIndex % 3 === 0)
      tasks.push({
        ...baseTask(
          `demo-nb-issue-${asset.id}`,
          asset,
          assetIndex % 2 === 0 ? "u6" : undefined,
        ),
        title: `${asset.name} · ${assetIndex % 2 === 0 ? "Interlock retest required" : "Documentation discrepancy"}`,
        status: assetIndex % 2 === 0 ? "blocked" : "pending",
        priority: assetIndex % 2 === 0 ? "P1" : "P2",
        notes: `${SYNTHETIC} Demonstration issue: verify the control sequence and capture the outcome.`,
        cx: {
          kind: "issue",
          assetId: asset.id,
          activityId: asset.levelActivities!.L3,
          level: "L3",
          result: assetIndex % 2 === 0 ? "retest" : "untested",
          blockerRisk:
            assetIndex % 2 === 0
              ? "SYNTHETIC interlock issue holds pre-functional verification."
              : undefined,
        },
      });
  }
  for (const [index, area] of areas.entries()) {
    const asset = assets.find((row) => row.id === `DEMO-NB-AREA-${area.id}`)!;
    tasks.push({
      ...baseTask(`demo-nb-doc-${area.id}`, asset, assignees[index % 3]),
      title: `${area.area} · O&M handover pack`,
      status: index % 2 === 0 ? "review" : "pending",
      notes: SYNTHETIC,
      cx: {
        kind: "documentation",
        assetId: asset.id,
        activityId: `${asset.id}-READY`,
        handoverType: "manual",
        result: "untested",
        progress: index % 2 === 0 ? 80 : 20,
      },
    });
  }
  const rich: Project = {
    id: DEMO_RICH_PROJECT,
    name: "DEMO · Northbank commissioning",
    location: "Fictional Northbank campus · SYNTHETIC data",
    companyId: "c1",
    commissioning: {
      version: 1,
      programmeId: "DEMO-NB-MASTER",
      config,
      assets,
      schedule: programme,
      revisions: [
        {
          at: ago(14),
          actor: "DEMO fixture generator",
          action: "edit",
          reason: SYNTHETIC,
          changes: [
            "Prepared a fictional campus asset register and programme for local evaluation.",
          ],
        },
        {
          at: ago(2),
          actor: "DEMO fixture generator",
          action: "edit",
          reason: SYNTHETIC,
          changes: calculated.changes,
        },
      ],
    },
  };
  const empty: Project = {
    id: DEMO_EMPTY_PROJECT,
    name: "DEMO · Start a project",
    location: "Empty local QA scenario · SYNTHETIC",
    companyId: "c1",
    commissioning: {
      version: 0,
      config: structuredClone(config),
      assets: [],
      schedule: [],
      revisions: [],
    },
  };
  const fixtureIds = new Set([DEMO_RICH_PROJECT, DEMO_EMPTY_PROJECT]);
  const oldTaskIds = new Set(
    data.tasks
      .filter((task) => fixtureIds.has(task.projectId))
      .map((task) => task.id),
  );
  return {
    ...data,
    projects: [
      ...data.projects.filter((project) => !fixtureIds.has(project.id)),
      rich,
      empty,
    ],
    tasks: [
      ...data.tasks.filter((task) => !fixtureIds.has(task.projectId)),
      ...tasks,
    ],
    memberships: [
      ...data.memberships.filter(
        (membership) => !fixtureIds.has(membership.projectId),
      ),
      ...data.users.flatMap((user) =>
        [DEMO_RICH_PROJECT, DEMO_EMPTY_PROJECT].map((projectId) => ({
          userId: user.id,
          projectId,
        })),
      ),
    ],
    activities: [
      ...data.activities.filter((event) => !oldTaskIds.has(event.taskId)),
      ...tasks.map((task, index) => ({
        id: `demo-nb-event-${task.id}`,
        taskId: task.id,
        actorId: "u-admin",
        actorName: "DEMO · Project Administrator",
        action:
          task.cx?.kind === "tag"
            ? "Synthetic test / review scenario"
            : "Synthetic activity scenario",
        note: task.notes ?? SYNTHETIC,
        createdAt: new Date(
          now.getTime() - (index + 1) * 60 * 60 * 1000,
        ).toISOString(),
      })),
    ],
    shifts: data.shifts.filter((shift) => !fixtureIds.has(shift.projectId)),
    feedback: data.feedback.filter(
      (feedback) => !fixtureIds.has(feedback.projectId),
    ),
    attachments: data.attachments.filter(
      (attachment) => !oldTaskIds.has(attachment.taskId),
    ),
  };
}
