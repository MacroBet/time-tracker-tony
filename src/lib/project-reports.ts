import { z } from "zod";
import {
  LEVELS,
  commissioning,
  type Asset,
  type Commissioning,
  type Level,
} from "./commissioning";
import { projectDate, isClosed, type AppData, type Task } from "./domain";
import type { SourceProgrammeIndex } from "./programme-source";
import { csvCell } from "./csv";

export const REPORT_TYPES = [
  "tagging",
  "works-to-go",
  "lookahead",
  "vendors",
] as const;
export const MISSING_REPORT_VALUE = "__missing__";
export const CONFLICT_REPORT_VALUE = "__conflict__";
export const LOOKAHEAD_WEEKS = [2, 4, 6] as const;
const filterValue = z.string().trim().min(1).max(150).optional();
export const reportQuerySchema = z
  .object({
    report: z.enum(REPORT_TYPES).default("tagging"),
    vendor: filterValue,
    level: z.enum(LEVELS).optional(),
    late: z.enum(["all", "late", "not-late", "unknown"]).default("all"),
    discipline: filterValue,
    query: z.string().trim().max(200).optional(),
    activity: z
      .string()
      .trim()
      .max(400)
      .regex(/^(?:source:[a-f0-9]{64}:.+|managed:.+)$/)
      .optional(),
    from: z.iso.date().optional(),
    weeks: z.coerce
      .number()
      .pipe(z.union([z.literal(2), z.literal(4), z.literal(6)]))
      .optional(),
    workStatus: z.enum(["open", "done", "all"]).default("open"),
    activityStatus: z.enum(["open", "done", "all"]).default("open"),
    offset: z.coerce.number().int().min(0).max(1000000).default(0),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
  .superRefine((query, context) => {
    if (query.activity && query.report !== "tagging")
      context.addIssue({
        code: "custom",
        path: ["activity"],
        message:
          "Activity step scope applies to the tagging report. Clear it before switching reports.",
      });
  });
export type ProjectReportQuery = z.infer<typeof reportQuerySchema>;
export type StepProgress = {
  passed: number;
  required: number;
  totalRequired: number;
  notApplicable: number;
  percent: number | null;
  missingSheets: number;
  complete: boolean;
  coverage: "complete" | "partial" | "missing" | "not-applicable";
  completedAt?: string;
};
const dayOf = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2} \d/.test(value)) return dayOf(value.slice(0, 10));
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return z.iso.date().safeParse(value).success ? value : undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? projectDate(date) : undefined;
};

/** Only explicit required-step results count. Signatures/review never change this fraction. */
const activeAssetLevels = (state: Commissioning, asset?: Asset) =>
  asset?.levels.filter((level) => state.config.levels.includes(level)) ?? [];
export function assetStepProgress(
  state: Commissioning,
  assetId: string,
  level?: Level | Level[],
): StepProgress {
  const asset = state.assets.find((row) => row.id === assetId);
  const selectedLevels = Array.isArray(level)
    ? [...new Set(level)]
    : level
      ? [level]
      : undefined;
  const activeLevels = activeAssetLevels(state, asset);
  const expected = selectedLevels
    ? activeLevels.filter((level) => selectedLevels.includes(level))
    : activeLevels;
  if (!expected.length)
    return {
      passed: 0,
      required: 0,
      totalRequired: 0,
      notApplicable: 0,
      percent: null,
      missingSheets: 0,
      complete: false,
      coverage: "not-applicable",
    };
  const sheets = (state.checksheets?.sheets ?? []).filter(
    (sheet) =>
      sheet.assetId === assetId &&
      sheet.level &&
      expected.includes(sheet.level),
  );
  const missingSheets = expected.length
    ? expected.filter(
        (required) => !sheets.some((sheet) => sheet.level === required),
      ).length
    : Number(!sheets.length);
  let passed = 0,
    required = 0,
    notApplicable = 0,
    totalRequired = 0;
  const dates: string[] = [];
  for (const sheet of sheets)
    for (const step of sheet.requirements.filter((row) => row.required)) {
      totalRequired++;
      const response = sheet.responses.find((row) => row.stepId === step.id);
      if (response?.result === "not-applicable") {
        notApplicable++;
        if (dayOf(response.updatedAt)) dates.push(response.updatedAt);
        continue;
      }
      required++;
      if (response?.result === "passed" && response.answer.trim()) {
        passed++;
        if (dayOf(response.updatedAt)) dates.push(response.updatedAt);
      }
    }
  const complete = required > 0 && passed === required && missingSheets === 0;
  return {
    passed,
    required,
    totalRequired,
    notApplicable,
    percent: required ? Math.round((passed / required) * 100) : null,
    missingSheets,
    complete,
    coverage: !sheets.length
      ? "missing"
      : missingSheets
        ? "partial"
        : required === 0
          ? "not-applicable"
          : "complete",
    completedAt: complete && dates.length ? dates.sort().at(-1) : undefined,
  };
}
export type OperationalStatus = {
  status: "late" | "remaining-work" | "complete" | "not-due" | "unknown";
  colour: "red" | "orange" | "green" | null;
  label: string;
};
export function operationalStatus({
  due,
  completedAt,
  completed,
  openWorks,
  today = projectDate(),
}: {
  due?: string;
  completedAt?: string;
  completed: boolean;
  openWorks: number;
  today?: string;
}): OperationalStatus {
  const deadline = dayOf(due),
    finished = dayOf(completedAt);
  if (!deadline || (completed && !finished))
    return {
      status: "unknown",
      colour: null,
      label: !deadline ? "No recorded deadline" : "Completion date unknown",
    };
  if ((completed && finished! > deadline) || (!completed && deadline < today))
    return {
      status: "late",
      colour: "red",
      label: completed ? "Completed late" : "Overdue",
    };
  if (completed && openWorks > 0)
    return {
      status: "remaining-work",
      colour: "orange",
      label: "Completed · remaining work open",
    };
  if (completed)
    return { status: "complete", colour: "green", label: "Completed on time" };
  return { status: "not-due", colour: null, label: "Not due" };
}

