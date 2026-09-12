"use client";
import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
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
    pending: "bg-slate-100 text-slate-700",
    "in-progress": "bg-blue-50 text-blue-700",
    blocked: "bg-red-50 text-red-700",
    completed: "bg-emerald-50 text-emerald-700",
    "not-applicable": "bg-slate-100 text-slate-600",
  };
  return (
    <Badge className={`${colors[task.status]} whitespace-nowrap border-0`}>
      {statusLabels[task.status]}
    </Badge>
  );
}
export function TaskBoard({ management = false }: { management?: boolean }) {
  const data = useApp();
  const { tasks, users, companies, projects, currentUser } = data;
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("all");
  const [company, setCompany] = useState("all");
  const [person, setPerson] = useState("all");
  const [priority, setPriority] = useState("all");
  const [status, setStatus] = useState("all");
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
        users.find((u) => u.id === t.assignedTo)?.name,
      ]
        .join(" ")
        .toLowerCase();
      return (
        text.includes(query.trim().toLowerCase()) &&
        (project === "all" || t.projectId === project) &&
        (company === "all" || t.companyId === company) &&
        (person === "all" || t.assignedTo === person) &&
        (priority === "all" || t.priority === priority) &&
        (status === "all" || t.status === status) &&
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
        a.priority.localeCompare(b.priority) ||
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
  return (
    <section className="space-y-4" aria-label="Activities">
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
                (currentUser.role === "manager" ||
                  currentUser.role === "admin") &&
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
                ["P1", "P2", "P3"].map((id) => ({ id, name: id })),
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
        <div className="grid md:grid-cols-2 gap-4">
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
              <CardContent className="p-4 space-y-3">
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
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {management ? "Project activities" : "My activities"}
        </h2>
        <span className="text-xs text-slate-500">
          {filtered.length} activities
        </span>
      </div>
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
          {filtered.map((task) => (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              className={`block rounded-xl border bg-white p-4 sm:p-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-600 ${isOverdue(task) ? "border-red-200 border-l-4 border-l-red-500" : "border-slate-200"}`}
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
                  {task.priority}
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
                    "Assigned worker"}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3" />
                  {task.dueDate || "No due date"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
