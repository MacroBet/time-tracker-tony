import test from "node:test";
import assert from "node:assert/strict";
import { parseP6Xer, parseP6XerText } from "../src/lib/p6-xer";
import {
  querySourceProgramme,
  sourceActivityDates,
  sourceProgrammeSchema,
  sourceProgrammeSummary,
} from "../src/lib/programme-source";

function fixture(count = 3) {
  return [
    "ERMHDR\t15.2\t2026-10-19\tProject",
    "%T\tPROJECT",
    "%F\tproj_id\tproj_short_name",
    "%R\tp6\tTEST-SOURCE",
    "%T\tCALENDAR",
    "%F\tclndr_id\tclndr_name\tclndr_data\tday_hr_cnt",
    "%R\tc1\tSix day shifts\t(retained calendar exceptions)\t10",
    "%T\tPROJWBS",
    "%F\twbs_id\twbs_short_name\twbs_name\tparent_wbs_id\tproj_node_flag",
    "%R\troot\tTEST\tSource Programme\t\tY",
    "%R\tw1\tMechanical\tMechanical work\troot\tN",
    "%T\tTASK",
    "%F\ttask_id\ttask_code\ttask_name\twbs_id\tclndr_id\ttask_type\tstatus_code\ttarget_drtn_hr_cnt\tearly_start_date\tearly_end_date\tact_start_date\tact_end_date\tphys_complete_pct",
    ...Array.from({ length: count }, (_, i) =>
      [
        "%R",
        `t${i}`,
        `A-${i}`,
        `Activity ${i}`,
        "w1",
        "c1",
        i === 0 ? "TT_Mile" : "TT_Task",
        "TK_NotStart",
        i === 0 ? "0" : "12.5",
        "2026-11-05 08:00",
        i === 0 ? "2026-11-05 08:00" : "2026-11-07 20:00",
        "",
        "",
        "25",
      ].join("\t"),
    ),
    "%T\tTASKPRED",
    "%F\ttask_pred_id\tpred_task_id\ttask_id\tpred_type\tlag_hr_cnt",
    "%R\tr1\tt0\tt1\tPR_SS\t-2.5",
    "%R\tr2\tt1\tt2\tPR_FF\t0",
    "%R\tr3\tt1\tt2\tPR_FS1\t3",
    "%T\tUNRECOGNISED",
    "%F\tfield\tblank\topaque",
    "%R\tvalue\t\t<script>not executed</script>",
    "%E",
    "",
  ].join("\r\n");
}

const source = {
  fileName: "synthetic-test.xer",
  sha256: "a".repeat(64),
  encoding: "utf-8" as const,
  header: "",
};

test("XER preserves source columns, blank values, line provenance, calendars and unknown tables", () => {
  const programme = parseP6XerText(fixture(), source);
  assert.equal(programme.tables.UNRECOGNISED.rows[0][1], "");
  assert.equal(
    programme.tables.UNRECOGNISED.rows[0][2],
    "<script>not executed</script>",
  );
  assert.equal(
    programme.tables.CALENDAR.rows[0][2],
    "(retained calendar exceptions)",
  );
  assert.equal(programme.tables.TASK.lines[0], 14);
  assert.equal(programme.source.header, "ERMHDR\t15.2\t2026-10-19\tProject");
  assert.deepEqual(sourceProgrammeSummary(programme), {
    format: "p6-xer-v1",
    fileName: source.fileName,
    sha256: source.sha256,
    projectId: "p6",
    projectName: "Source Programme",
    activities: 3,
    relationships: 3,
    calendars: 1,
    wbs: 2,
    sourceRecords: 11,
    recalculation: "source-dates-only",
  });
});

test("zero duration, non-FS, negative/decimal lags and repeated pairs survive without conversion", () => {
  const programme = parseP6XerText(fixture(), source);
  const before = JSON.stringify(programme);
  const result = querySourceProgramme(programme, { internalId: "t1" });
  assert.equal(result.activities[0].milestone, true);
  assert.equal(result.activities[0].durationHours, "0");
  assert.equal(result.activities[1].durationHours, "12.5");
  assert.deepEqual(
    result.detail!.relationships.map((link) => [link.type, link.lagHours]),
    [
      ["PR_SS", "-2.5"],
      ["PR_FF", "0"],
      ["PR_FS1", "3"],
    ],
  );
  assert.equal(result.activities[2].predecessorCount, 2);
  assert.equal(JSON.stringify(programme), before);
});

