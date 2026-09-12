"use client";
import { AssignmentDialog } from "./AssignmentDialog";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ListTodo,
  ChevronRight,
  Download,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useApp } from "../contexts/AppContext";
import {
  type Task,
  isClosed,
  isOverdue,
  isStale,
  projectDate,
  statusLabels,
} from "@/lib/domain";
import { tasksCsv } from "@/lib/csv";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
export function TaskStatusBadge({ task }: { task: Task }) {
  const colors = {
    pending: "bg-amber-50 text-amber-800",
    "in-progress": "bg-blue-50 text-blue-700",
    blocked: "bg-red-50 text-red-700",
    review: "bg-purple-50 text-purple-700",
    completed: "bg-emerald-50 text-emerald-700",
    "not-applicable": "bg-slate-100 text-slate-600",
  };
  return (
    <Badge className={`${colors[task.status]} whitespace-nowrap border-0`}>
      {statusLabels[task.status]}
    </Badge>
  );
}
export function TaskBoard({
  management = false,
  initialLimit = 24,
  preview = false,
}: {
  management?: boolean;
  initialLimit?: number;
  preview?: boolean;
}) {
  const data = useApp();
  const params = useSearchParams();
  const { tasks, users, companies, projects, currentUser } = data;
  const [selected, setSelected] = useState<string[]>([]);
  const [limit, setLimit] = useState(initialLimit);
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("all");
  const [company, setCompany] = useState("all");
  const [person, setPerson] = useState("all");
  const [priority, setPriority] = useState("all");
  const [status, setStatus] = useState(
    params.get("status") === "completed" ? "completed" : "all",
  );
  const [discipline, setDiscipline] = useState("all");
  const [due, setDue] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtered = tasks
    .filter((t) => {
      const text = [
        t.title,
        t.description,
        t.externalId,
        t.location,
        t.importData?.assignee,
        t.importData?.status,
        users.find((u) => u.id === t.assignedTo)?.name,
      ]
        .join(" ")
        .toLowerCase();
      return (
        text.includes(query.trim().toLowerCase()) &&
        (project === "all" || t.projectId === project) &&
        (company === "all" || t.companyId === company) &&
        (person === "all" || t.assignedTo === person) &&
        (priority === "all" || (t.priority || "unspecified") === priority) &&
        (status === "all" ||
          t.status === status ||
          (status === "unassigned" && !t.assignedTo && !isClosed(t))) &&
        (discipline === "all" || t.discipline === discipline) &&
        (due === "all" ||
          (due === "overdue" && isOverdue(t)) ||
          (due === "today" && !isClosed(t) && t.dueDate === projectDate()) ||
          (due === "stale" && isStale(t)))
      );
    })
    .sort(
      (a, b) =>
        Number(isOverdue(b)) - Number(isOverdue(a)) ||
        Number(isClosed(a)) - Number(isClosed(b)) ||
        (a.priority || "P9").localeCompare(b.priority || "P9") ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
    );
  const completed = filtered.filter((t) => t.status === "completed").length;
  const applicable = filtered.filter(
    (t) => t.status !== "not-applicable",
  ).length;
  const progress = applicable ? Math.round((completed / applicable) * 100) : 0;
  const activeFilters = [
    project,
    company,
    person,
    priority,
    status,
    discipline,
    due,
  ].filter((v) => v !== "all").length;
  const disciplines = [...new Set(tasks.map((t) => t.discipline))].sort();
  function reset() {
    setQuery("");
    setProject("all");
    setCompany("all");
    setPerson("all");
    setPriority("all");
    setStatus("all");
    setDiscipline("all");
    setDue("all");
  }
  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob([tasksCsv(filtered, data)], { type: "text/csv;charset=utf-8;" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fieldtrack-activities-${projectDate()}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const select = (
    label: string,
    value: string,
    set: (v: string) => void,
    options: { id: string; name: string }[],
  ) => (
    <label className="space-y-1.5 text-xs font-medium text-slate-600">
      {label}
      <select
        aria-label={label}
        className="field-select"
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        <option value="all">All {label.toLowerCase()}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
  if (preview) {
    const open = filtered.filter((task) => !isClosed(task));
    return (
      <section className="space-y-4" aria-label="Your task summary">
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: "Active tasks",
              count: open.length,
              icon: ListTodo,
              color: "text-blue-600",
            },
            {
              label: "Completed",
              count: completed,
              icon: CheckCircle2,
              color: "text-emerald-600",
            },
          ].map((stat) => (
            <Link
              key={stat.label}
              href={
                stat.label === "Completed"
                  ? "/my-tasks?status=completed"
                  : "/my-tasks"
              }
              className="flex items-center gap-3 rounded-lg border bg-white p-3 hover:border-blue-300"
            >
              <stat.icon className={`size-5 ${stat.color}`} />
              <div>
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className="font-semibold text-lg">{stat.count}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold">Your next activities</h2>
          <Link href="/my-tasks" className="text-sm text-blue-600">
            View all
          </Link>
        </div>
        <div className="overflow-hidden rounded-lg border bg-white divide-y divide-slate-100">
          {open.slice(0, initialLimit).map((task) => (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              className="flex items-center gap-3 p-4 hover:bg-blue-50/50"
            >
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold leading-snug line-clamp-2">
                  {task.title}
                </h3>
                <p className="text-xs text-slate-500 truncate mt-1">
                  {task.location ||
                    projects.find((p) => p.id === task.projectId)?.name}
                </p>
                <div className="flex flex-wrap gap-2 items-center mt-2">
                  <TaskStatusBadge task={task} />
                  {isOverdue(task) && (
                    <span className="text-[11px] text-red-600">Overdue</span>
                  )}
                </div>
              </div>
              <ChevronRight className="size-4 text-slate-400 shrink-0" />
            </Link>
          ))}
          {!open.length && (
            <p className="text-sm text-slate-500 p-5">
              No open activities assigned to you.
            </p>
          )}
        </div>
      </section>
    );
  }
  return (
    <section className="space-y-4" aria-label="Activities">
      <div
        className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 pb-2"
        aria-label="Activity views"
      >
        {[
          ...(management ? [{ id: "unassigned", name: "To assign" }] : []),
          { id: "pending", name: "To do" },
          { id: "in-progress", name: "In progress" },
          { id: "review", name: "To review" },
          { id: "blocked", name: "Blocked" },
          { id: "completed", name: "Completed" },
          { id: "all", name: "All" },
        ].map((view) => (
          <Button
            key={view.id}
            variant={status === view.id ? "default" : "outline"}
            className="shrink-0 h-11 px-2 text-xs sm:text-sm"
            aria-pressed={status === view.id}
            onClick={() => {
              setStatus(view.id);
              setLimit(24);
              setSelected([]);
            }}
          >
            {view.name}{" "}
            <span className="ml-1 opacity-70">
              {
                tasks.filter(
                  (t) =>
                    view.id === "all" ||
                    (view.id === "unassigned"
                      ? !t.assignedTo && !isClosed(t)
                      : t.status === view.id),
                ).length
              }
            </span>
          </Button>
        ))}
      </div>
      {management && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Open activities",
              value: filtered.filter((t) => !isClosed(t)).length,
              color: "text-blue-600",
            },
            {
              label: "Overdue",
              value: filtered.filter((t) => isOverdue(t)).length,
              color: "text-red-600",
            },
            {
              label: "Blocked",
              value: filtered.filter((t) => t.status === "blocked").length,
              color: "text-amber-600",
            },
            {
              label: "Completed",
              value: `${progress}%`,
              color: "text-emerald-600",
            },
          ].map((s) => (
            <Card key={s.label} className="shadow-none">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">{s.label}</p>
                <p
                  className={`text-3xl font-semibold tracking-tight mt-1 ${s.color}`}
                >
                  {s.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {management && (
        <div className="text-xs text-slate-500">
          {completed} of {applicable} applicable activities completed · counts
          follow your filters
        </div>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 size-4 text-slate-400" />
          <Input
            aria-label="Search activities"
            placeholder="Search activity, issue ID or area…"
            className="pl-9 h-11 bg-white"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          className="h-11"
          aria-label="Filters"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal className="size-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilters > 0 && (
            <Badge variant="secondary">{activeFilters}</Badge>
          )}
        </Button>
        {management && (
          <Button
            variant="outline"
            className="h-11"
            disabled={!filtered.length}
            aria-label="Export filtered activities"
            onClick={exportCsv}
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        )}
      </div>
      {filtersOpen && (
        <Card className="shadow-none">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {select("Projects", project, setProject, projects)}
              {management &&
                currentUser.role !== "worker" &&
                select("Companies", company, setCompany, companies)}
              {management &&
                select(
                  "People",
                  person,
                  setPerson,
                  users.filter((u) => u.role === "worker"),
                )}
              {select(
                "Priorities",
                priority,
                setPriority,
                ["P1", "P2", "P3", "unspecified"].map((id) => ({
                  id,
                  name: id === "unspecified" ? "Not specified" : id,
                })),
              )}
              {select(
                "Statuses",
                status,
                setStatus,
                Object.entries(statusLabels).map(([id, name]) => ({
                  id,
                  name,
                })),
              )}
              {select(
                "Disciplines",
                discipline,
                setDiscipline,
                disciplines.map((id) => ({ id, name: id })),
              )}
              {select("Deadlines", due, setDue, [
                { id: "overdue", name: "Overdue" },
                { id: "today", name: "Due today" },
                { id: "stale", name: "No update for 7 days" },
              ])}
            </div>
            <Button variant="ghost" className="mt-3" onClick={reset}>
              Reset filters
            </Button>
          </CardContent>
        </Card>
      )}
      {management && (
        <details className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer font-semibold text-sm">
            Project progress by company and discipline
          </summary>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {[
              {
                title: "Progress by company",
                entries: companies.map((c) => ({
                  id: c.id,
                  label: c.name,
                  items: filtered.filter((t) => t.companyId === c.id),
                })),
              },
              {
                title: "Progress by discipline",
                entries: disciplines.map((d) => ({
                  id: d,
                  label: d,
                  items: filtered.filter((t) => t.discipline === d),
                })),
              },
            ].map((group) => (
              <Card key={group.title} className="shadow-none">
                <CardContent className="p-4 space-y-3 max-h-80 overflow-y-auto">
                  <h3 className="font-semibold text-sm">{group.title}</h3>
                  {group.entries
                    .filter((e) => e.items.length)
                    .map((e) => {
                      const total = e.items.filter(
                        (t) => t.status !== "not-applicable",
                      ).length;
                      const done = e.items.filter(
                        (t) => t.status === "completed",
                      ).length;
                      return (
                        <div key={e.id}>
                          <div className="flex justify-between gap-3 text-xs mb-1.5">
                            <span>{e.label}</span>
                            <span className="text-slate-500">
                              {done}/{total}
                            </span>
                          </div>
                          <div
                            role="progressbar"
                            aria-label={e.label}
                            aria-valuenow={
                              total ? Math.round((done / total) * 100) : 0
                            }
                            aria-valuemin={0}
                            aria-valuemax={100}
                            className="h-1.5 rounded-full bg-slate-100 overflow-hidden"
                          >
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{
                                width: `${total ? (done / total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  {!filtered.length && (
                    <p className="text-sm text-slate-500">
                      No activities match these filters.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </details>
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {management ? "Project activities" : "My activities"}
        </h2>
        <span className="text-xs text-slate-500">
          {filtered.length} activities
        </span>
      </div>
      {management && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3">
          <Button
            variant="ghost"
            onClick={() =>
              setSelected(
                filtered.slice(0, Math.min(limit, 50)).map((t) => t.id),
              )
            }
          >
            Select visible (max 50)
          </Button>
          <AssignmentDialog
            tasks={tasks.filter((t) => selected.includes(t.id))}
            onSaved={() => setSelected([])}
          >
            Assign selected ({selected.length})
          </AssignmentDialog>
          {!!selected.length && (
            <Button variant="ghost" onClick={() => setSelected([])}>
              Clear selection
            </Button>
          )}
        </div>
      )}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle2 className="size-9 text-slate-400 mx-auto" />
            <p className="font-medium">No activities to show</p>
            <p className="text-sm text-slate-500">
              Try changing your search or filters.
            </p>
            <Button variant="outline" onClick={reset}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={management ? "grid md:grid-cols-2 gap-3" : "space-y-3"}>
          {filtered.slice(0, limit).map((task) => (
            <div key={task.id} className="relative">
              {management && (
                <label className="flex items-center gap-2 text-xs p-2">
                  <input
                    type="checkbox"
                    className="size-5"
                    aria-label={`Select issue ${task.externalId || task.title}`}
                    checked={selected.includes(task.id)}
                    disabled={
                      !selected.includes(task.id) && selected.length >= 50
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, task.id]
                          : selected.filter((id) => id !== task.id),
                      )
                    }
                  />
                  Select activity
                </label>
              )}
              <Link
                href={`/tasks/${task.id}`}
                className={`block rounded-xl border bg-white p-4 sm:p-5 transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-blue-600 ${isOverdue(task) ? "border-red-100" : "border-slate-200"}`}
              >
                <div className="flex gap-2 items-center mb-3">
                  <Badge
                    variant="outline"
                    className={
                      task.priority === "P1"
                        ? "text-red-700 border-red-200"
                        : "text-slate-600"
                    }
                  >
                    {task.priority || "No priority"}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {task.externalId ? `#${task.externalId}` : "Manual"} ·{" "}
                    {task.discipline}
                  </span>
                  <ArrowUpRight className="size-4 ml-auto text-slate-400" />
                </div>
                <h3 className="font-semibold leading-snug">{task.title}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {task.location ||
                    projects.find((p) => p.id === task.projectId)?.name}
                </p>
                <div className="flex gap-2 flex-wrap mt-3 items-center">
                  <TaskStatusBadge task={task} />
                  {task.importData && (
                    <span className="text-xs text-slate-500">
                      Report: {task.importData.status}
                    </span>
                  )}
                  {isOverdue(task) && (
                    <span className="flex gap-1 items-center text-xs text-red-700 font-medium">
                      <AlertTriangle className="size-3" />
                      Overdue
                    </span>
                  )}
                  {isStale(task) && (
                    <span className="text-xs text-amber-700">
                      No recent update
                    </span>
                  )}
                </div>
                <div className="border-t border-slate-100 mt-4 pt-3 flex flex-wrap gap-x-4 gap-y-2 justify-between text-xs text-slate-500">
                  <span>
                    {users.find((u) => u.id === task.assignedTo)?.name ||
                      task.importData?.assignee ||
                      "Unassigned"}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {task.dueDate || "No due date"}
                  </span>
                </div>
              </Link>
              {management && (
                <div className="pt-2">
                  <AssignmentDialog tasks={[task]}>
                    {task.assignedTo ? "Reassign" : "Assign worker"}
                  </AssignmentDialog>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {filtered.length > limit && (
        <Button
          variant="outline"
          className="w-full h-12"
          onClick={() => setLimit(limit + 24)}
        >
          Show more ({filtered.length - limit} remaining)
        </Button>
      )}
    </section>
  );
}
