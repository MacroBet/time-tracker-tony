import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { commissioning } from "../src/lib/commissioning";
import type { Project, User } from "../src/lib/domain";
import {
  createProjectInput,
  renameProjectInput,
  projectIdForRequest,
  projectCreationEvent,
  projectRenameEvent,
} from "../src/server/project-profile";
import {
  projectCreateQuery,
  projectRenameQuery,
} from "../src/server/db/project-profile";

const requestId = "01919e25-456a-798a-94af-04816e83b2a1";
const admin: User = {
  id: "admin",
  role: "admin",
  name: "Test administrator",
  email: "admin@example.test",
  companyId: "c",
};
const project: Project = {
  id: projectIdForRequest(admin.id, requestId),
  name: "Synthetic new project",
  location: "Local test site",
  companyId: "c",
};

test("project profile validation separates app names from source data and preserves legacy create input", () => {
  const input = createProjectInput.parse({
    name: ` ${project.name} `,
    location: project.location,
    companyId: project.companyId,
  });
  assert.equal(input.requestId, undefined);
  assert.equal(input.name, project.name);
  assert(
    !createProjectInput.safeParse({
      ...input,
      sourceProgramme: { projectName: "Do not rename a P6 source" },
    }).success,
  );
});

test("project request identity is stable per actor/key and rename rejects unrelated record mutations", () => {
  assert.equal(projectIdForRequest(admin.id, requestId), project.id);
  assert.notEqual(projectIdForRequest("other-admin", requestId), project.id);
  assert.notEqual(projectIdForRequest(admin.id, "different-key"), project.id);
  assert.match(project.id, /^[0-9a-f-]{14}5[0-9a-f-]{21}$/);
  assert(
    createProjectInput.safeParse({
      name: project.name,
      location: project.location,
      companyId: project.companyId,
    }).success,
  );
  assert(
    !createProjectInput.safeParse({
      name: " ",
      location: project.location,
      companyId: project.companyId,
    }).success,
  );
  assert(
    !renameProjectInput.safeParse({
      name: "Renamed project",
      expectedName: project.name,
      requestId,
      reason: "Verified local rename",
      companyId: "another-company",
    }).success,
  );
});

