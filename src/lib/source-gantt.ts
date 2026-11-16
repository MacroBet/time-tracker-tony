import type { SourceActivityView } from "./programme-source";
import { dayNumber } from "./scheduling";
import { z } from "zod";
import { ganttAxis } from "./gantt-axis";
import type { SourceCriticality } from "./source-criticality";

const dateSchema = z.iso.date();
export const sourceGanttColumns = [
  "progress",
  "start",
  "finish",
  "wbs",
  "calendar",
] as const;
export type SourceGanttColumn = (typeof sourceGanttColumns)[number];
export const sourceGanttViewSchema = z
  .object({
    anchor: dateSchema,
    scale: z.enum(["day", "week", "month"]),
    horizon: z.union([z.literal(14), z.literal(28), z.literal(42), z.null()]),
    durationMode: z.enum(["days", "hours", "hidden"]),
    columns: z.array(z.enum(sourceGanttColumns)).max(5),
    showLinks: z.boolean(),
    critical: z.enum(["all", "yes", "no", "unknown"]).default("all"),
  })
  .strict();
export type SourceGanttViewState = z.infer<typeof sourceGanttViewSchema>;
export type SourceDurationMode = SourceGanttViewState["durationMode"];
export const sourceGanttViewCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("show") }).strict(),
  z.object({ type: z.literal("date"), date: dateSchema }).strict(),
  z.object({ type: z.literal("today") }).strict(),
  z
    .object({
      type: z.literal("pan"),
      direction: z.union([z.literal(-1), z.literal(1)]),
    })
    .strict(),
  z
    .object({
      type: z.literal("scale"),
      scale: sourceGanttViewSchema.shape.scale,
    })
    .strict(),
  z
    .object({
      type: z.literal("horizon"),
      horizon: sourceGanttViewSchema.shape.horizon,
    })
    .strict(),
  z
    .object({
      type: z.literal("duration"),
      mode: sourceGanttViewSchema.shape.durationMode,
    })
    .strict(),
  z
    .object({
      type: z.literal("column"),
      column: z.enum(sourceGanttColumns),
      visible: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal("links"), visible: z.boolean() }).strict(),
  z
    .object({
      type: z.literal("critical"),
      filter: z.enum(["all", "yes", "no", "unknown"]),
    })
    .strict(),
  z.object({ type: z.literal("reset") }).strict(),
]);
export type SourceGanttViewCommand = z.infer<
  typeof sourceGanttViewCommandSchema
>;
/** Validate the whole intent before applying any supported subset. */
export function assertScheduleViewCommands(
  commands: readonly SourceGanttViewCommand[],
  kind: "source" | "managed",
) {
  if (!commands.length) throw Error("No Schedule view command was provided.");
  if (kind !== "managed") return;
  for (const command of commands) {
    if (command.type === "critical")
      throw Error(
        "P6 criticality is unavailable in this managed Schedule. Open a project with a saved P6 source.",
      );
    if (
      command.type === "column" &&
      ["wbs", "calendar"].includes(command.column)
    )
      throw Error(
        `The ${command.column === "wbs" ? "WBS" : "calendar"} column is unavailable in this managed Schedule. No source values have been recorded.`,
      );
    if (command.type === "duration" && command.mode === "hours")
      throw Error(
        "This managed Schedule records duration in working days, without saved source hours. Choose Days or Hidden.",
      );
  }
}

