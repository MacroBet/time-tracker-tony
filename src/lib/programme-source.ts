import { z } from "zod";

/** Source records remain separate from FieldTrack's editable scheduling model. */
const sourceTableSchema = z
  .object({
    fields: z.array(z.string().max(150)).min(1).max(256),
    rows: z.array(z.array(z.string().max(1_000_000)).max(256)).max(500_000),
    lines: z.array(z.number().int().positive()).max(500_000),
  })
  .strict();

export const sourceProgrammeSchema = z
  .object({
    format: z.literal("p6-xer-v1"),
    source: z
      .object({
        fileName: z.string().min(1).max(250),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        encoding: z.enum(["windows-1252", "utf-8"]),
        header: z.string().min(1).max(10_000),
      })
      .strict(),
    tables: z.record(z.string().regex(/^[A-Z0-9_]+$/), sourceTableSchema),
  })
  .strict()
  .superRefine((programme, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    let total = 0;
    for (const [name, table] of Object.entries(programme.tables)) {
      total += table.rows.length;
      if (new Set(table.fields).size !== table.fields.length)
        issue(`${name}: duplicate source columns`);
      if (table.rows.length !== table.lines.length)
        issue(`${name}: source line count does not match records`);
      if (table.rows.some((row) => row.length !== table.fields.length))
        issue(`${name}: a record does not match its source columns`);
    }
    if (total > 1_000_000) issue("Too many source records");
    const tasks = programme.tables.TASK;
    if (!tasks?.rows.length) {
      issue("The source contains no TASK activity records");
      return;
    }
    const idIndex = tasks.fields.indexOf("task_id");
    const codeIndex = tasks.fields.indexOf("task_code");
    const nameIndex = tasks.fields.indexOf("task_name");
    if ([idIndex, codeIndex, nameIndex].includes(-1)) {
      issue("TASK must contain task_id, task_code and task_name");
      return;
    }
    const ids = new Set(tasks.rows.map((row) => row[idIndex]));
    if (ids.size !== tasks.rows.length || ids.has(""))
      issue("Source task_id values must be present and unique");
    if (tasks.rows.some((row) => !row[codeIndex] || !row[nameIndex]))
      issue("Source Activity ID and name must be present");
    const links = programme.tables.TASKPRED;
    if (links) {
      const predecessor = links.fields.indexOf("pred_task_id");
      const successor = links.fields.indexOf("task_id");
      if (predecessor < 0 || successor < 0)
        issue("TASKPRED must contain both source task references");
      else if (
        links.rows.some(
          (row) => !ids.has(row[predecessor]) || !ids.has(row[successor]),
        )
      )
        issue("A relationship references an activity outside this source");
    }
  });

export type SourceProgramme = z.infer<typeof sourceProgrammeSchema>;
export type SourceTable = SourceProgramme["tables"][string];
export type SourceRecord = Record<string, string>;

export type SourceProgrammeSummary = {
  format: "p6-xer-v1";
  fileName: string;
  sha256: string;
  projectId: string;
  projectName: string;
  activities: number;
  relationships: number;
  calendars: number;
  wbs: number;
  sourceRecords: number;
  recalculation: "source-dates-only";
};

export function sourceRecords(table?: SourceTable): SourceRecord[] {
  return table
    ? table.rows.map((row) =>
        Object.fromEntries(table.fields.map((field, i) => [field, row[i]])),
      )
    : [];
}

export function sourceProgrammeSummary(
  programme: SourceProgramme,
): SourceProgrammeSummary {
  const project = sourceRecords(programme.tables.PROJECT)[0];
  const root = sourceRecords(programme.tables.PROJWBS).find(
    (record) => record.proj_node_flag === "Y",
  );
  return {
    format: programme.format,
    fileName: programme.source.fileName,
    sha256: programme.source.sha256,
    projectId: project?.proj_id ?? "",
    projectName:
      root?.wbs_name || project?.proj_short_name || programme.source.fileName,
    activities: programme.tables.TASK.rows.length,
    relationships: programme.tables.TASKPRED?.rows.length ?? 0,
    calendars: programme.tables.CALENDAR?.rows.length ?? 0,
    wbs: programme.tables.PROJWBS?.rows.length ?? 0,
    sourceRecords: Object.values(programme.tables).reduce(
      (count, table) => count + table.rows.length,
      0,
    ),
    recalculation: "source-dates-only",
  };
}

