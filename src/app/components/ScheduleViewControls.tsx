"use client";

import {
  sourceGanttColumns,
  type SourceGanttColumn,
  type SourceGanttViewCommand,
  type SourceGanttViewState,
} from "@/lib/source-gantt";
import { Button } from "./ui/button";

const columnLabels: Record<SourceGanttColumn, string> = {
  progress: "Step %",
  start: "Start",
  finish: "Finish",
  wbs: "WBS",
  calendar: "Calendar",
};

/** The same view reducer controls both Schedule variants, without a settings menu. */
export function ScheduleViewControls({
  view,
  onCommand,
  managed = false,
}: {
  view: SourceGanttViewState;
  onCommand: (command: SourceGanttViewCommand) => void;
  managed?: boolean;
}) {
  const columns = managed
    ? sourceGanttColumns.filter((column) =>
        ["progress", "start", "finish"].includes(column),
      )
    : sourceGanttColumns;
  return (
    <div
      role="group"
      aria-label="Schedule view settings"
      className="w-full min-w-0 space-y-2 border-t pt-2"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 sm:flex sm:flex-wrap sm:gap-x-4 sm:gap-y-2">
        <div
          role="group"
          aria-label="Gantt scale"
          className="flex min-w-0 items-center gap-1"
        >
          <span className="mr-1 hidden text-xs text-slate-600 sm:inline">
            Scale
          </span>
          {(["day", "week", "month"] as const).map((scale) => (
            <Button
              key={scale}
              variant={view.scale === scale ? "default" : "outline"}
              className="min-h-11 px-2 text-xs sm:px-3 sm:text-sm"
              aria-pressed={view.scale === scale}
              onClick={() => onCommand({ type: "scale", scale })}
            >
              {{ day: "Day", week: "Week", month: "Month" }[scale]}
            </Button>
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-xs text-slate-600">
          <span className="sr-only sm:not-sr-only">Duration</span>
          <select
            aria-label="Duration display"
            value={view.durationMode}
            onChange={(event) =>
              onCommand({
                type: "duration",
                mode: event.target
                  .value as SourceGanttViewState["durationMode"],
              })
            }
            className="field-select min-h-11 w-20 px-2 text-xs sm:w-24 sm:text-sm"
          >
            <option value="days">Days</option>
            <option value="hours" disabled={managed}>
              {managed ? "Hours unavailable" : "Hours"}
            </option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <div
          role="group"
          aria-label="Gantt date window"
          className="flex min-w-0 items-center gap-1"
        >
          <span className="mr-1 text-xs text-slate-600">Window</span>
          {([null, 14, 28, 42] as const).map((horizon) => (
            <Button
              key={horizon ?? "auto"}
              variant={view.horizon === horizon ? "default" : "outline"}
              className="min-h-11 px-2 text-xs sm:px-3 sm:text-sm"
              aria-pressed={view.horizon === horizon}
              onClick={() => onCommand({ type: "horizon", horizon })}
            >
              {horizon ? `${horizon / 7}wk` : "Auto"}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          className="min-h-11 px-2 text-xs sm:px-3 sm:text-sm"
          onClick={() => onCommand({ type: "reset" })}
          aria-label="Reset view"
        >
          <span className="sm:hidden">Reset</span>
          <span className="hidden sm:inline">Reset view</span>
        </Button>
      </div>
      <div
        role="group"
        aria-label="Visible schedule columns"
        className="grid min-w-0 grid-cols-3 items-center gap-x-3 gap-y-1 sm:flex sm:flex-wrap sm:gap-x-4"
      >
        <span className="sr-only col-span-3 text-xs text-slate-600 sm:not-sr-only sm:col-auto">
          Show columns
        </span>
        {columns.map((column) => (
          <label
            key={column}
            className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 text-xs sm:text-sm"
          >
            <input
              type="checkbox"
              className="size-4 shrink-0 accent-blue-700"
              aria-label={`Show ${columnLabels[column]} column`}
              checked={view.columns.includes(column)}
              onChange={(event) =>
                onCommand({
                  type: "column",
                  column,
                  visible: event.target.checked,
                })
              }
            />
            <span className="min-w-0 break-words">{columnLabels[column]}</span>
          </label>
        ))}
        <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 text-xs sm:text-sm">
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-blue-700"
            checked={view.showLinks}
            onChange={(event) =>
              onCommand({ type: "links", visible: event.target.checked })
            }
          />
          <span className="min-w-0 break-words">Dependency links</span>
        </label>
      </div>
    </div>
  );
}
