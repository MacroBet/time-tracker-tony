"use client";
import { dueDateFor, commissioning, taskAsset } from "@/lib/commissioning";
import { useRef, useState } from "react";
import {
  taskManagedDates,
  taskStepSummary,
  taskTableColumns,
  toggleTaskColumn,
  type TaskTableColumn,
} from "@/lib/task-board";
import { TaskQuickDetail, TaskStepIndicator } from "./TaskQuickDetail";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Download,
  UserRound,
} from "lucide-react";
import { useApp } from "../contexts/AppContext";
import {
  type Task,
  isClosed,
  isOverdue,
  statusLabels,
  projectDate,
} from "@/lib/domain";
import { tasksCsv } from "@/lib/csv";
import { AssignmentDialog } from "./AssignmentDialog";
import { TaskStatusBadge } from "./TaskBoard";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Queue = "unassigned" | "assigned" | "review" | "closed" | "all";
const queues: { id: Queue; label: string; description: string }[] = [
  {
    id: "unassigned",
    label: "Unassigned",
    description: "Open activities that need a responsible worker.",
  },
  {
    id: "assigned",
    label: "Assigned",
    description:
      "Active work with a responsible worker. Follow progress or hand it over.",
  },
  {
    id: "review",
    label: "To review",
    description: "Delivered work waiting for your review.",
  },
  {
    id: "closed",
    label: "Closed",
    description: "Completed and not applicable activities.",
  },
  {
    id: "all",
    label: "All activities",
    description: "All activities in your supervised projects.",
  },
];
const inQueue = (t: Task, q: Queue) =>
  q === "all" ||
  (q === "unassigned"
    ? !t.assignedTo && !isClosed(t)
    : q === "assigned"
      ? !!t.assignedTo && !isClosed(t)
      : q === "review"
        ? t.status === "review"
        : isClosed(t));