/** Project defaults affect display only. Opening/resetting always starts on the project date. */
export function sourceGanttInitialView(
  today: string,
  defaults: Partial<SourceGanttViewState> = {},
): SourceGanttViewState {
  return sourceGanttViewSchema.parse({
    scale: "day",
    horizon: null,
    durationMode: "days",
    columns: ["progress", "start", "finish", "wbs"],
    showLinks: true,
    critical: "all",
    ...defaults,
    anchor: today,
  });
}
export function shiftSourceDate(date: string, days: number) {
  return new Date((dayNumber(date) + days) * 86400000)
    .toISOString()
    .slice(0, 10);
}
/** The controls and view commands share this reducer; it never edits an activity. */
export function reduceSourceGanttView(
  state: SourceGanttViewState,
  command: SourceGanttViewCommand,
  today: string,
  defaults: Partial<SourceGanttViewState> = {},
): SourceGanttViewState {
  switch (command.type) {
    case "show":
      return state;
    case "date":
      return { ...state, anchor: command.date };
    case "today":
      return { ...state, anchor: today };
    case "pan":
      return {
        ...state,
        anchor: shiftSourceDate(
          state.anchor,
          command.direction *
            ganttAxis(state.anchor, state.scale, state.horizon).span,
        ),
      };
    case "scale":
      return { ...state, scale: command.scale };
    case "horizon":
      return { ...state, horizon: command.horizon };
    case "duration":
      return { ...state, durationMode: command.mode };
    case "column":
      return {
        ...state,
        columns: sourceGanttColumns.filter((column) =>
          column === command.column
            ? command.visible
            : state.columns.includes(column),
        ),
      };
    case "links":
      return { ...state, showLinks: command.visible };
    case "critical":
      return { ...state, critical: command.filter };
    case "reset":
      return sourceGanttInitialView(today, defaults);
  }
}
/** The sticky activity name covers metadata while panning, never the first visible chart date. */
export function sourceViewport({
  scrollLeft,
  clientWidth,
  nameWidth,
  otherColumnsWidth,
  axisWidth,
  unit,
}: {
  scrollLeft: number;
  clientWidth: number;
  nameWidth: number;
  otherColumnsWidth: number;
  axisWidth: number;
  unit: number;
}) {
  const from = Math.max(0, Math.min(axisWidth, scrollLeft - otherColumnsWidth));
  return {
    from,
    to: Math.max(
      from,
      Math.min(
        axisWidth,
        scrollLeft + clientWidth - nameWidth - otherColumnsWidth,
      ),
    ),
    dayOffset: Math.floor(from / unit),
  };
}

/** Human-readable source provenance, separate from commissioning lateness/progress. */
export function sourceCriticalityLabel(value?: SourceCriticality) {
  const reason = {
    "missing-project-criterion": "project criterion not recorded",
    "unsupported-project-criterion": "saved project criterion is not supported",
    "missing-float-threshold": "float threshold not recorded",
    "missing-total-float": "total float not recorded",
    "invalid-total-float": "total float is invalid",
    "not-in-p6-source": "activity is not in the P6 source",
    "saved-total-float": "saved total float",
  };
  if (!value || value.state === "unknown")
    return `Saved P6 criticality unknown: ${value ? reason[value.reason] : "classification not recorded"}`;
  return `Saved P6 ${value.state === "critical" ? "critical" : "non-critical"} activity. Total float ${value.totalFloatHours ?? "not recorded"} source hours; free float ${value.freeFloatHours ?? "not recorded"} source hours`;
}

/** Position the source view, without changing any source date or duration. */
export function sourcePageAnchor(rows: readonly SourceActivityView[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const date = row.start ?? row.finish;
    if (date) counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  // A few long-running procurement rows must not hide the page's main work.
  // Pick a recorded date cluster; ties use the earliest date, never today.
  const dates = [...counts.keys()].sort(
    (a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b),
  );
  return dates[0]
    ? new Date((dayNumber(dates[0]) - 2) * 86400000).toISOString().slice(0, 10)
    : undefined;
}
export function sourceBar(
  row: SourceActivityView,
  anchor: string,
  span: number,
  unit: number,
) {
  const date = row.start ?? (row.milestone ? row.finish : undefined);
  if (!date) return undefined;
  const start = dayNumber(date) - dayNumber(anchor);
  const finish = row.milestone
    ? start
    : row.finish
      ? dayNumber(row.finish) - dayNumber(anchor)
      : start;
  if (finish < start || start >= span || finish < 0) return undefined;
  return {
    left: Math.max(0, start) * unit,
    width: row.milestone
      ? 12
      : Math.max(2, (Math.min(span, finish + 1) - Math.max(0, start)) * unit),
    start,
    finish,
  };
}