export type TagLevelReport = {
  level: Level;
  progress: StepProgress;
  status: OperationalStatus;
  reviews: {
    taskId: string;
    result: string;
    review: string | null;
    href: string;
  }[];
  signatures: number;
  sheets: number;
};
export type TaggingReportRow = {
  kind: "tagging";
  id: string;
  name: string;
  assetId: string;
  equipmentType: string;
  vendor: string | null;
  discipline: string | null;
  phase: string | null;
  area: string | null;
  progress: StepProgress;
  status: OperationalStatus;
  levels: TagLevelReport[];
  openWorks: number;
  openIssues: number;
  signatures: number;
  href: string;
};
export type WorksReportRow = {
  kind: "works-to-go";
  id: string;
  name: string;
  notes: string;
  assetId: string | null;
  assetName: string | null;
  vendor: string | null;
  discipline: string | null;
  attribution: "recorded" | "missing" | "conflict";
  status: "open" | "done";
  taskId: string | null;
  href: string;
};
export type LookaheadReportRow = {
  kind: "lookahead";
  id: string;
  name: string;
  activityId: string;
  internalId: string | null;
  source: "source" | "managed";
  start: string | null;
  finish: string | null;
  deadline: string | null;
  deadlineSource: string | null;
  completed: boolean;
  calendar: string | null;
  vendor: string | null;
  vendors: string[];
  disciplines: string[];
  assets: { id: string; name: string; vendor: string | null; href: string }[];
  status: OperationalStatus;
  href: string;
};
export type VendorReportRow = {
  kind: "vendors";
  id: string;
  name: string;
  vendor: string | null;
  activities: number;
  assetCount: number;
  start: string | null;
  finish: string | null;
  sources: {
    id: string;
    name: string;
    activityId: string;
    start: string | null;
    finish: string | null;
    href: string;
  }[];
  href: string;
};
export type ProjectReportRow =
  TaggingReportRow | WorksReportRow | LookaheadReportRow | VendorReportRow;
export type ReportCoverage = {
  assets: number;
  assetsMissingVendor: number;
  activities: number;
  activitiesWithoutAssetLinks: number;
  activitiesMissingVendor: number;
  ambiguousActivityReferences: number;
  undatedActivities: number;
  overdueActivities: number;
  worksMissingVendor: number;
  worksDisciplineConflict: number;
  sourceUnavailable: boolean;
};
export type ProjectReportResult = {
  report: ProjectReportQuery["report"];
  project: { id: string; name: string };
  query: ProjectReportQuery;
  total: number;
  offset: number;
  limit: number;
  rows: ProjectReportRow[];
  progress?: StepProgress;
  activity?: { id: string; name: string; unknownReason?: string };
  href: string;
  revision: { register: number; sourceSha: string | null };
  generatedAt: string;
  timezone: "Europe/Amsterdam";
  window: { from: string; through: string; days: number };
  facets: { vendors: string[]; disciplines: string[]; levels: Level[] };
  coverage: ReportCoverage;
  notes: string[];
};

export function reportQueryParams(query: Partial<ProjectReportQuery>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== "") params.set(key, String(value));
  return params;
}
export function projectReportHref(
  projectId: string,
  query: Partial<ProjectReportQuery>,
) {
  const params = reportQueryParams(query);
  params.set("projectId", projectId);
  return `/reports?${params}`;
}
export const reportActivityKey = (
  source: "source" | "managed",
  id: string,
  sha?: string,
) => (source === "source" ? `source:${sha}:${id}` : `managed:${id}`);
/** An actual finish cannot prove its own timeliness. Completed source rows need a saved planned target. */
export function sourceActivityDeadline(
  index: SourceProgrammeIndex,
  internalId: string,
) {
  const entry = index.byId.get(internalId);
  if (!entry) return undefined;
  const completed =
    entry.activity.status === "TK_Complete" ||
    Boolean(dayOf(entry.fields.act_end_date));
  return completed
    ? dayOf(entry.fields.target_end_date)
    : dayOf(entry.activity.finish);
}
function workingLinks(state: Commissioning, index?: SourceProgrammeIndex) {
  const working = state.workingSchedule;
  return working?.sourceSha256 === (index?.summary.sha256 ?? "managed")
    ? working
    : undefined;
}
function workingActivityKey(
  working: NonNullable<Commissioning["workingSchedule"]>,
  index: SourceProgrammeIndex | undefined,
  internalId: string,
) {
  if (index?.byId.has(internalId))
    return reportActivityKey("source", internalId, index.summary.sha256);
  if (!index && working.sourceSha256 === "managed")
    return reportActivityKey(
      "managed",
      working.addedActivities.find((row) => row.internalId === internalId)
        ?.activityId ?? internalId,
    );
  return undefined;
}
const supplier = (asset?: Asset) =>
  (asset as (Asset & { vendor?: string }) | undefined)?.vendor?.trim() || null;
const assetHref = (projectId: string, assetId: string) =>
  `/commissioning?projectId=${encodeURIComponent(projectId)}&asset=${encodeURIComponent(assetId)}`;
const match = (value: string | null, filter?: string) =>
  !filter ||
  (filter === MISSING_REPORT_VALUE
    ? !value
    : Boolean(value && sameIdentity(value, filter)));