test("PostgreSQL project create/retry and profile CAS retain source, programme version, tasks, assets and membership", async () => {
  const pg = new PGlite(),
    dialect = new PgDialect();
  const execute = async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
    const parsed = dialect.sqlToQuery(query);
    return pg.query<Project>(parsed.sql, parsed.params);
  };
  try {
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const entry of journal.entries)
      await pg.exec(await readFile(`drizzle/${entry.tag}.sql`, "utf8"));
    await pg.exec(
      "INSERT INTO companies(id,name)VALUES('c','Synthetic company');INSERT INTO users(id,name,email,role,company_id)VALUES('admin','Test administrator','admin@example.test','admin','c'),('manager','Manager','manager@example.test','manager','c')",
    );
    const event = projectCreationEvent(
      project,
      admin,
      requestId,
      "2026-11-16T20:00:00.000Z",
    );
    const createdState = { ...commissioning(), _audit: [event] };
    const create = (actor = admin.id, incoming = project, marker = event) =>
      execute(projectCreateQuery(incoming, actor, createdState, marker));
    assert.equal((await create()).rows.length, 1);
    assert.equal(
      (
        await create(admin.id, project, {
          ...event,
          at: "2026-11-16T20:01:00.000Z",
        })
      ).rows.length,
      1,
    );
    assert.equal((await pg.query("SELECT * FROM projects")).rows.length, 1);
    assert.equal(
      (await pg.query("SELECT * FROM project_memberships")).rows.length,
      1,
    );
    assert.equal(
      (
        await create(
          admin.id,
          { ...project, name: "Different payload" },
          { ...event, detail: "Changed creation request" },
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await create("manager", { ...project, id: "denied" })).rows.length,
      0,
    );
    assert.equal(
      (
        await create(admin.id, {
          ...project,
          id: "missing-company",
          companyId: "missing",
        })
      ).rows.length,
      0,
    );

    const rich = {
      ...createdState,
      version: 7,
      programmeId: "P6-original-ID",
      assets: [
        {
          id: "asset-1",
          name: "Synthetic pump",
          equipmentType: "Pump",
          location: "Roof",
          levels: ["L1"],
        },
      ],
      sourceProgramme: {
        fileName: "Original source.xer",
        opaque: "exact original source",
      },
      sourceProgrammeSummary: {
        sha256: "a".repeat(64),
        projectName: "Original P6 project",
      },
      revisions: [
        {
          at: "2026-11-15T00:00:00.000Z",
          actor: "Admin",
          reason: "Original import",
          changes: ["Preserve revision"],
        },
      ],
    };
    await pg.query("UPDATE projects SET commissioning=$1::jsonb WHERE id=$2", [
      JSON.stringify(rich),
      project.id,
    ]);
    await pg.query(
      "INSERT INTO tasks(id,title,description,project_id,company_id,created_by,discipline)VALUES('task-1','Existing task','Preserved',$1,'c','admin','Test')",
      [project.id],
    );
    const rename = renameProjectInput.parse({
      name: "Readable FieldTrack name",
      expectedName: project.name,
      requestId,
      reason: "Verified local project rename",
    });
    const renamedEvent = projectRenameEvent(
      project,
      admin,
      rename,
      "2026-11-16T21:00:00.000Z",
    );
    const save = (
      actor = admin.id,
      before = project.name,
      next = rename.name,
      marker = renamedEvent,
    ) =>
      execute(
        projectRenameQuery(
          project.id,
          actor,
          before,
          next,
          marker,
          commissioning(),
        ),
      );
    assert.equal((await save(admin.id, "Stale project name")).rows.length, 0);
    assert.equal((await save("manager")).rows.length, 0);
    assert.equal((await save()).rows[0]?.name, rename.name);
    assert.equal(
      (await save()).rows.length,
      1,
      "A lost rename response may be retried without another audit event",
    );
    assert.equal(
      (
        await save(admin.id, rename.name, "Changed request", {
          ...renamedEvent,
          detail: "Changed payload",
        })
      ).rows.length,
      0,
    );
    const row = (
      await pg.query<{ commissioning: typeof rich; name: string }>(
        "SELECT name,commissioning FROM projects WHERE id=$1",
        [project.id],
      )
    ).rows[0];
    assert.equal(row.name, rename.name);
    assert.deepEqual(row.commissioning, {
      ...rich,
      _audit: [event, renamedEvent],
    });
    assert.equal(
      (await pg.query("SELECT * FROM tasks WHERE id='task-1'")).rows.length,
      1,
    );
    assert.equal(
      (await pg.query("SELECT * FROM project_memberships")).rows.length,
      1,
    );
    assert.equal(
      (await create()).rows[0]?.name,
      rename.name,
      "Creation retries after rename return the same project",
    );

    const renameBack = renameProjectInput.parse({
      name: project.name,
      expectedName: rename.name,
      reason: "A later approved rename restores the first name",
      requestId: "01919e25-456a-798a-94af-04816e83b2a2",
    });
    const renameBackEvent = projectRenameEvent(project, admin, renameBack);
    assert.equal(
      (await save(admin.id, rename.name, project.name, renameBackEvent)).rows[0]
        ?.name,
      project.name,
    );
    const afterReturn = (
      await pg.query("SELECT * FROM projects WHERE id=$1", [project.id])
    ).rows;
    assert.equal(
      (await save()).rows[0]?.name,
      project.name,
      "A late retry of A→B returns the current A after B→A without reapplying B",
    );
    assert.deepEqual(
      (await pg.query("SELECT * FROM projects WHERE id=$1", [project.id])).rows,
      afterReturn,
      "Late replay changes neither name nor audit nor commissioning data",
    );

    await pg.exec("UPDATE users SET role='manager' WHERE id='admin'");
    assert.equal((await create()).rows.length, 0);
    assert.equal((await save()).rows.length, 0);
    await pg.exec(
      "UPDATE users SET role='admin' WHERE id='admin';DELETE FROM project_memberships WHERE user_id='admin'",
    );
    assert.equal(
      (await create()).rows.length,
      0,
      "Creation retry cannot restore revoked access",
    );
    assert.equal((await save()).rows.length, 0);
    assert.equal(
      (await pg.query("SELECT * FROM project_memberships")).rows.length,
      0,
    );
  } finally {
    await pg.close();
  }
});