const day = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?: |T|$)/.test(value)) return undefined;
  const candidate = value.slice(0, 10);
  const timestamp = Date.parse(`${candidate}T00:00:00Z`);
  return Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === candidate
    ? candidate
    : undefined;
};

/** Display actual dates where recorded, otherwise the saved remaining forecast. */
export function sourceActivityDates(record: SourceRecord) {
  const startField = [
    "act_start_date",
    "restart_date",
    "early_start_date",
    "target_start_date",
  ].find((field) => day(record[field]));
  const finishField = [
    "act_end_date",
    "reend_date",
    "early_end_date",
    "target_end_date",
  ].find((field) => day(record[field]));
  return {
    start: startField ? day(record[startField]) : undefined,
    finish: finishField ? day(record[finishField]) : undefined,
    startField,
    finishField,
  };
}

export type SourceActivityView = {
  internalId: string;
  activityId: string;
  name: string;
  wbsId: string;
  wbsPath: string;
  calendarId: string;
  calendarName: string;
  status: string;
  taskType: string;
  milestone: boolean;
  durationHours: string;
  predecessorCount: number;
  successorCount: number;
  start?: string;
  finish?: string;
  startField?: string;
  finishField?: string;
};

export type SourceRelationshipView = {
  sourceLine: number;
  predecessorId: string;
  predecessorActivityId: string;
  successorId: string;
  successorActivityId: string;
  type: string;
  lagHours: string;
  fields: SourceRecord;
};

export type SourceProgrammePage = {
  summary: SourceProgrammeSummary;
  activities: SourceActivityView[];
  total: number;
  page: number;
  pageSize: number;
  filters: {
    calendars: { id: string; name: string }[];
    statuses: string[];
  };
  pageLinks?: Pick<
    SourceRelationshipView,
    "predecessorId" | "successorId" | "type" | "sourceLine"
  >[];
  detail?: {
    activity: SourceActivityView;
    sourceLine: number;
    fields: SourceRecord;
    relationships: SourceRelationshipView[];
  };
};

export type SourceProgrammeQuery = {
  q?: string;
  wbs?: string;
  calendar?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  internalId?: string;
};

/** Query index holds only the five tables used by this view, never resource archives. */
export type SourceProgrammeIndex = {
  summary: SourceProgrammeSummary;
  activities: SourceActivityView[];
  byId: Map<
    string,
    {
      activity: SourceActivityView;
      fields: SourceRecord;
      sourceLine: number;
      relationships: SourceRelationshipView[];
    }
  >;
  filters: SourceProgrammePage["filters"];
  search: string[];
  wbsSearch: string[];
  links: SourceRelationshipView[];
};