const identity = (value: string) =>
  value.normalize("NFKC").trim().toLocaleLowerCase("en");
const sameIdentity = (left: string, right: string) =>
  identity(left) === identity(right);
const supplierLabels = (values: (string | null | undefined)[]) =>
  [
    ...new Map(
      values
        .filter((value): value is string => Boolean(value))
        .map((value) => [identity(value), value]),
    ).values(),
  ].sort((a, b) => a.localeCompare(b));
const matchesLate = (
  status: OperationalStatus,
  value: ProjectReportQuery["late"],
) =>
  value === "all" ||
  (value === "unknown"
    ? status.status === "unknown"
    : value === "late"
      ? status.status === "late"
      : status.status !== "late" && status.status !== "unknown");
const unique = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort(
    (a, b) => a.localeCompare(b),
  );
const addDays = (day: string, count: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + count * 86400000)
    .toISOString()
    .slice(0, 10);
function aggregateStepProgress(parts: StepProgress[]): StepProgress {
  if (parts.length === 1) return { ...parts[0] };
  const passed = parts.reduce((total, part) => total + part.passed, 0),
    required = parts.reduce((total, part) => total + part.required, 0),
    missingSheets = parts.length
      ? parts.reduce((total, part) => total + part.missingSheets, 0)
      : 0;
  const complete = required > 0 && passed === required && missingSheets === 0;
  return {
    passed,
    required,
    totalRequired: parts.reduce((total, part) => total + part.totalRequired, 0),
    notApplicable: parts.reduce((total, part) => total + part.notApplicable, 0),
    percent: required ? Math.round((passed / required) * 100) : null,
    missingSheets,
    complete,
    coverage:
      !parts.length || parts.every((part) => part.coverage === "missing")
        ? "missing"
        : missingSheets
          ? "partial"
          : required === 0 && parts.length > 0
            ? "not-applicable"
            : "complete",
    completedAt: complete
      ? parts
          .flatMap((part) => (part.completedAt ? [part.completedAt] : []))
          .sort()
          .at(-1)
      : undefined,
  };
}

