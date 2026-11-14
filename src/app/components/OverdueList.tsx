"use client";
import { useState } from "react";
import Link from "next/link";
import { dueDateFor, filterTasks } from "@/lib/commissioning";
import {
  projectDate,
  statusLabels,
  type Project,
  type Task,
} from "@/lib/domain";
import { taskProgress } from "@/lib/dashboard-progress";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { InfoPopover } from "./InfoPopover";

export function OverdueList({
  project,
  tasks,
}: {
  project: Project;
  tasks: Task[];
}) {
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(0);
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  const summary = taskProgress(projectTasks);
  const overdue = filterTasks(tasks, project, { attention: "overdue" });
  const matches = filterTasks(tasks, project, {
    attention: "overdue",
    query,
    priority,
  }).sort(
    (a, b) =>
      (dueDateFor(a) ?? "").localeCompare(dueDateFor(b) ?? "") ||
      a.id.localeCompare(b.id),
  );
  const pageSize = 25;
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const displayed = matches.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  return (
    <section
      className="rounded-xl border bg-white p-4 sm:p-5"
      aria-label="Overdue list"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Overdue work</h2>
          <p className="mt-1 text-sm text-slate-600">
            {overdue.length} overdue · As of {projectDate()}
          </p>
        </div>
        <InfoPopover label="About overdue work">
          <p>
            Open tasks and their linked app activities only. Imported P6
            activities are not included in this list.
          </p>
          <p>
            The saved schedule deadline takes precedence; otherwise the task
            deadline is used. Due today is not overdue. {summary.undated} open
            activities have no deadline and are excluded.
          </p>
        </InfoPopover>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Open tasks and linked app activities · Imported P6 activities excluded
      </p>
      {overdue.length > 0 && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1 text-sm">
            Search overdue activities
            <Input
              className="mt-1 h-11"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder="Task, asset or Activity ID"
            />
          </label>
          <label className="text-sm">
            Priority
            <select
              className="field-select mt-1 min-h-11 sm:min-w-36"
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                setPage(0);
              }}
            >
              <option value="">All priorities</option>
              {[
                ...new Set(
                  overdue.flatMap((task) =>
                    task.priority ? [task.priority] : [],
                  ),
                ),
              ]
                .sort()
                .map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}
      <div className="mt-4 divide-y">
        {displayed.map((task) => (
          <Link
            key={task.id}
            href={`/tasks/${task.id}`}
            className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 hover:text-blue-700 focus-visible:outline-blue-600"
          >
            <span className="min-w-0 flex-1 basis-52">
              <span className="block break-words text-sm font-medium">
                {task.title}
              </span>
              <span className="mt-1 block break-words text-xs text-slate-600">
                {task.cx?.assetId || "No asset link"} ·{" "}
                {task.cx?.level || "No stage"} ·{" "}
                {task.priority || "No priority"} · {statusLabels[task.status]}
              </span>
            </span>
            <span className="text-xs tabular-nums text-red-700">
              Due {dueDateFor(task)}
              <span className="mt-1 block text-slate-600">
                {task.scheduleDueDate ? "Schedule date" : "Task deadline"}
              </span>
            </span>
          </Link>
        ))}
      </div>
      {!displayed.length && (
        <div className="py-6">
          <h3 className="text-base font-semibold">
            {overdue.length
              ? "No matching overdue activities"
              : "No overdue activities"}
          </h3>
          <p className="mt-2 max-w-prose text-sm text-slate-600">
            {overdue.length
              ? "Try another search or priority. The project overdue list is unchanged."
              : "No open activity with a recorded deadline is due before today. Open the timeline to review upcoming dates."}
          </p>
          {overdue.length ? (
            <Button
              variant="outline"
              className="mt-4 min-h-11"
              onClick={() => {
                setQuery("");
                setPriority("");
                setPage(0);
              }}
            >
              Clear filters
            </Button>
          ) : (
            <Button variant="outline" asChild className="mt-4 min-h-11">
              <Link href="/schedule">Open timeline</Link>
            </Button>
          )}
        </div>
      )}
      {matches.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-slate-600">
          <span>
            {currentPage * pageSize + 1}–
            {Math.min((currentPage + 1) * pageSize, matches.length)} of{" "}
            {matches.length} activities
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={!currentPage}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span>
              Page {currentPage + 1} of {pages}
            </span>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
