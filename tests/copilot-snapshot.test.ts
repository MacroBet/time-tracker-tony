import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { createDemoData } from "../src/lib/demo-data";
import { scopeData } from "../src/lib/permissions";
import { buildCopilotContext } from "../src/lib/copilot";
import { buildProjectReport, REPORT_TYPES } from "../src/lib/project-reports";
import { commissioning, type Commissioning } from "../src/lib/commissioning";
import {
  indexSourceProgramme,
  type SourceProgramme,
} from "../src/lib/programme-source";
import {
  scopeCopilotData,
  CopilotContextMemo,
  CopilotWorkingIndexMemo,
  copilotTaskVersions,
  copilotSnapshotIssue,
} from "../src/lib/copilot-snapshot";
import {
  copilotSnapshotQuery,
  copilotProjectAccessQuery,
} from "../src/server/db/copilot-snapshot";
const now = new Date("2026-11-16T12:00:00.000Z");

test("minimal snapshots produce identical contexts and all reports, retaining equipment, signatures, WTG, task module scope and versions", () => {
  const raw = createDemoData(now, { showcase: true });
  for (const user of raw.users.filter((row) => row.role !== "worker")) {
    for (const actor of [
      user,
      {
        ...user,
        role: "manager" as const,
        modules: ["commissioning", "reports"] as const,
      },
      {
        ...user,
        role: "manager" as const,
        modules: ["tasks", "reports"] as const,
      },
    ]) {
      const current = {
        ...actor,
        modules: actor.modules ? [...actor.modules] : undefined,
      };
      const full = scopeData(current, raw);
      for (const project of full.projects) {
        const scoped = scopeCopilotData(raw, current, project.id);
        assert(scoped);
        assert.deepEqual(
          buildCopilotContext(scoped, project.id, now),
          buildCopilotContext(full, project.id, now),
        );
        for (const report of REPORT_TYPES)
          assert.deepEqual(
            buildProjectReport(scoped, project.id, { report }, { now }),
            buildProjectReport(full, project.id, { report }, { now }),
          );
        assert.equal(scoped.projects.length, 1);
        assert(scoped.tasks.every((task) => task.projectId === project.id));
        assert.equal(
          scoped.attachments.length +
            scoped.activities.length +
            scoped.shifts.length +
            scoped.feedback.length,
          0,
        );
        assert.deepEqual(
          scoped.projects[0].commissioning?.checksheets,
          project.commissioning?.checksheets,
        );
      }
    }
  }
  const admin = raw.users.find((row) => row.role === "admin")!;
  assert.equal(
    scopeCopilotData({ ...raw, memberships: [] }, admin, "p1"),
    undefined,
    "Revocation is never an empty successful report",
  );
  assert.equal(scopeCopilotData(raw, admin, "unknown"), undefined);
});

test("request context memo invalidates task/project/name/day changes and cannot manufacture another project's context", () => {
  const data = createDemoData(now),
    memo = new CopilotContextMemo();
  const first = memo.get(data, "p1", now);
  assert.equal(memo.get(structuredClone(data), "p1", now), first);
  const changed = structuredClone(data);
  changed.tasks[0].version++;
  changed.tasks[0].title = "Changed task title";
  assert.notEqual(memo.get(changed, "p1", now), first);
  assert(
    memo
      .get(changed, "p1", now)
      .tasks.some((row) => row.title === "Changed task title"),
  );
  const other = memo.get(data, "p1", new Date("2026-11-17T12:00:00.000Z"));
  assert.notEqual(other, first);
  data.projects[0].name = "Changed project name";
  assert.equal(memo.get(data, "p1", now).project.name, "Changed project name");
  data.projects[0].commissioning = {
    ...commissioning(data.projects[0]),
    version: 4,
  };
  assert.equal(memo.get(data, "p1", now).project.version, 4);
  assert.throws(
    () => memo.get(data, "another-project", now),
    /Project not found/,
  );
});

test("delivery guard rejects changed tasks, role, modules, actor, membership/project and commissioning while a provider is working", () => {
  const data = createDemoData(now),
    user = data.users.find((row) => row.role === "admin")!;
  const subject = {
    userId: user.id,
    projectId: "p1",
    name: data.projects[0].name,
    projectVersion: commissioning(data.projects[0]).version,
    taskVersions: copilotTaskVersions(data, "p1"),
  };
  const access = {
    id: "p1",
    name: subject.name,
    version: subject.projectVersion,
    taskVersions: [...subject.taskVersions],
  };
  assert.equal(copilotSnapshotIssue(subject, user, access), undefined);
  assert.equal(
    copilotSnapshotIssue(subject, { ...user, role: "worker" }, access)?.status,
    403,
  );
  assert.equal(
    copilotSnapshotIssue(
      subject,
      { ...user, role: "manager", modules: ["tasks"] },
      access,
    )?.status,
    403,
  );
  assert.equal(
    copilotSnapshotIssue(subject, { ...user, id: "another-user" }, access)
      ?.status,
    403,
  );
  assert.equal(copilotSnapshotIssue(subject, user)?.status, 404);
  assert.equal(
    copilotSnapshotIssue(subject, user, { ...access, id: "another-project" })
      ?.status,
    404,
  );
  assert.equal(
    copilotSnapshotIssue(subject, user, {
      ...access,
      version: access.version + 1,
    })?.status,
    409,
  );
  assert.equal(
    copilotSnapshotIssue(subject, user, { ...access, name: "Renamed" })?.status,
    409,
  );
  assert.equal(
    copilotSnapshotIssue(subject, user, {
      ...access,
      taskVersions: access.taskVersions.map(
        ([id, version], index) => [id, version + Number(index === 0)] as const,
      ),
    })?.status,
    409,
  );
  assert.equal(
    copilotSnapshotIssue(subject, user, {
      ...access,
      taskVersions: access.taskVersions.slice(1),
    })?.status,
    409,
  );
});

