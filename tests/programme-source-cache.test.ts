import test from "node:test";
import assert from "node:assert/strict";
import { ProgrammeSourceCache } from "../src/server/programme-source-cache";
import {
  indexSourceProgramme,
  querySourceProgramme,
  querySourceProgrammeIndex,
  sourceProgrammeSummary,
  type SourceProgramme,
} from "../src/lib/programme-source";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  programmeSourceMetadataQuery,
  programmeSourceProjectionQuery,
} from "../src/server/db/programme-source-read";

const programme: SourceProgramme = {
  format: "p6-xer-v1",
  source: {
    fileName: "synthetic.xer",
    sha256: "a".repeat(64),
    encoding: "utf-8",
    header: "synthetic",
  },
  tables: {
    TASK: {
      fields: [
        "task_id",
        "task_code",
        "task_name",
        "early_start_date",
        "early_end_date",
        "opaque",
      ],
      rows: [
        ["1", "A", "Alpha", "2020-01-01 08:00", "2020-01-02 17:00", "verbatim"],
        ["2", "B", "Beta", "2020-01-03 08:00", "2020-01-04 17:00", ""],
      ],
      lines: [3, 4],
    },
    TASKPRED: {
      fields: ["pred_task_id", "task_id", "pred_type", "lag_hr_cnt"],
      rows: [
        ["1", "2", "PR_SS", "-2.5"],
        ["1", "2", "PR_FS1", "3"],
      ],
      lines: [7, 8],
    },
    RESOURCE: {
      fields: ["private_resource_field"],
      rows: [["excluded-from-view-transport"]],
      lines: [11],
    },
  },
};

test("indexed queries retain page/detail fidelity, all source fields and actual page links", () => {
  const summary = sourceProgrammeSummary(programme),
    index = indexSourceProgramme(programme, summary);
  for (const query of [
    {},
    { q: "Beta" },
    { page: 1, pageSize: 1 },
    { internalId: "1" },
  ])
    assert.deepEqual(
      querySourceProgrammeIndex(index, query),
      querySourceProgramme(programme, query),
    );
  const result = querySourceProgrammeIndex(index, { internalId: "1" });
  assert.equal(result.detail!.fields.opaque, "verbatim");
  assert.deepEqual(
    result.pageLinks!.map((l) => l.type),
    ["PR_SS", "PR_FS1"],
  );
  assert.deepEqual(
    querySourceProgrammeIndex(index, { pageSize: 1 }).pageLinks,
    [],
  );
  const projection = {
    ...programme,
    tables: {
      TASK: programme.tables.TASK,
      TASKPRED: programme.tables.TASKPRED,
    },
  };
  assert.equal(
    querySourceProgrammeIndex(indexSourceProgramme(projection, summary)).summary
      .sourceRecords,
    5,
  );
  assert.equal(querySourceProgrammeIndex(index, { q: "missing" }).total, 0);
});

test("process cache is project/revision isolated, expires, invalidates and respects LRU memory bounds", () => {
  const index = indexSourceProgramme(programme),
    cache = new ProgrammeSourceCache(2, 100, 10);
  cache.set("a", "v1", index, 40, 0);
  cache.set("b", "v1", index, 40, 0);
  assert.equal(cache.get("a", "v1", 1), index);
  assert.equal(cache.get("foreign", "v1", 1), undefined);
  cache.set("c", "v1", index, 40, 1);
  assert.equal(cache.get("b", "v1", 2), undefined);
  assert.equal(cache.get("a", "v2", 2), undefined);
  assert.equal(cache.get("c", "v1", 11), undefined);
  cache.set("a", "v1", index, 40, 20);
  cache.invalidate("a");
  assert.equal(cache.get("a", "v1", 21), undefined);
  cache.set("huge", "v1", index, 101, 20);
  assert.equal(cache.get("huge", "v1", 21), undefined);
  const budget = new ProgrammeSourceCache(10, 50, 100);
  budget.set("a", "1", index, 30, 0);
  budget.set("b", "1", index, 30, 0);
  assert.equal(budget.get("a", "1", 1), undefined);
});

test("database reads recheck membership and revision; projection excludes opaque tables without mutating archive", async () => {
  const pg = new PGlite(),
    dialect = new PgDialect();
  const execute = async (
    query: ReturnType<typeof programmeSourceMetadataQuery>,
  ) => {
    const q = dialect.sqlToQuery(query);
    return pg.query(q.sql, q.params);
  };
  try {
    await pg.exec(
      "CREATE TABLE projects(id text PRIMARY KEY,commissioning jsonb);CREATE TABLE project_memberships(project_id text,user_id text);INSERT INTO project_memberships VALUES('p','allowed');",
    );
    await pg.query("INSERT INTO projects VALUES('p',$1::jsonb)", [
      JSON.stringify({
        version: 7,
        sourceProgramme: programme,
        sourceProgrammeSummary: sourceProgrammeSummary(programme),
        sourceProgrammeContentHash: "content-a",
      }),
    ]);
    const meta = await execute(programmeSourceMetadataQuery("p", "allowed"));
    assert.equal(meta.rows.length, 1);
    assert(!JSON.stringify(meta.rows).includes("excluded-from-view-transport"));
    assert.equal(
      (await execute(programmeSourceMetadataQuery("p", "denied"))).rows.length,
      0,
    );
    assert.equal(
      (
        await execute(
          programmeSourceProjectionQuery("p", "allowed", 6, "content-a"),
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await execute(
          programmeSourceProjectionQuery("p", "allowed", 7, "changed-content"),
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await execute(
          programmeSourceProjectionQuery("p", "denied", 7, "content-a"),
        )
      ).rows.length,
      0,
    );
    const projection = await execute(
      programmeSourceProjectionQuery("p", "allowed", 7, "content-a"),
    );
    const source = (projection.rows[0] as { source: SourceProgramme }).source;
    assert.deepEqual(Object.keys(source.tables).sort(), ["TASK", "TASKPRED"]);
    assert.deepEqual(source.tables.TASK, programme.tables.TASK);
    await pg.exec("DELETE FROM project_memberships");
    assert.equal(
      (await execute(programmeSourceMetadataQuery("p", "allowed"))).rows.length,
      0,
    );
    const saved = await pg.query<{ source: SourceProgramme }>(
      "SELECT commissioning->'sourceProgramme' AS source FROM projects",
    );
    assert.deepEqual(saved.rows[0].source, programme);
  } finally {
    await pg.close();
  }
});
