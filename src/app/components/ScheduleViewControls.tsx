"use client";

import { ChevronDown } from "lucide-react";
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

/** A single disclosure keeps view settings on the same page in both Schedule variants. */
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
    <details className="group w-full min-w-0 border-t pt-2">
      <summary className="inline-flex min-h-11 max-w-full cursor-pointer list-none items-center gap-3 rounded-md border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-700 [&::-webkit-details-marker]:hidden">
        <span className="font-medium">Timeline</span>
        <span className="min-w-0 truncate text-xs text-slate-600">
          {{ day: "Days", week: "Weeks", month: "Months" }[view.scale]} ·{" "}
          {view.horizon ? `${view.horizon / 7} weeks` : "Auto"}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-slate-600 group-open:rotate-180"
        />
      </summary>
      <div
        role="group"
        aria-label="Schedule view settings"
        className="mt-2 min-w-0 space-y-2 border-t border-slate-200 pt-3"
      >
        <div className="grid min-w-0 grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
          <label className="min-w-0 text-xs font-medium text-slate-700">
            Time units
            <select
              aria-label="Timeline time units"
              value={view.scale}
              onChange={(event) =>
                onCommand({
                  type: "scale",
                  scale: event.target.value as SourceGanttViewState["scale"],
                })
              }
              className="field-select mt-1 min-h-11 w-full text-sm sm:w-32"
            >
              <option value="day">Days</option>
              <option value="week">Weeks</option>
              <option value="month">Months</option>
            </select>
          </label>
          <label className="min-w-0 text-xs font-medium text-slate-700">
            Visible range
            <select
              aria-label="Timeline visible range"
              value={view.horizon ?? "auto"}
              onChange={(event) =>
                onCommand({
                  type: "horizon",
                  horizon:
                    event.target.value === "auto"
                      ? null
                      : (Number(event.target.value) as 14 | 28 | 42),
                })
              }
              className="field-select mt-1 min-h-11 w-full text-sm sm:w-36"
            >
              <option value="auto">Automatic</option>
              <option value="14">2 weeks</option>
              <option value="28">4 weeks</option>
              <option value="42">6 weeks</option>
            </select>
          </label>
          <label className="min-w-0 text-xs font-medium text-slate-700">
            Duration
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
              className="field-select mt-1 min-h-11 w-full text-sm sm:w-32"
            >
              <option value="days">Days</option>
              <option value="hours" disabled={managed}>
                {managed ? "Hours unavailable" : "Hours"}
              </option>
              <option value="hidden">Hidden</option>
            </select>
          </label>
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
        <p className="text-xs leading-5 text-slate-600">
          Time units set the ruler detail. Visible range sets the total period
          shown.
        </p>
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
              <span className="min-w-0 break-words">
                {columnLabels[column]}
              </span>
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
    </details>
  );
}