type ReportOptions = { sourceIndex?: SourceProgrammeIndex; now?: Date };
export function buildProjectReport(
  data: AppData,
  projectId: string,
  raw: Partial<ProjectReportQuery>,
  options: ReportOptions = {},
): ProjectReportResult {
  return buildReportPopulation(data, projectId, raw, options, true);
}
function buildReportPopulation(
  data: AppData,
  projectId: string,
  raw: Partial<ProjectReportQuery>,
  options: ReportOptions,
  paged: boolean,
): ProjectReportResult {
  const query = reportQuerySchema.parse(raw),
    project = data.projects.find((row) => row.id === projectId);
  if (!project) throw new Error("Project not found.");
  const state = commissioning(project),
    now = options.now ?? new Date(),
    today = projectDate(now);
  const window = {
    from: query.from ?? today,
    through: addDays(query.from ?? today, (query.weeks ?? 2) * 7 - 1),
    days: (query.weeks ?? 2) * 7,
  };
  const tasks = data.tasks.filter((task) => task.projectId === projectId),
    index = options.sourceIndex;
  const assetsById = new Map(state.assets.map((asset) => [asset.id, asset]));
  const works = state.checksheets?.worksToGo ?? [];
  const coverage: ReportCoverage = {
    assets: state.assets.length,
    assetsMissingVendor: state.assets.filter((asset) => !supplier(asset))
      .length,
    activities: 0,
    activitiesWithoutAssetLinks: 0,
    activitiesMissingVendor: 0,
    ambiguousActivityReferences: 0,
    undatedActivities: 0,
    overdueActivities: 0,
    worksMissingVendor: 0,
    worksDisciplineConflict: 0,
    sourceUnavailable: Boolean(state.sourceProgrammeSummary && !index),
  };
  const notes = [
    "Supplier means the explicitly recorded equipment supplier. Owner, manufacturer and task assignee are not supplier sources.",
    "Progress counts passed required applicable checksheet steps; explicit N/A steps are excluded. Tag approval and signatures are separate.",
    "Only asset-required tag levels enabled in this project are counted. Equipment checksheets without a tag and disabled tag history remain saved but are excluded from current tagging progress.",
  ];
  if (query.level && !state.config.levels.includes(query.level))
    notes.push(
      `Tag level ${query.level} is disabled for current project reports. Historical records are preserved and excluded from this active population.`,
    );
  const workAsset = (work: (typeof works)[number]) => {
    const direct = work.assetId ? assetsById.get(work.assetId) : undefined;
    const task = work.taskId
      ? tasks.find((row) => row.id === work.taskId)
      : undefined;
    const linked = task?.cx?.assetId
      ? assetsById.get(task.cx.assetId)
      : undefined;
    const conflict = Boolean(direct && linked && direct.id !== linked.id);
    const asset = conflict ? undefined : (direct ?? linked);
    const disciplines = unique([
      asset?.discipline?.trim(),
      task?.discipline?.trim(),
    ]);
    return {
      asset,
      task,
      conflict,
      discipline:
        conflict || disciplines.length > 1
          ? CONFLICT_REPORT_VALUE
          : (disciplines[0] ?? null),
    };
  };
  const openWorksFor = (assetId: string) =>
    works.filter(
      (work) => work.status === "open" && workAsset(work).asset?.id === assetId,
    ).length;
  const activities: LookaheadReportRow[] = [];
  const aliases = new Map<string, Set<string>>();
  const byKey = new Map<string, LookaheadReportRow>();
  function alias(reference: string, key: string) {
    if (!reference) return;
    const matches = aliases.get(reference) ?? new Set<string>();
    matches.add(key);
    aliases.set(reference, matches);
  }
  const mirrored = new Map<string, string>();
  const working = workingLinks(state, index);
  for (const row of working?.addedActivities ?? [])
    if (index?.byId.has(row.internalId))
      mirrored.set(
        row.activityId,
        reportActivityKey("source", row.internalId, index.summary.sha256),
      );
  for (const row of index?.activities ?? []) {
    const key = reportActivityKey(
        "source",
        row.internalId,
        index!.summary.sha256,
      ),
      fields = index!.byId.get(row.internalId)?.fields;
    const completed =
      row.status === "TK_Complete" || Boolean(dayOf(fields?.act_end_date));
    const finish = row.finish ?? null,
      start = row.start ?? null,
      deadline = sourceActivityDeadline(index!, row.internalId) ?? null;
    const item: LookaheadReportRow = {
      kind: "lookahead",
      id: key,
      activityId: row.activityId,
      internalId: row.internalId,
      name: row.name,
      source: "source",
      start,
      finish,
      deadline,
      deadlineSource: completed
        ? deadline
          ? "target_end_date"
          : null
        : (row.finishField ?? "saved forecast finish"),
      completed,
      calendar: row.calendarName || null,
      vendor: null,
      vendors: [],
      disciplines: [],
      assets: [],
      // Filled once after all explicit equipment mappings have been attached.
      status: {
        status: "unknown",
        colour: null,
        label: "Deadline not recorded",
      },
      href: `/schedule?projectId=${encodeURIComponent(projectId)}&activity=${encodeURIComponent(row.internalId)}`,
    };
    activities.push(item);
    byKey.set(key, item);
    alias(key, key);
    alias(row.activityId, key);
  }
  for (const row of state.schedule) {
    if (mirrored.has(row.activityId)) {
      alias(
        reportActivityKey("managed", row.activityId),
        mirrored.get(row.activityId)!,
      );
      continue;
    }
    const key = reportActivityKey("managed", row.activityId),
      completed = Boolean(row.actualFinish) || row.progress === 100;
    const item: LookaheadReportRow = {
      kind: "lookahead",
      id: key,
      activityId: row.activityId,
      internalId: null,
      name: row.name,
      source: "managed",
      start: row.start ?? null,
      finish: row.finish ?? null,
      deadline: row.finish ?? null,
      deadlineSource: row.finish ? "saved schedule finish" : null,
      completed,
      calendar: "Managed working-day schedule",
      vendor: null,
      vendors: [],
      disciplines: [],
      assets: [],
      status: {
        status: "unknown",
        colour: null,
        label: "Deadline not recorded",
      },
      href: `/schedule?projectId=${encodeURIComponent(projectId)}&activityId=${encodeURIComponent(row.activityId)}`,
    };
    activities.push(item);
    byKey.set(key, item);
    alias(key, key);
    alias(row.activityId, key);
  }
  const ambiguous = new Set<string>();
  function resolve(reference?: string) {
    if (!reference) return undefined;
    const keys = aliases.get(reference);
    if (keys?.size !== 1) {
      if (keys && keys.size > 1) ambiguous.add(reference);
      return undefined;
    }
    return byKey.get([...keys][0]);
  }
  const primaryActivityKeys = new Map<string, string[]>();
  if (working)
    for (const link of [
      ...working.activityPatches.map((patch) => ({
        internalId: patch.internalId,
        assetIds: patch.assetIds ?? [],
      })),
      ...working.addedActivities.map((added) => ({
        internalId: added.internalId,
        assetIds: [added.assetId],
      })),
    ]) {
      const key = workingActivityKey(working, index, link.internalId),
        row = key ? byKey.get(key) : undefined;
      if (!row || !key) continue;
      for (const id of link.assetIds) {
        const asset = assetsById.get(id);
        if (asset && !row.assets.some((linked) => linked.id === id))
          row.assets.push({
            id,
            name: asset.name,
            vendor: supplier(asset),
            href: assetHref(projectId, id),
          });
        if (asset)
          primaryActivityKeys.set(id, [
            ...new Set([...(primaryActivityKeys.get(id) ?? []), key]),
          ]);
      }
    }
  for (const asset of state.assets) {
    const references = unique([
      asset.programmeActivityId,
      asset.deliveryActivityId,
      ...Object.values(asset.levelActivities ?? {}),
      ...tasks
        .filter((task) => task.cx?.assetId === asset.id)
        .map((task) => task.cx?.activityId),
    ]);
    for (const reference of references) {
      const row = resolve(reference);
      if (row && !row.assets.some((linked) => linked.id === asset.id))
        row.assets.push({
          id: asset.id,
          name: asset.name,
          vendor: supplier(asset),
          href: assetHref(projectId, asset.id),
        });
    }
  }
  for (const row of activities) {
    row.vendors = supplierLabels(row.assets.map((asset) => asset.vendor));
    row.vendor = row.vendors.length === 1 ? row.vendors[0] : null;
    row.disciplines = unique(
      row.assets.map((asset) => assetsById.get(asset.id)?.discipline?.trim()),
    );
    row.status = operationalStatus({
      due: row.deadline ?? undefined,
      completed: row.completed,
      completedAt:
        row.source === "source"
          ? index?.byId.get(row.internalId!)?.fields.act_end_date
          : state.schedule.find(
              (activity) => activity.activityId === row.activityId,
            )?.actualFinish,
      openWorks: row.assets.reduce(
        (total, asset) => total + openWorksFor(asset.id),
        0,
      ),
      today,
    });
  }
  coverage.activities = activities.length;
  coverage.ambiguousActivityReferences = ambiguous.size;
  coverage.undatedActivities = activities.filter(
    (row) => !row.start || !row.finish,
  ).length;
  coverage.overdueActivities = activities.filter(
    (row) => row.status.status === "late" && !row.completed,
  ).length;
  const windowRows = activities.filter(
    (row) =>
      row.start &&
      row.finish &&
      row.start <= window.through &&
      row.finish >= window.from &&
      (query.activityStatus === "all" ||
        row.completed === (query.activityStatus === "done")),
  );
  coverage.activitiesWithoutAssetLinks = windowRows.filter(
    (row) => !row.assets.length,
  ).length;
  coverage.activitiesMissingVendor = windowRows.filter(
    (row) => !row.assets.length || row.assets.some((asset) => !asset.vendor),
  ).length;
  const term = query.query?.toLowerCase();
  const textMatches = (...values: (string | null | undefined)[]) =>
    !term || values.filter(Boolean).join(" ").toLowerCase().includes(term);
  let rows: ProjectReportRow[] = [];
  const activityScope = query.activity
    ? activityStepProgress(state, tasks, query.activity, today, index)
    : undefined;
  const scopeFor = (asset: Asset) =>
    activityScope?.scope.filter((mapping) => mapping.assetId === asset.id);
  const selectedFor = (asset: Asset): Level[] | undefined =>
    query.level
      ? [query.level]
      : query.activity && scopeFor(asset)?.every((mapping) => mapping.level)
        ? [...new Set(scopeFor(asset)!.map((mapping) => mapping.level!))]
        : undefined;
  if (query.report === "tagging") {
    rows = state.assets
      .filter(
        (asset) =>
          (!query.level || state.config.levels.includes(query.level)) &&
          (!query.activity || Boolean(scopeFor(asset)?.length)) &&
          (!query.level ||
            (query.activity
              ? Boolean(
                  scopeFor(asset)?.some((mapping) =>
                    !mapping.level
                      ? asset.levels.includes(query.level!)
                      : mapping.level === query.level,
                  ),
                )
              : asset.levels.includes(query.level))) &&
          match(supplier(asset), query.vendor) &&
          match(asset.discipline?.trim() || null, query.discipline) &&
          textMatches(
            asset.name,
            asset.id,
            asset.clientAssetId,
            asset.equipmentType,
            supplier(asset),
            asset.phase,
            asset.area,
          ),
      )
      .map((asset): TaggingReportRow => {
        const linkedTasks = tasks.filter(
            (task) => task.cx?.assetId === asset.id,
          ),
          progress = assetStepProgress(state, asset.id, selectedFor(asset)),
          openWorks = openWorksFor(asset.id);
        function statusFor(level?: Level) {
          const task = linkedTasks.find(
            (task) =>
              task.cx?.kind === "tag" && (!level || task.cx.level === level),
          );
          const reference = level
            ? (asset.levelActivities?.[level] ??
              task?.cx?.activityId ??
              asset.programmeActivityId)
            : (asset.programmeActivityId ?? task?.cx?.activityId);
          const primary = (primaryActivityKeys.get(asset.id) ?? [])
            .map((key) => byKey.get(key)!)
            .filter((row) => row.deadline)
            .sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0];
          const activity = query.activity
              ? resolve(query.activity)
              : (resolve(reference) ?? primary),
            steps = assetStepProgress(
              state,
              asset.id,
              level ?? selectedFor(asset),
            );
          if (steps.coverage === "not-applicable")
            return {
              status: "unknown" as const,
              colour: null,
              label: "Required steps not applicable",
            };
          return operationalStatus({
            due: activity?.deadline ?? task?.scheduleDueDate ?? task?.dueDate,
            completed: steps.complete,
            completedAt: steps.completedAt,
            openWorks,
            today,
          });
        }
        const levels = (selectedFor(asset) ?? asset.levels)
          .filter(
            (level) =>
              state.config.levels.includes(level) &&
              asset.levels.includes(level),
          )
          .filter((level) => !query.level || level === query.level)
          .map((level): TagLevelReport => ({
            level,
            progress: assetStepProgress(state, asset.id, level),
            status: statusFor(level),
            reviews: linkedTasks
              .filter(
                (task) => task.cx?.kind === "tag" && task.cx.level === level,
              )
              .map((task) => ({
                taskId: task.id,
                result: task.cx?.result ?? "untested",
                review: task.cx?.tagReview ?? null,
                href: `/tasks/${encodeURIComponent(task.id)}#test-sheet`,
              })),
            signatures: (state.checksheets?.sheets ?? [])
              .filter(
                (sheet) => sheet.assetId === asset.id && sheet.level === level,
              )
              .reduce(
                (total, sheet) =>
                  total +
                  sheet.signatures.filter(
                    (signature) => !signature.invalidatedAt,
                  ).length,
                0,
              ),
            sheets: (state.checksheets?.sheets ?? []).filter(
              (sheet) => sheet.assetId === asset.id && sheet.level === level,
            ).length,
          }));
        let status = query.level ? statusFor(query.level) : statusFor();
        if (!query.level && !asset.programmeActivityId && levels.length) {
          const late = levels.find((level) => level.status.status === "late");
          const unknown = levels.find(
            (level) => level.status.status === "unknown",
          );
          status =
            late?.status ??
            unknown?.status ??
            (progress.complete
              ? {
                  status: openWorks ? "remaining-work" : "complete",
                  colour: openWorks ? "orange" : "green",
                  label: openWorks
                    ? "Completed · remaining work open"
                    : "Completed on time",
                }
              : { status: "not-due", colour: null, label: "Not due" });
        }
        return {
          kind: "tagging",
          id: asset.id,
          assetId: asset.id,
          name: asset.name,
          equipmentType: asset.equipmentType,
          vendor: supplier(asset),
          discipline: asset.discipline?.trim() || null,
          phase: asset.phase ?? null,
          area: asset.area ?? null,
          progress,
          status,
          levels,
          openWorks,
          openIssues: linkedTasks.filter(
            (task) => task.cx?.kind === "issue" && !isClosed(task),
          ).length,
          signatures: (state.checksheets?.sheets ?? [])
            .filter(
              (sheet) =>
                sheet.assetId === asset.id &&
                sheet.level &&
                activeAssetLevels(state, asset).includes(sheet.level) &&
                (!selectedFor(asset) ||
                  (sheet.level && selectedFor(asset)!.includes(sheet.level))),
            )
            .reduce(
              (total, sheet) =>
                total +
                sheet.signatures.filter((signature) => !signature.invalidatedAt)
                  .length,
              0,
            ),
          href: assetHref(projectId, asset.id),
        };
      })
      .filter((row) =>
        matchesLate((row as TaggingReportRow).status, query.late),
      );
  } else if (query.report === "works-to-go") {
    rows = works
      .map((work): WorksReportRow => {
        const { asset, task, conflict, discipline } = workAsset(work),
          vendor = supplier(asset);
        if (!vendor) coverage.worksMissingVendor++;
        if (conflict || discipline === CONFLICT_REPORT_VALUE)
          coverage.worksDisciplineConflict++;
        return {
          kind: "works-to-go",
          id: work.id,
          name: work.title,
          notes: work.notes,
          assetId: asset?.id ?? null,
          assetName: asset?.name ?? null,
          vendor,
          discipline,
          attribution:
            conflict || discipline === CONFLICT_REPORT_VALUE
              ? "conflict"
              : asset
                ? "recorded"
                : "missing",
          status: work.status,
          taskId: task?.id ?? null,
          href: `/checksheets?projectId=${encodeURIComponent(projectId)}&work=${encodeURIComponent(work.id)}`,
        };
      })
      .filter(
        (row) =>
          (query.workStatus === "all" || row.status === query.workStatus) &&
          match(row.vendor, query.vendor) &&
          match(row.discipline, query.discipline) &&
          textMatches(
            row.name,
            row.notes,
            row.assetName,
            row.vendor,
            row.discipline,
          ),
      );
    notes.push(
      "Only saved Works to go records appear here. Open tasks are not substituted for remaining work. Discipline conflicts remain explicit.",
    );
  } else {
    const filteredActivities = windowRows.filter(
      (row) =>
        (!query.vendor ||
          (query.vendor === MISSING_REPORT_VALUE
            ? !row.assets.length || row.assets.some((asset) => !asset.vendor)
            : row.vendors.some((vendor) =>
                sameIdentity(vendor, query.vendor!),
              ))) &&
        (!query.discipline ||
          (query.discipline === MISSING_REPORT_VALUE
            ? !row.disciplines.length
            : row.disciplines.includes(query.discipline))) &&
        matchesLate(row.status, query.late) &&
        textMatches(
          row.name,
          row.activityId,
          ...row.vendors,
          ...row.disciplines,
        ),
    );
    if (query.report === "lookahead") rows = filteredActivities;
    else {
      const vendors = supplierLabels(
        filteredActivities.flatMap((row) => row.vendors),
      ).filter((vendor) => !query.vendor || sameIdentity(query.vendor, vendor));
      rows = vendors.map((vendor): VendorReportRow => {
        const linked = filteredActivities.filter((row) =>
            row.vendors.some((value) => sameIdentity(value, vendor)),
          ),
          assets = new Set(
            linked.flatMap((row) =>
              row.assets
                .filter(
                  (asset) => asset.vendor && sameIdentity(asset.vendor, vendor),
                )
                .map((asset) => asset.id),
            ),
          );
        return {
          kind: "vendors",
          id: vendor,
          name: vendor,
          vendor,
          activities: linked.length,
          assetCount: assets.size,
          start: linked.map((row) => row.start!).sort()[0] ?? null,
          finish:
            linked
              .map((row) => row.finish!)
              .sort()
              .at(-1) ?? null,
          sources: linked.map((row) => ({
            id: row.id,
            name: row.name,
            activityId: row.activityId,
            start: row.start,
            finish: row.finish,
            href: row.href,
          })),
          href: projectReportHref(projectId, {
            ...query,
            from: window.from,
            report: "lookahead",
            vendor,
            offset: 0,
          }),
        };
      });
      if (
        (!query.vendor || query.vendor === MISSING_REPORT_VALUE) &&
        filteredActivities.some(
          (row) =>
            !row.assets.length || row.assets.some((asset) => !asset.vendor),
        )
      ) {
        const unknown = filteredActivities.filter(
          (row) =>
            !row.assets.length || row.assets.some((asset) => !asset.vendor),
        );
        rows.push({
          kind: "vendors",
          id: MISSING_REPORT_VALUE,
          name: "Supplier not recorded / activity not linked",
          vendor: null,
          activities: unknown.length,
          assetCount: new Set(
            unknown.flatMap((row) =>
              row.assets
                .filter((asset) => !asset.vendor)
                .map((asset) => asset.id),
            ),
          ).size,
          start: unknown.map((row) => row.start!).sort()[0] ?? null,
          finish:
            unknown
              .map((row) => row.finish!)
              .sort()
              .at(-1) ?? null,
          sources: unknown.map((row) => ({
            id: row.id,
            name: row.name,
            activityId: row.activityId,
            start: row.start,
            finish: row.finish,
            href: row.href,
          })),
          href: projectReportHref(projectId, {
            ...query,
            from: window.from,
            report: "lookahead",
            vendor: MISSING_REPORT_VALUE,
            offset: 0,
          }),
        });
      }
      notes.push(
        "Suppliers are linked equipment suppliers needed by the saved activity window. This report does not assert supplier availability, bookings or commitments.",
      );
    }
    notes.push(
      `The ${window.days}-day window includes ongoing activities overlapping the window. Undated and overdue activities are counted separately; saved dates and calendars are not recalculated.`,
      "For completed imported-source activities, the validated saved planned target_end_date is the deadline. Without that planned target, timeliness is unknown; actual finish is never compared against itself. Open activities use their saved forecast or confirmed working-view finish.",
    );
  }
  rows.sort((a, b) =>
    a.kind === "lookahead" && b.kind === "lookahead"
      ? (a.start ?? "").localeCompare(b.start ?? "") || a.id.localeCompare(b.id)
      : a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
  coverage.ambiguousActivityReferences = ambiguous.size;
  if (coverage.sourceUnavailable)
    notes.push(
      "Imported source schedule metadata exists but the complete source index was unavailable. Source activities are not represented as zero.",
    );
  const resolvedQuery =
    query.report === "lookahead" || query.report === "vendors"
      ? { ...query, from: window.from }
      : query;
  const scopedActivity = query.activity ? resolve(query.activity) : undefined;
  const reportProgress =
    query.report === "tagging"
      ? aggregateStepProgress(
          (rows as TaggingReportRow[]).map((row) => row.progress),
        )
      : undefined;
  return {
    report: query.report,
    project: { id: project.id, name: project.name },
    query: resolvedQuery,
    total: rows.length,
    offset: query.offset,
    limit: query.limit,
    rows: paged ? rows.slice(query.offset, query.offset + query.limit) : rows,
    progress: reportProgress,
    activity: query.activity
      ? {
          id: query.activity,
          name: scopedActivity?.name ?? "Activity mapping unavailable",
          unknownReason: activityScope?.unknownReason,
        }
      : undefined,
    href: projectReportHref(projectId, resolvedQuery),
    revision: {
      register: state.version,
      sourceSha:
        index?.summary.sha256 ?? state.sourceProgrammeSummary?.sha256 ?? null,
    },
    generatedAt: now.toISOString(),
    timezone: "Europe/Amsterdam",
    window,
    facets: {
      vendors: supplierLabels(state.assets.map(supplier)),
      disciplines: unique([
        ...state.assets.map((asset) => asset.discipline?.trim()),
        ...tasks.map((task) => task.discipline?.trim()),
      ]),
      levels: [...state.config.levels],
    },
    coverage,
    notes,
  };
}