/** Build once per saved source revision. Original fields and dates remain unchanged. */
export function indexSourceProgramme(
  programme: SourceProgramme,
  summary = sourceProgrammeSummary(programme),
): SourceProgrammeIndex {
  const tasks = sourceRecords(programme.tables.TASK);
  const taskCodes = new Map(
    tasks.map((task) => [task.task_id, task.task_code]),
  );
  const calendars = sourceRecords(programme.tables.CALENDAR);
  const calendarNames = new Map(
    calendars.map((record) => [record.clndr_id, record.clndr_name]),
  );
  const wbs = new Map(
    sourceRecords(programme.tables.PROJWBS).map((record) => [
      record.wbs_id,
      record,
    ]),
  );
  const paths = new Map<string, string>();
  const wbsPath = (id: string) => {
    if (paths.has(id)) return paths.get(id)!;
    const names: string[] = [],
      seen = new Set<string>();
    let current = id;
    while (current && !seen.has(current)) {
      seen.add(current);
      const record = wbs.get(current);
      if (!record) break;
      names.unshift(record.wbs_short_name || record.wbs_name || current);
      current = record.parent_wbs_id;
    }
    const path = names.join(" / ");
    paths.set(id, path);
    return path;
  };
  const incoming = new Map<string, SourceRelationshipView[]>(),
    outgoing = new Map<string, SourceRelationshipView[]>();
  const links = sourceRecords(programme.tables.TASKPRED).map(
    (record, i): SourceRelationshipView => ({
      sourceLine: programme.tables.TASKPRED.lines[i],
      predecessorId: record.pred_task_id,
      predecessorActivityId:
        taskCodes.get(record.pred_task_id) ?? record.pred_task_id,
      successorId: record.task_id,
      successorActivityId: taskCodes.get(record.task_id) ?? record.task_id,
      type: record.pred_type,
      lagHours: record.lag_hr_cnt,
      fields: record,
    }),
  );
  for (const link of links) {
    const from = outgoing.get(link.predecessorId) ?? [];
    from.push(link);
    outgoing.set(link.predecessorId, from);
    const to = incoming.get(link.successorId) ?? [];
    to.push(link);
    incoming.set(link.successorId, to);
  }
  const activities = tasks.map((record): SourceActivityView => ({
    internalId: record.task_id,
    activityId: record.task_code,
    name: record.task_name,
    wbsId: record.wbs_id ?? "",
    wbsPath: wbsPath(record.wbs_id),
    calendarId: record.clndr_id ?? "",
    calendarName: calendarNames.get(record.clndr_id) ?? record.clndr_id ?? "",
    status: record.status_code ?? "",
    taskType: record.task_type ?? "",
    milestone: /(?:Mile|Milestone)/i.test(record.task_type ?? ""),
    durationHours: record.target_drtn_hr_cnt ?? "",
    predecessorCount: incoming.get(record.task_id)?.length ?? 0,
    successorCount: outgoing.get(record.task_id)?.length ?? 0,
    ...sourceActivityDates(record),
  }));
  return {
    summary,
    activities,
    links,
    byId: new Map(
      tasks.map((record, i) => [
        record.task_id,
        {
          activity: activities[i],
          fields: record,
          sourceLine: programme.tables.TASK.lines[i],
          relationships: [
            ...(incoming.get(record.task_id) ?? []),
            ...(outgoing.get(record.task_id) ?? []),
          ]
            .filter((link, i, all) => all.indexOf(link) === i)
            .sort((a, b) => a.sourceLine - b.sourceLine),
        },
      ]),
    ),
    filters: {
      calendars: calendars.map((record) => ({
        id: record.clndr_id,
        name: record.clndr_name,
      })),
      statuses: [...new Set(activities.map((a) => a.status))].filter(Boolean),
    },
    search: activities.map((a) => `${a.activityId} ${a.name}`.toLowerCase()),
    wbsSearch: activities.map((a) =>
      `${a.wbsId} ${a.wbsPath} ${wbs.get(a.wbsId)?.wbs_name ?? ""}`.toLowerCase(),
    ),
  };
}

/** Every record remains stored; only the requested page/detail is sent to a viewer. */
export function querySourceProgrammeIndex(
  index: SourceProgrammeIndex,
  query: SourceProgrammeQuery = {},
): SourceProgrammePage {
  const search = query.q?.trim().toLowerCase(),
    wbsSearch = query.wbs?.trim().toLowerCase();
  const filtered = index.activities.filter(
    (a, i) =>
      (!search || index.search[i].includes(search)) &&
      (!wbsSearch || index.wbsSearch[i].includes(wbsSearch)) &&
      (!query.calendar || a.calendarId === query.calendar) &&
      (!query.status || a.status === query.status),
  );
  const pageSize = Math.min(100, Math.max(1, Math.floor(query.pageSize || 50)));
  const page = Math.min(
    Math.max(0, Math.floor(query.page || 0)),
    Math.max(0, Math.ceil(filtered.length / pageSize) - 1),
  );
  const activities = filtered.slice(page * pageSize, (page + 1) * pageSize),
    ids = new Set(activities.map((a) => a.internalId));
  const result: SourceProgrammePage = {
    summary: index.summary,
    activities,
    total: filtered.length,
    page,
    pageSize,
    filters: index.filters,
    pageLinks: index.links
      .filter(
        (link) => ids.has(link.predecessorId) && ids.has(link.successorId),
      )
      .map(({ predecessorId, successorId, type, sourceLine }) => ({
        predecessorId,
        successorId,
        type,
        sourceLine,
      })),
  };
  if (query.internalId) {
    const detail = index.byId.get(query.internalId);
    if (detail) result.detail = detail;
  }
  return result;
}

export function querySourceProgramme(
  programme: SourceProgramme,
  query: SourceProgrammeQuery = {},
): SourceProgrammePage {
  return querySourceProgrammeIndex(indexSourceProgramme(programme), query);
}