test("duration days use the activity's saved calendar conversion and keep source values intact", () => {
  const programme = parseP6XerText(fixture(), source);
  const calendar = programme.tables.CALENDAR;
  calendar.rows.push(["c2", "Backshift", "(exceptions retained)", "15"]);
  calendar.lines.push(7);
  const tasks = programme.tables.TASK;
  tasks.rows[2][tasks.fields.indexOf("clndr_id")] = "c2";
  tasks.rows[2][tasks.fields.indexOf("target_drtn_hr_cnt")] = "45";
  const before = JSON.stringify(programme);
  const result = querySourceProgramme(programme);
  assert.equal(result.activities[0].durationDays, 0);
  assert.equal(result.activities[1].durationDays, 1.25);
  assert.equal(result.activities[1].calendarHoursPerDay, 10);
  assert.equal(result.activities[2].durationDays, 3);
  assert.equal(result.activities[2].calendarHoursPerDay, 15);
  assert.equal(result.activities[2].durationHours, "45");
  assert.equal(JSON.stringify(programme), before);
});

test("missing or invalid calendar conversion never assumes an eight-hour day", () => {
  for (const raw of ["", "0", "-1", "25", "8 hours", "NaN", "Infinity"]) {
    const programme = parseP6XerText(fixture(), source);
    programme.tables.CALENDAR.rows[0][3] = raw;
    const item = querySourceProgramme(programme).activities[1];
    assert.equal(item.durationDays, undefined, raw);
    assert.equal(item.calendarHoursPerDay, undefined, raw);
    assert.equal(item.durationHours, "12.5");
  }
  const programme = parseP6XerText(fixture(), source);
  programme.tables.TASK.rows[1][4] = "unknown-calendar";
  assert.equal(
    querySourceProgramme(programme).activities[1].durationDays,
    undefined,
  );
  programme.tables.TASK.rows[1][4] = "c1";
  for (const raw of ["", "-2", "12h", "NaN"]) {
    programme.tables.TASK.rows[1][7] = raw;
    assert.equal(
      querySourceProgramme(programme).activities[1].durationDays,
      undefined,
      raw,
    );
  }
});

test("dates retain actual and saved forecast fields without timezone/calendar inference", () => {
  assert.deepEqual(
    sourceActivityDates({
      act_start_date: "2026-03-30 08:00",
      restart_date: "2026-09-14 08:00",
      reend_date: "2026-09-18 17:00",
      target_end_date: "2026-06-22 17:00",
    }),
    {
      start: "2026-03-30",
      finish: "2026-09-18",
      startField: "act_start_date",
      finishField: "reend_date",
    },
  );
  assert.deepEqual(sourceActivityDates({}), {
    start: undefined,
    finish: undefined,
    startField: undefined,
    finishField: undefined,
  });
  assert.equal(
    sourceActivityDates({ early_start_date: "2026-02-31 08:00" }).start,
    undefined,
  );
});

test("paging reaches records beyond 15000 and filters search, WBS, calendar and source status", () => {
  const programme = parseP6XerText(fixture(16969), source);
  const page = querySourceProgramme(programme, { page: 339 });
  assert.equal(page.total, 16969);
  assert.equal(page.activities.length, 19);
  assert.equal(page.activities.at(-1)!.activityId, "A-16968");
  const filtered = querySourceProgramme(programme, {
    q: "A-16968",
    wbs: "Mechanical",
    calendar: "c1",
    status: "TK_NotStart",
  });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.activities[0].wbsPath, "TEST / Mechanical");
  assert.equal(
    querySourceProgramme(programme, { calendar: "absent" }).total,
    0,
  );
  assert.equal(querySourceProgramme(programme, { page: 99999 }).page, 339);
});

test("malformed sources fail rather than dropping rows, duplicates or unresolved relationships", () => {
  assert.throws(
    () =>
      parseP6XerText(
        fixture().replace("%R\tr1\tt0", "%R\tr1\tmissing"),
        source,
      ),
    /outside this source/,
  );
  assert.throws(
    () => parseP6XerText(fixture().replace("%R\tt1\t", "%R\tt0\t"), source),
    /unique/,
  );
  assert.throws(
    () =>
      parseP6XerText(
        fixture().replace("%F\tfield\tblank", "%F\tfield\tfield"),
        source,
      ),
    /duplicate source columns/,
  );
  assert.throws(
    () =>
      parseP6XerText(fixture().replace("%R\tvalue\t\t", "%R\tvalue\t"), source),
    /column mismatch/,
  );
  const programme = parseP6XerText(fixture(), source);
  programme.tables.TASK.lines.pop();
  assert.equal(sourceProgrammeSchema.safeParse(programme).success, false);
});

test("byte parser calculates the actual source SHA and decodes Windows-1252 without rewriting content", async () => {
  const bytes = new TextEncoder().encode(
    fixture().replace("Activity 0", "Caf_ 0"),
  );
  bytes[
    Array.from(bytes).findIndex(
      (value, i) => value === 95 && bytes[i - 1] === 102,
    )
  ] = 0xe9;
  const programme = await parseP6Xer(bytes, "cp1252.xer");
  assert.equal(programme.source.encoding, "windows-1252");
  assert.equal(programme.tables.TASK.rows[0][2], "Café 0");
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  assert.equal(programme.source.sha256, Buffer.from(hash).toString("hex"));
});