/** Export uses the complete filtered population in one immutable snapshot, never the current page. */
export function projectReportCsv(
  data: AppData,
  projectId: string,
  query: Partial<ProjectReportQuery>,
  options: ReportOptions = {},
) {
  const result = buildReportPopulation(data, projectId, query, options, false);
  const columns = [
    "Type",
    "Record ID",
    "Name",
    "Supplier",
    "Discipline",
    "Equipment type",
    "Tag levels / reviews",
    "Passed required steps",
    "Applicable required steps",
    "Explicit N/A steps",
    "Progress %",
    "Missing checksheets",
    "Active signatures",
    "Open issues",
    "Open works to go",
    "Status",
    "Start",
    "Finish",
    "Linked assets",
    "Activity ID",
    "Schedule source",
    "Link",
  ];
  const rows = result.rows.map((row) => {
    const values: unknown[] = [row.kind, row.id, row.name, row.vendor];
    if (row.kind === "tagging")
      values.push(
        row.discipline,
        row.equipmentType,
        row.levels
          .map(
            (level) =>
              `${level.level}: ${level.progress.passed}/${level.progress.required} required steps; reviews ${level.reviews.map((review) => review.review ?? "not recorded").join("; ")}`,
          )
          .join(" | "),
        row.progress.passed,
        row.progress.required,
        row.progress.notApplicable,
        row.progress.percent,
        row.progress.missingSheets,
        row.signatures,
        row.openIssues,
        row.openWorks,
        row.status.label,
        "",
        "",
        row.assetId,
        "",
        "",
        row.href,
      );
    else if (row.kind === "works-to-go")
      values.push(
        row.discipline,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        row.status,
        "",
        "",
        row.assetId,
        "",
        "",
        row.href,
      );
    else if (row.kind === "lookahead")
      values.push(
        row.disciplines.join("; "),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        row.status.label,
        row.start,
        row.finish,
        row.assets.map((asset) => asset.id).join("; "),
        row.activityId,
        row.source,
        row.href,
      );
    else
      values.push(
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        `${row.activities} activities; ${row.assetCount} assets`,
        row.start,
        row.finish,
        "",
        row.sources.map((activity) => activity.activityId).join("; "),
        "",
        row.href,
      );
    return values;
  });
  return {
    csv:
      "\ufeff" +
      [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n"),
    total: result.total,
    revision: result.revision,
  };
}

export type ActivityStepProgress = StepProgress & {
  assetIds: string[];
  levels: Level[];
  status: OperationalStatus;
  due?: string;
  unknownReason?: string;
  scope: { assetId: string; level?: Level }[];
};
/** Gantt stages use only the explicitly linked level, or an explicit primary asset link. */
export function activityStepProgress(
  state: Commissioning,
  tasks: Task[],
  activityId: string,
  today = projectDate(),
  sourceIndex?: SourceProgrammeIndex,
): ActivityStepProgress {
  const empty: StepProgress = {
    passed: 0,
    required: 0,
    totalRequired: 0,
    notApplicable: 0,
    percent: null,
    missingSheets: 1,
    complete: false,
    coverage: "missing",
  };
  const candidates = new Map<string, Set<string>>();
  const canonical = (reference: string, key: string) => {
    const keys = candidates.get(reference) ?? new Set<string>();
    keys.add(key);
    candidates.set(reference, keys);
  };
  const mirrored = new Map<string, string>();
  const working = workingLinks(state, sourceIndex);
  for (const added of working?.addedActivities ?? [])
    if (sourceIndex?.byId.has(added.internalId))
      mirrored.set(
        added.activityId,
        reportActivityKey(
          "source",
          added.internalId,
          sourceIndex.summary.sha256,
        ),
      );
  for (const row of sourceIndex?.activities ?? []) {
    const key = reportActivityKey(
      "source",
      row.internalId,
      sourceIndex!.summary.sha256,
    );
    canonical(key, key);
    canonical(row.activityId, key);
  }
  for (const row of state.schedule) {
    const key =
      mirrored.get(row.activityId) ??
      reportActivityKey("managed", row.activityId);
    canonical(key, key);
    canonical(row.activityId, key);
    canonical(reportActivityKey("managed", row.activityId), key);
  }
  const target = candidates.get(activityId);
  const key = target?.size === 1 ? [...target][0] : undefined;
  const unknown = (reason: string): ActivityStepProgress => ({
    ...empty,
    assetIds: [],
    levels: [],
    status: { status: "unknown", colour: null, label: reason },
    unknownReason: reason,
    scope: [],
  });
  if (!key)
    return unknown(
      target && target.size > 1
        ? "Activity reference is ambiguous"
        : "Activity has no verified mapping",
    );
  const refers = (reference?: string) =>
    Boolean(
      reference &&
      candidates.get(reference)?.size === 1 &&
      candidates.get(reference)?.has(key),
    );
  const mappings: { assetId: string; level?: Level }[] = [];
  const primaryAssets = new Set<string>();
  if (working) {
    for (const patch of working.activityPatches)
      if (workingActivityKey(working, sourceIndex, patch.internalId) === key)
        for (const assetId of patch.assetIds ?? []) primaryAssets.add(assetId);
    for (const added of working.addedActivities)
      if (workingActivityKey(working, sourceIndex, added.internalId) === key)
        primaryAssets.add(added.assetId);
  }
  for (const asset of state.assets) {
    if (primaryAssets.has(asset.id) || refers(asset.programmeActivityId)) {
      mappings.push({ assetId: asset.id });
      continue;
    }
    const levels = new Set<Level>();
    const activeLevels = activeAssetLevels(state, asset);
    for (const [level, reference] of Object.entries(
      asset.levelActivities ?? {},
    ))
      if (activeLevels.includes(level as Level) && refers(reference))
        levels.add(level as Level);
    for (const task of tasks.filter(
      (task) => task.cx?.assetId === asset.id && refers(task.cx.activityId),
    ))
      if (task.cx?.level && activeLevels.includes(task.cx.level))
        levels.add(task.cx.level);
    for (const level of levels) mappings.push({ assetId: asset.id, level });
  }
  if (!mappings.length) return unknown("No asset / checksheet stage mapping");
  const parts = mappings.map((mapping) =>
    assetStepProgress(state, mapping.assetId, mapping.level),
  );
  const passed = parts.reduce((total, part) => total + part.passed, 0),
    required = parts.reduce((total, part) => total + part.required, 0),
    missingSheets = parts.reduce(
      (total, part) => total + part.missingSheets,
      0,
    );
  const complete = required > 0 && passed === required && missingSheets === 0;
  const sourceRow = sourceIndex?.activities.find(
    (row) =>
      reportActivityKey(
        "source",
        row.internalId,
        sourceIndex.summary.sha256,
      ) === key,
  );
  const managed = state.schedule.find(
    (row) => reportActivityKey("managed", row.activityId) === key,
  );
  const due = sourceRow
    ? sourceActivityDeadline(sourceIndex!, sourceRow.internalId)
    : managed?.finish;
  const completedAt = complete
    ? parts
        .map((part) => part.completedAt)
        .filter((date): date is string => Boolean(date))
        .sort()
        .at(-1)
    : undefined;
  const assetIds = [...new Set(mappings.map((mapping) => mapping.assetId))];
  const openWorks = (state.checksheets?.worksToGo ?? []).filter(
    (work) =>
      work.status === "open" &&
      (assetIds.includes(work.assetId ?? "") ||
        tasks.some(
          (task) =>
            task.id === work.taskId &&
            assetIds.includes(task.cx?.assetId ?? ""),
        )),
  ).length;
  return {
    scope: mappings,
    passed,
    required,
    totalRequired: parts.reduce((total, part) => total + part.totalRequired, 0),
    notApplicable: parts.reduce((total, part) => total + part.notApplicable, 0),
    percent: required ? Math.round((passed / required) * 100) : null,
    missingSheets,
    complete,
    coverage: parts.every((part) => part.coverage === "missing")
      ? "missing"
      : missingSheets
        ? "partial"
        : required === 0 && parts.length > 0
          ? "not-applicable"
          : "complete",
    completedAt,
    assetIds,
    levels: [
      ...new Set(
        mappings.flatMap((mapping) => (mapping.level ? [mapping.level] : [])),
      ),
    ],
    due,
    status:
      required === 0 && !missingSheets
        ? {
            status: "unknown",
            colour: null,
            label: "Required steps not applicable",
          }
        : operationalStatus({
            due,
            completedAt,
            completed: complete,
            openWorks,
            today,
          }),
  };
}
