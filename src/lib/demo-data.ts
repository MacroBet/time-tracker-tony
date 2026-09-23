import { type AppData, type Task, emptyData } from "./domain";
export function createDemoData(now = new Date()): AppData {
  const ago = (days: number) =>
    new Date(now.getTime() - days * 86400000).toISOString();
  const companies = [
    { id: "c1", name: "alternativeHEAT", logo: "/alternative-heat.png" },
    { id: "c2", name: "Mercury Engineering", logo: "M" },
    { id: "c3", name: "Schneider Electric", logo: "SE" },
  ];
  const users: AppData["users"] = [
    {
      id: "u1",
      name: "Marco Rossi",
      email: "marco@example.com",
      role: "worker",
      companyId: "c1",
    },
    {
      id: "u2",
      name: "Lewis Tucker",
      email: "lewis@example.com",
      role: "worker",
      companyId: "c2",
    },
    {
      id: "u3",
      name: "Anna Bianchi",
      email: "anna@example.com",
      role: "supervisor",
      companyId: "c1",
    },
    {
      id: "u4",
      name: "Tony McIntyre",
      email: "tony@example.com",
      role: "manager",
      companyId: "c1",
    },
    {
      id: "u5",
      name: "Sofia Romano",
      email: "sofia@example.com",
      role: "supervisor",
      companyId: "c2",
    },
    {
      id: "u6",
      name: "Alex Morgan",
      email: "alex@example.com",
      role: "worker",
      companyId: "c3",
    },
  ];
  users.push({
    id: "u-admin",
    name: "Project Administrator",
    email: "admin@example.com",
    role: "admin",
    companyId: "c1",
  });
  const projects: AppData["projects"] = [
    {
      id: "p1",
      name: "AMS16 · Construction & commissioning",
      location: "Amsterdam, Netherlands",
      companyId: "c1",
    },
  ];
  const definitions: Array<
    Partial<Task> &
      Pick<Task, "id" | "title" | "assignedTo" | "status" | "discipline">
  > = [
    {
      id: "t1",
      title: "L4 · S201 SBLVB functional test",
      assignedTo: "u1",
      status: "in-progress",
      priority: "P1",
      discipline: "Electrical",
      externalId: "3670",
      location: "S201 · LV Room B",
      dueDate: ago(1).slice(0, 10),
    },
    {
      id: "t2",
      title: "S201 CRAH valve commissioning",
      assignedTo: "u6",
      status: "blocked",
      priority: "P1",
      discipline: "Mechanical",
      externalId: "3669",
      location: "S201 · LV Room",
      notes: "Waiting for the controls contractor.",
      dueDate: ago(3).slice(0, 10),
    },
    {
      id: "t3",
      title: "Confirm access to electrical panels",
      assignedTo: "u2",
      status: "pending",
      priority: "P1",
      discipline: "Safety",
      externalId: "3667",
      location: "Level 2 · East corridor",
      dueDate: ago(0).slice(0, 10),
    },
    {
      id: "t4",
      title: "Inspect humidifier connections",
      assignedTo: "u2",
      status: "in-progress",
      discipline: "Mechanical",
      externalId: "3664",
      location: "Roof · R0",
      dueDate: ago(-2).slice(0, 10),
    },
    {
      id: "t5",
      title: "Verify AHU heat tracing",
      assignedTo: "u1",
      status: "pending",
      discipline: "Electrical",
      externalId: "3663",
      location: "Roof · R0",
      dueDate: ago(-3).slice(0, 10),
    },
    {
      id: "t6",
      title: "Calibrate CGM flowmeters",
      assignedTo: "u1",
      status: "completed",
      discipline: "Commissioning",
      externalId: "3662",
      location: "S201",
      notes: "Readings verified against the test protocol.",
      completedAt: ago(1),
      dueDate: ago(1).slice(0, 10),
    },
    {
      id: "t7",
      title: "Review site safety assessment",
      assignedTo: "u2",
      status: "completed",
      discipline: "Safety",
      externalId: "2655",
      location: "Site wide",
      notes: "Assessment reviewed and signed off.",
      completedAt: ago(2),
      dueDate: ago(1).slice(0, 10),
    },
    {
      id: "t8",
      title: "Verify BMS alarm sequence",
      assignedTo: "u6",
      status: "pending",
      discipline: "Controls",
      priority: "P3",
      location: "S201 · Control room",
      dueDate: ago(-5).slice(0, 10),
      updatedAt: ago(9),
    },
  ];
  const tasks: Task[] = definitions.map((t) => ({
    description:
      "Check the installation on site, record the outcome and attach supporting evidence before closing this activity.",
    projectId: "p1",
    companyId: users.find((u) => u.id === t.assignedTo)!.companyId,
    createdBy: "u4",
    priority: "P2",
    location: "",
    source: t.externalId ? "bim360" : "manual",
    createdAt: ago(10),
    updatedAt: ago(1),
    version: 1,
    ...t,
  }));
  projects[0].commissioning = {
    version: 1,
    config: {
      levels: ["L2A", "L2B", "L3", "L4", "L5", "L6"],
      priorities: ["P1", "P2", "P3"],
    },
    assets: [
      {
        id: "S201_SBLVB",
        name: "LV switchboard B",
        equipmentType: "Switchboard",
        location: "S201 LV Room B",
        levels: ["L2A", "L2B", "L3", "L4", "L5", "L6"],
        levelActivities: { L4: "AMS16-DEMO-1040" },
      },
      {
        id: "S201_CRAH01",
        name: "CRAH unit 01",
        equipmentType: "CRAH",
        location: "S201 LV Room",
        levels: ["L2A", "L2B", "L3", "L4"],
        deliveryActivityId: "AMS16-DEMO-DEL",
        expectedDelivery: ago(-2).slice(0, 10),
      },
      {
        id: "S201_CGM01",
        name: "CGM pump 01",
        equipmentType: "Pump",
        location: "S201",
        levels: ["L2B", "L3"],
      },
    ],
    schedule: [
      {
        activityId: "AMS16-DEMO-1040",
        name: "SBLVB functional test",
        baselineFinish: ago(3).slice(0, 10),
        finish: ago(1).slice(0, 10),
      },
      {
        activityId: "AMS16-DEMO-DEL",
        name: "CRAH delivery",
        baselineFinish: ago(7).slice(0, 10),
        finish: ago(3).slice(0, 10),
      },
    ],
    revisions: [],
  };
  tasks[0].cx = {
    kind: "issue",
    assetId: "S201_SBLVB",
    activityId: "AMS16-DEMO-1040",
    level: "L4",
    result: "untested",
    progress: 60,
  };
  tasks[1].cx = {
    kind: "issue",
    assetId: "S201_CRAH01",
    level: "L3",
    result: "retest",
    blockerRisk: "Controls issue prevents completion of L3 and delays L4.",
  };
  tasks.push(
    ...(["L2A", "L2B"] as const).map((level, i) => ({
      ...tasks[5],
      id: `demo-tag-${i}`,
      externalId: undefined,
      title: `S201_SBLVB · ${level} approved tag`,
      source: "manual" as const,
      cx: {
        kind: "tag" as const,
        assetId: "S201_SBLVB",
        level,
        result: "passed" as const,
        progress: 100,
      },
    })),
  );
  return {
    ...structuredClone(emptyData),
    companies,
    users,
    projects,
    tasks,
    memberships: users.map((u) => ({ userId: u.id, projectId: "p1" })),
    shifts: [
      {
        id: "s1",
        userId: "u1",
        projectId: "p1",
        startTime: ago(1).slice(0, 10) + "T07:00:00.000Z",
        endTime: ago(1).slice(0, 10) + "T15:00:00.000Z",
        checkInMethod: "manual",
        status: "pending-approval",
        location: "AMS16",
        notes: "Commissioning checks in S201.",
        version: 1,
      },
    ],
    activities: tasks.map((t) => ({
      id: `a-${t.id}`,
      taskId: t.id,
      actorId: "u4",
      actorName: "Tony McIntyre",
      action: "Demo activity created",
      note:
        t.notes ||
        "Synthetic data inspired by the supplied screenshots; no external system is connected.",
      createdAt: t.createdAt,
    })),
  };
}