test("working indexes are reused only inside one request and invalidate on source identity, register revision or overlay content", () => {
  const source: SourceProgramme = {
    format: "p6-xer-v1",
    source: {
      fileName: "synthetic.xer",
      sha256: "a".repeat(64),
      header: "Synthetic source",
      encoding: "utf-8",
    },
    tables: {
      TASK: {
        fields: ["task_id", "task_code", "task_name"],
        rows: [["one", "ACT-1", "Inspection"]],
        lines: [1],
      },
    },
  };
  const index = indexSourceProgramme(source),
    memo = new CopilotWorkingIndexMemo();
  const state: Commissioning = {
    ...commissioning(),
    workingSchedule: {
      sourceSha256: index.summary.sha256,
      revision: 1,
      activityPatches: [{ internalId: "one", start: "2026-11-16" }],
      addedActivities: [],
      removedLinkIds: [],
      addedLinks: [],
      receipts: [],
    },
  };
  const first = memo.get(index, state);
  assert.equal(memo.get(index, structuredClone(state)), first);
  state.workingSchedule!.activityPatches[0].start = "2026-11-17";
  assert.notEqual(memo.get(index, state), first);
  assert.equal(memo.get(index, state).activities[0].start, "2026-11-17");
  assert.notEqual(memo.get(indexSourceProgramme(source), state), first);
  const managed = memo.get(undefined, {
    ...commissioning(),
    schedule: [{ activityId: "M1", name: "Managed" }],
  });
  assert.equal(managed.activities.length, 1);
  assert.equal(managed.activities[0].activityId, "M1");
});

test("PostgreSQL scoped snapshot is one read, excludes source/audit/foreign records, respects task visibility and fails membership revocation", async () => {
  const pg = new PGlite(),
    dialect = new PgDialect();
  const execute = async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
    const parsed = dialect.sqlToQuery(query);
    assert(!/\b(?:INSERT|UPDATE|DELETE)\b/.test(parsed.sql));
    return pg.query<{
      project: { id: string; commissioning: Record<string, unknown> };
      tasks: { id: string; projectId: string }[];
      taskVersions?: [string, number][];
      version?: number;
    }>(parsed.sql, parsed.params);
  };
  try {
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const entry of journal.entries)
      await pg.exec(await readFile(`drizzle/${entry.tag}.sql`, "utf8"));
    await pg.exec(
      "INSERT INTO companies(id,name)VALUES('c','Synthetic');INSERT INTO users(id,name,email,role,company_id)VALUES('u','Manager','manager@example.test','manager','c'),('other','Other','other@example.test','worker','c');INSERT INTO projects(id,name,location,company_id)VALUES('p','Project','Site','c'),('foreign','Foreign','Site','c');INSERT INTO project_memberships(user_id,project_id)VALUES('u','p');INSERT INTO tasks(id,title,description,project_id,company_id,created_by,assigned_to,discipline)VALUES('one','Local','','p','c','u','u','Mechanical'),('two','Other local','','p','c','u','other','Mechanical'),('foreign-task','Private foreign','','foreign','c','u','u','Mechanical')",
    );
    await pg.query("UPDATE projects SET commissioning=$1::jsonb WHERE id='p'", [
      JSON.stringify({
        ...commissioning(),
        version: 7,
        sourceProgramme: { private: "must not cross transport" },
        _audit: [{ private: "private audit" }],
      }),
    ]);
    const row = (await execute(copilotSnapshotQuery("p", "u", true, false)))
      .rows[0];
    assert.equal(row.project.id, "p");
    assert.equal(row.tasks.length, 2);
    assert(row.tasks.every((task) => task.projectId === "p"));
    assert(!JSON.stringify(row).includes("private"));
    assert.equal(
      (await execute(copilotSnapshotQuery("p", "u", false, false))).rows[0]
        .tasks.length,
      0,
    );
    assert.equal(
      (await execute(copilotSnapshotQuery("p", "u", true, true))).rows[0].tasks
        .length,
      1,
    );
    const thin = (await execute(copilotProjectAccessQuery("p", "u", true)))
      .rows[0];
    assert.deepEqual(thin.taskVersions, [
      ["one", 1],
      ["two", 1],
    ]);
    assert.equal(thin.version, 7);
    await pg.exec("UPDATE tasks SET version=2 WHERE id='one'");
    assert.deepEqual(
      (await execute(copilotProjectAccessQuery("p", "u", true))).rows[0]
        .taskVersions,
      [
        ["one", 2],
        ["two", 1],
      ],
    );
    assert.equal(
      (await execute(copilotSnapshotQuery("foreign", "u", true, false))).rows
        .length,
      0,
    );
    await pg.exec("DELETE FROM project_memberships WHERE user_id='u'");
    assert.equal(
      (await execute(copilotSnapshotQuery("p", "u", true, false))).rows.length,
      0,
    );
    assert.equal(
      (await execute(copilotProjectAccessQuery("p", "u", true))).rows.length,
      0,
    );
  } finally {
    await pg.close();
  }
});