export function ManagementBoard() {
  const data = useApp();
  const { tasks, users, companies, projects } = data;
  const [queue, setQueue] = useState<Queue>("unassigned"),
    [query, setQuery] = useState(""),
    [project, setProject] = [data.selectedProjectId, data.selectProject],
    [company, setCompany] = useState("all"),
    [person, setPerson] = useState("all"),
    [status, setStatus] = useState("all"),
    [priority, setPriority] = useState("all"),
    [level, setLevel] = useState("all"),
    [equipment, setEquipment] = useState("all"),
    [dueFrom, setDueFrom] = useState(""),
    [dueTo, setDueTo] = useState(""),
    [overdue, setOverdue] = useState(false),
    [filters, setFilters] = useState(false),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<string[]>([]),
    [detail, setDetail] = useState<string | null>(null),
    [sort, setSort] = useState("priority");
  const [columns, setColumns] = useState<TaskTableColumn[]>(
    taskTableColumns.map((column) => column.id),
  );
  const detailTrigger = useRef<HTMLElement | null>(null);
  function openDetail(id: string, event: React.MouseEvent<HTMLButtonElement>) {
    detailTrigger.current = event.currentTarget;
    setDetail(id);
  }
  const currentProject = projects.find((p) => p.id === project);
  const register = commissioning(currentProject);
  const owner = (t: Task) =>
    users.find((u) => u.id === t.assignedTo)?.name ||
    (t.assignedTo ? "Assigned worker" : "Unassigned");
  const scoped = tasks.filter(
    (t) =>
      (project === "all" || t.projectId === project) &&
      (company === "all" || t.companyId === company) &&
      (person === "all" || t.assignedTo === person) &&
      (status === "all" || t.status === status) &&
      (priority === "all" || t.priority === priority) &&
      (level === "all" || t.cx?.level === level) &&
      (equipment === "all" ||
        taskAsset(t, currentProject)?.equipmentType === equipment) &&
      (!dueFrom || (!!dueDateFor(t) && dueDateFor(t)! >= dueFrom)) &&
      (!dueTo || (!!dueDateFor(t) && dueDateFor(t)! <= dueTo)) &&
      (!overdue || isOverdue(t)) &&
      [
        t.title,
        t.externalId,
        t.id,
        t.cx?.assetId,
        t.cx?.activityId,
        t.cx?.qualityTag,
        t.location,
        owner(t),
        companies.find((c) => c.id === t.companyId)?.name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const filtered = scoped
    .filter((t) => inQueue(t, queue))
    .sort((a, b) =>
      sort === "updated"
        ? b.updatedAt.localeCompare(a.updatedAt)
        : sort === "due"
          ? (dueDateFor(a) || "9999").localeCompare(dueDateFor(b) || "9999")
          : (a.priority || "P9").localeCompare(b.priority || "P9") ||
            (dueDateFor(a) || "9999").localeCompare(dueDateFor(b) || "9999"),
    );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 20) - 1),
  );
  const visible = filtered.slice(currentPage * 20, currentPage * 20 + 20);
  const selection = filtered.filter((t) => selected.includes(t.id));
  function equipmentLabel(task: Task) {
    const asset = taskAsset(
      task,
      projects.find((project) => project.id === task.projectId),
    );
    return task.cx?.assetId
      ? `${asset?.name || task.cx.assetId}${task.cx.level ? ` · ${task.cx.level}` : ""}`
      : null;
  }

  function resetSelection() {
    setPage(0);
    setSelected([]);
  }
  function clearFilters() {
    setCompany("all");
    setPerson("all");
    setStatus("all");
    setPriority("all");
    setLevel("all");
    setEquipment("all");
    setDueFrom("");
    setDueTo("");
    setOverdue(false);
    setQuery("");
    resetSelection();
  }
  function toggle(id: string) {
    setSelected(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  }
  function selectFilter(
    label: string,
    value: string,
    set: (v: string) => void,
    options: { id: string; name: string }[],
  ) {
    return (
      <label className="text-xs text-slate-600 space-y-1">
        {label}
        <select
          aria-label={label}
          className="field-select bg-white"
          value={value}
          onChange={(e) => {
            set(e.target.value);
            resetSelection();
          }}
        >
          {label !== "Projects" && (
            <option value="all">All {label.toLowerCase()}</option>
          )}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  function exportRows() {
    const url = URL.createObjectURL(
      new Blob([tasksCsv(filtered, data)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `fieldtrack-${queue}-${projectDate()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const activeFilters =
    [company, person, status, priority, level, equipment].filter(
      (v) => v !== "all",
    ).length +
    Number(overdue) +
    Number(!!dueFrom) +
    Number(!!dueTo);
  const due = (t: Task) => (
    <span
      className={`text-xs ${isOverdue(t) ? "text-red-600 font-medium" : "text-slate-600"}`}
    >
      {dueDateFor(t)
        ? new Date(dueDateFor(t) + "T12:00:00").toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "2-digit",
          })
        : "No deadline"}
      {isOverdue(t) && <span className="block text-xs">Overdue</span>}
    </span>
  );
  return (
    <section aria-label="Project task manager" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Activity planner
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Assign work and follow responsibility.
          </p>
        </div>
        <div className="flex items-end gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:w-64">
            {selectFilter("Projects", project, setProject, projects)}
          </div>
          <Button asChild>
            <Link href="/create-task">New activity</Link>
          </Button>
        </div>
      </div>
      <div
        className="grid grid-cols-6 sm:flex gap-2"
        aria-label="Assignment queues"
      >
        {queues.map((q) => (
          <button
            key={q.id}
            aria-pressed={queue === q.id}
            onClick={() => {
              setQueue(q.id);
              setStatus("all");
              setPerson("all");
              resetSelection();
            }}
            className={`${q.id === "unassigned" || q.id === "assigned" ? "col-span-3" : "col-span-2"} text-left rounded-xl border px-3 sm:px-4 py-2 sm:py-3 sm:flex-1 transition-colors ${queue === q.id ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/15" : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"}`}
          >
            <span className="block text-xs font-medium">{q.label}</span>
            <span className="block mt-1 text-lg sm:text-2xl font-semibold tabular-nums">
              {scoped.filter((t) => inQueue(t, q.id)).length}
            </span>
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-4 border-b space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-3 size-4 text-slate-400" />
              <Input
                aria-label="Search project activities"
                placeholder="Search title, issue number, company or worker…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetSelection();
                }}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              aria-label="Activity filters"
              aria-expanded={filters}
              onClick={() => setFilters(!filters)}
            >
              <SlidersHorizontal className="size-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilters > 0 && <span>{activeFilters}</span>}
            </Button>
            <Button
              variant="ghost"
              aria-label="Export this queue"
              disabled={!filtered.length}
              onClick={exportRows}
            >
              <Download className="size-4" />
            </Button>
          </div>
          {filters && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {selectFilter("Companies", company, setCompany, companies)}
              {selectFilter(
                "Levels",
                level,
                setLevel,
                register.config.levels.map((id) => ({ id, name: id })),
              )}
              {selectFilter(
                "Equipment types",
                equipment,
                setEquipment,
                [...new Set(register.assets.map((a) => a.equipmentType))].map(
                  (id) => ({ id, name: id }),
                ),
              )}
              <label className="text-xs text-slate-600">
                Due from
                <Input
                  type="date"
                  value={dueFrom}
                  onChange={(e) => {
                    setDueFrom(e.target.value);
                    resetSelection();
                  }}
                />
              </label>
              <label className="text-xs text-slate-600">
                Due through
                <Input
                  type="date"
                  value={dueTo}
                  onChange={(e) => {
                    setDueTo(e.target.value);
                    resetSelection();
                  }}
                />
              </label>
              {selectFilter(
                "Workers",
                person,
                setPerson,
                users.filter((u) => u.role === "worker"),
              )}
              {selectFilter(
                "Statuses",
                status,
                setStatus,
                Object.entries(statusLabels).map(([id, name]) => ({
                  id,
                  name,
                })),
              )}
              {selectFilter(
                "Priorities",
                priority,
                setPriority,
                [
                  ...new Set([
                    ...register.config.priorities,
                    ...tasks
                      .filter((t) => t.projectId === project)
                      .flatMap((t) => (t.priority ? [t.priority] : [])),
                  ]),
                ].map((id) => ({ id, name: id })),
              )}
            </div>
          )}
          <details>
            <summary className="min-h-11 cursor-pointer content-center rounded text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-700">
              Visible columns ({columns.length} of {taskTableColumns.length})
            </summary>
            <div className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-3">
              {taskTableColumns.map((column) => (
                <label
                  key={column.id}
                  className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={columns.includes(column.id)}
                    disabled={column.id === "name"}
                    onChange={() =>
                      setColumns(toggleTaskColumn(columns, column.id))
                    }
                  />
                  {column.label}
                  {column.id === "name" && (
                    <span className="text-xs text-slate-600">Required</span>
                  )}
                </label>
              ))}
            </div>
          </details>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <p className="text-xs text-slate-600">
              {queues.find((q) => q.id === queue)?.description}
            </p>
            <div className="flex items-center gap-3">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={overdue}
                  onChange={(e) => {
                    setOverdue(e.target.checked);
                    resetSelection();
                  }}
                />
                Overdue only
              </label>
              <select
                aria-label="Sort activities"
                className="min-h-11 max-w-full rounded-md border bg-white px-3 text-sm"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  resetSelection();
                }}
              >
                <option value="priority">Priority first</option>
                <option value="due">Earliest deadline</option>
                <option value="updated">Recently updated</option>
              </select>
            </div>
          </div>
          {(activeFilters > 0 || query) && (
            <button
              className="inline-flex min-h-11 items-center rounded text-sm font-medium text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-blue-700"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
        {selection.length > 0 && (
          <div className="px-4 py-3 bg-blue-50 border-b flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-blue-900">
              {selection.length} selected
            </span>
            <AssignmentDialog tasks={selection} onSaved={() => setSelected([])}>
              Assign selected
            </AssignmentDialog>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Cancel selection
            </Button>
          </div>
        )}
        <div
          className="hidden overflow-x-auto lg:block focus-visible:outline-2 focus-visible:outline-blue-700"
          role="region"
          aria-label="Scrollable project activities"
          tabIndex={0}
        >
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Activities in the selected assignment queue. Required-step
              progress is separate from task status.
            </caption>
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th scope="col" className="p-1">
                  <label className="flex size-11 cursor-pointer items-center justify-center">
                    <input
                      aria-label="Select current page"
                      type="checkbox"
                      checked={
                        visible.length > 0 &&
                        visible.every((task) => selected.includes(task.id))
                      }
                      disabled={!visible.length}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? visible.map((task) => task.id)
                            : [],
                        )
                      }
                    />
                  </label>
                </th>
                {taskTableColumns
                  .filter((column) => columns.includes(column.id))
                  .map((column) => (
                    <th
                      key={column.id}
                      scope="col"
                      className="whitespace-nowrap px-3 py-3 font-medium"
                    >
                      {column.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((task) => {
                const taskProject = projects.find(
                  (row) => row.id === task.projectId,
                );
                const asset = taskAsset(task, taskProject);
                const plan = taskManagedDates(task, taskProject);
                return (
                  <tr
                    key={task.id}
                    className={`group align-top hover:bg-slate-50 ${selected.includes(task.id) || detail === task.id ? "bg-blue-50/50" : ""}`}
                  >
                    <td className="p-1">
                      <label className="flex size-11 cursor-pointer items-center justify-center">
                        <input
                          aria-label={`Select activity ${task.externalId || task.title}`}
                          type="checkbox"
                          checked={selected.includes(task.id)}
                          disabled={
                            !selected.includes(task.id) && selected.length >= 50
                          }
                          onChange={() => toggle(task.id)}
                        />
                      </label>
                    </td>
                    <th
                      scope="row"
                      className="min-w-56 max-w-sm px-3 py-2 font-normal"
                    >
                      <button
                        aria-label={`Open activity ${task.title}`}
                        aria-haspopup="dialog"
                        className="block min-h-11 w-full rounded text-left focus-visible:outline-2 focus-visible:outline-blue-700"
                        onClick={(event) => openDetail(task.id, event)}
                      >
                        <span className="block text-sm font-medium leading-snug text-slate-900 line-clamp-2 group-hover:text-blue-700">
                          {task.title}
                        </span>
                        <span className="mt-1 block break-words text-xs text-slate-600">
                          {task.cx?.activityId
                            ? `Activity: ${task.cx.activityId}`
                            : task.externalId
                              ? `External: ${task.externalId}`
                              : `Task: ${task.id}`}
                          {task.cx?.activityId &&
                          task.externalId &&
                          task.externalId !== task.cx.activityId
                            ? ` · External: ${task.externalId}`
                            : ""}
                        </span>
                      </button>
                    </th>
                    {columns.includes("progress") && (
                      <td className="px-3 py-1">
                        <TaskStepIndicator
                          summary={taskStepSummary(task, taskProject, tasks)}
                          onClick={(event) => openDetail(task.id, event)}
                        />
                      </td>
                    )}
                    {columns.includes("status") && (
                      <td className="px-3 py-3">
                        <TaskStatusBadge task={task} />
                      </td>
                    )}
                    {columns.includes("dates") && (
                      <td className="min-w-32 px-3 py-3">
                        {due(task)}
                        {plan?.start && (
                          <span className="mt-1 block whitespace-nowrap text-xs text-slate-600">
                            Start: {plan.start}
                          </span>
                        )}
                        {plan &&
                          "durationDays" in plan &&
                          plan.durationDays !== undefined && (
                            <span className="mt-1 block text-xs text-slate-600">
                              {plan.durationDays} days
                            </span>
                          )}
                      </td>
                    )}
                    {columns.includes("equipment") && (
                      <td className="min-w-36 max-w-xs px-3 py-3">
                        <span className="text-xs text-slate-700 line-clamp-2">
                          {equipmentLabel(task) || "No linked equipment"}
                        </span>
                        <span className="mt-1 block text-xs text-slate-600">
                          {task.location ||
                            asset?.location ||
                            "Area not recorded"}
                        </span>
                      </td>
                    )}
                    {columns.includes("responsible") && (
                      <td className="min-w-44 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span
                              className={`block text-xs ${task.assignedTo ? "text-slate-700" : "text-amber-700"}`}
                            >
                              {owner(task)}
                            </span>
                            <span className="mt-1 block text-xs text-slate-600">
                              {companies.find(
                                (company) => company.id === task.companyId,
                              )?.name || "Company not recorded"}
                            </span>
                            {!task.assignedTo && task.importData?.assignee && (
                              <span className="mt-1 block text-xs text-slate-600">
                                Report assignee: {task.importData.assignee}
                              </span>
                            )}
                          </div>
                          <div className="shrink-0">
                            <AssignmentDialog compact tasks={[task]}>
                              {task.assignedTo ? "Reassign" : "Assign"}
                            </AssignmentDialog>
                          </div>
                        </div>
                      </td>
                    )}
                    {columns.includes("priority") && (
                      <td className="min-w-28 px-3 py-3">
                        <span
                          className={`text-xs font-medium ${task.priority === "P1" ? "text-red-700" : "text-slate-700"}`}
                        >
                          {task.priority || "Not specified"}
                        </span>
                        <span className="mt-1 block text-xs text-slate-600">
                          {task.discipline || "Discipline not recorded"}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="lg:hidden divide-y divide-slate-100">
          {visible.map((t) => (
            <article key={t.id} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-slate-50">
                  <input
                    className="size-4"
                    aria-label={`Select activity ${t.externalId || t.title}`}
                    type="checkbox"
                    checked={selected.includes(t.id)}
                    disabled={!selected.includes(t.id) && selected.length >= 50}
                    onChange={() => toggle(t.id)}
                  />
                </label>
                <button
                  aria-label={`Open activity ${t.title}`}
                  className="min-h-11 min-w-0 flex-1 rounded text-left focus-visible:outline-2 focus-visible:outline-blue-700"
                  onClick={(event) => openDetail(t.id, event)}
                >
                  <span className="text-xs text-slate-600">
                    {t.cx?.activityId || t.externalId || t.id}
                    {columns.includes("priority")
                      ? ` · ${t.priority || "No priority"}`
                      : ""}
                  </span>
                  <h3 className="font-medium text-sm leading-snug mt-1">
                    {t.title}
                  </h3>
                  {columns.includes("responsible") && (
                    <p className="text-xs text-slate-600 mt-1 truncate">
                      {companies.find((c) => c.id === t.companyId)?.name}
                    </p>
                  )}
                  {columns.includes("equipment") && equipmentLabel(t) && (
                    <p className="mt-1 text-xs text-slate-600">
                      Equipment: {equipmentLabel(t)}
                    </p>
                  )}
                </button>
              </div>
              <div className="flex justify-between items-center gap-2">
                {columns.includes("progress") && (
                  <TaskStepIndicator
                    summary={taskStepSummary(
                      t,
                      projects.find((row) => row.id === t.projectId),
                      tasks,
                    )}
                    onClick={(event) => openDetail(t.id, event)}
                  />
                )}
                {columns.includes("status") && <TaskStatusBadge task={t} />}
                {columns.includes("dates") && due(t)}
              </div>
              <div className="border-t pt-3 flex items-center justify-between gap-2">
                {columns.includes("responsible") && (
                  <span
                    className={`text-xs ${t.assignedTo ? "text-slate-700" : "text-amber-700"}`}
                  >
                    {owner(t)}
                  </span>
                )}
                <AssignmentDialog compact tasks={[t]}>
                  {t.assignedTo ? "Reassign" : "Assign worker"}
                </AssignmentDialog>
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <div className="p-8 text-center sm:p-12">
            <UserRound className="size-8 mx-auto text-slate-300 mb-3" />
            <h3 className="font-medium">No activities in this view</h3>
            <p className="text-sm text-slate-600 mt-1">
              Choose another queue or clear your filters.
            </p>
          </div>
        )}
        <div className="border-t px-4 py-3 flex justify-between items-center text-xs text-slate-600">
          <span>
            {filtered.length
              ? `${currentPage * 20 + 1}–${Math.min((currentPage + 1) * 20, filtered.length)} of ${filtered.length}`
              : "0 activities"}
          </span>
          <div className="flex gap-1">
            <Button
              aria-label="Previous page"
              size="icon"
              variant="ghost"
              disabled={currentPage === 0}
              onClick={() => {
                setPage(currentPage - 1);
                setSelected([]);
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              aria-label="Next page"
              size="icon"
              variant="ghost"
              disabled={(currentPage + 1) * 20 >= filtered.length}
              onClick={() => {
                setPage(currentPage + 1);
                setSelected([]);
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
      <TaskQuickDetail
        taskId={detail}
        onClose={() => setDetail(null)}
        returnFocus={() =>
          detailTrigger.current?.focus({ preventScroll: true })
        }
      />
    </section>
  );
}
