"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Download,
  UserRound,
  CalendarDays,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";

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
    [project, setProject] = useState("all"),
    [company, setCompany] = useState("all"),
    [person, setPerson] = useState("all"),
    [status, setStatus] = useState("all"),
    [priority, setPriority] = useState("all"),
    [overdue, setOverdue] = useState(false),
    [filters, setFilters] = useState(false),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<string[]>([]),
    [detail, setDetail] = useState<string | null>(null),
    [sort, setSort] = useState("priority");
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
      (!overdue || isOverdue(t)) &&
      [
        t.title,
        t.externalId,
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
          ? (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
          : (a.priority || "P9").localeCompare(b.priority || "P9") ||
            (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
    );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 20) - 1),
  );
  const visible = filtered.slice(currentPage * 20, currentPage * 20 + 20);
  const selection = filtered.filter((t) => selected.includes(t.id));
  const task = tasks.find((t) => t.id === detail);
  function resetSelection() {
    setPage(0);
    setSelected([]);
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
      <label className="text-xs text-slate-500 space-y-1">
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
          <option value="all">All {label.toLowerCase()}</option>
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
    [company, person, status, priority].filter((v) => v !== "all").length +
    Number(overdue);
  const due = (t: Task) => (
    <span
      className={`text-xs ${isOverdue(t) ? "text-red-600 font-medium" : "text-slate-500"}`}
    >
      {t.dueDate
        ? new Date(t.dueDate + "T12:00:00").toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "2-digit",
          })
        : "No deadline"}
      {isOverdue(t) && <span className="block text-[10px]">Overdue</span>}
    </span>
  );
  return (
    <section aria-label="Project task manager" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Activity planner
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Assign work and follow responsibility.
          </p>
        </div>
        <div className="flex items-end gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:w-64">
            {selectFilter("Projects", project, setProject, projects)}
          </div>
          <Button asChild className="h-10">
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
                className="pl-9 h-10"
              />
            </div>
            <Button
              variant="outline"
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
                ["P1", "P2", "P3"].map((id) => ({ id, name: id })),
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <p className="text-xs text-slate-500">
              {queues.find((q) => q.id === queue)?.description}
            </p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-600">
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
                className="text-xs bg-transparent border rounded-md p-1.5"
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
              className="text-xs text-blue-600 underline"
              onClick={() => {
                setCompany("all");
                setPerson("all");
                setStatus("all");
                setPriority("all");
                setOverdue(false);
                setQuery("");
                resetSelection();
              }}
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
        <div className="hidden lg:block">
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col className="w-10" />
              <col />
              <col className="w-40" />
              <col className="w-32" />
              <col className="w-24" />
              <col className="w-28" />
            </colgroup>
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3">
                  <input
                    aria-label="Select current page"
                    type="checkbox"
                    checked={
                      visible.length > 0 &&
                      visible.every((t) => selected.includes(t.id))
                    }
                    disabled={!visible.length}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? visible.map((t) => t.id) : [],
                      )
                    }
                  />
                </th>
                <th className="py-3 font-medium">Activity / company</th>
                <th className="py-3 font-medium">Responsible</th>
                <th className="py-3 font-medium">Status</th>
                <th className="py-3 font-medium">Deadline</th>
                <th className="py-3">
                  <span className="sr-only">Assignment</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((t) => (
                <tr
                  key={t.id}
                  className={`group hover:bg-slate-50 ${selected.includes(t.id) ? "bg-blue-50/50" : ""}`}
                >
                  <td className="p-3">
                    <input
                      aria-label={`Select issue ${t.externalId || t.title}`}
                      type="checkbox"
                      checked={selected.includes(t.id)}
                      disabled={
                        !selected.includes(t.id) && selected.length >= 50
                      }
                      onChange={() => toggle(t.id)}
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <button
                      className="text-left block w-full"
                      onClick={() => setDetail(t.id)}
                    >
                      <span className="text-xs text-slate-400 mr-2">
                        #{t.externalId || "Manual"}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${t.priority === "P1" ? "text-red-600" : "text-slate-500"}`}
                      >
                        {t.priority || "—"}
                      </span>
                      <span className="block text-sm font-medium text-slate-900 mt-1 leading-snug line-clamp-2 group-hover:text-blue-700">
                        {t.title}
                      </span>
                      <span className="block text-xs text-slate-500 truncate mt-1">
                        {companies.find((c) => c.id === t.companyId)?.name} ·{" "}
                        {t.location || "No area"}
                      </span>
                    </button>
                  </td>
                  <td className="pr-3">
                    <span
                      className={`text-xs flex items-center gap-1.5 ${t.assignedTo ? "text-slate-700" : "text-amber-700"}`}
                    >
                      <UserRound className="size-3.5 shrink-0" />
                      {owner(t)}
                    </span>
                  </td>
                  <td className="pr-2">
                    <TaskStatusBadge task={t} />
                  </td>
                  <td>{due(t)}</td>
                  <td className="pr-3">
                    <AssignmentDialog compact tasks={[t]}>
                      {t.assignedTo ? "Reassign" : "Assign"}
                    </AssignmentDialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="lg:hidden divide-y divide-slate-100">
          {visible.map((t) => (
            <article key={t.id} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <input
                  className="mt-1 size-4 shrink-0"
                  aria-label={`Select mobile issue ${t.externalId || t.title}`}
                  type="checkbox"
                  checked={selected.includes(t.id)}
                  disabled={!selected.includes(t.id) && selected.length >= 50}
                  onChange={() => toggle(t.id)}
                />
                <button
                  className="text-left min-w-0 flex-1"
                  onClick={() => setDetail(t.id)}
                >
                  <span className="text-xs text-slate-500">
                    #{t.externalId || "Manual"} · {t.priority || "No priority"}
                  </span>
                  <h3 className="font-medium text-sm leading-snug mt-1">
                    {t.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {companies.find((c) => c.id === t.companyId)?.name}
                  </p>
                </button>
              </div>
              <div className="flex justify-between items-center gap-2">
                <TaskStatusBadge task={t} />
                {due(t)}
              </div>
              <div className="border-t pt-3 flex items-center justify-between gap-2">
                <span
                  className={`text-xs ${t.assignedTo ? "text-slate-700" : "text-amber-700"}`}
                >
                  {owner(t)}
                </span>
                <AssignmentDialog compact tasks={[t]}>
                  {t.assignedTo ? "Reassign" : "Assign worker"}
                </AssignmentDialog>
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <div className="p-12 text-center">
            <UserRound className="size-8 mx-auto text-slate-300 mb-3" />
            <h3 className="font-medium">No activities in this view</h3>
            <p className="text-sm text-slate-500 mt-1">
              Choose another queue or clear your filters.
            </p>
          </div>
        )}
        <div className="border-t px-4 py-3 flex justify-between items-center text-xs text-slate-500">
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
      <Sheet
        open={!!task}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
          {task && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left leading-snug">
                  {task.title}
                </SheetTitle>
                <SheetDescription>
                  Issue #{task.externalId || "Manual"} ·{" "}
                  {companies.find((c) => c.id === task.companyId)?.name}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 mt-6">
                <div className="flex justify-between">
                  <TaskStatusBadge task={task} />
                  {due(task)}
                </div>
                <div className="rounded-lg bg-slate-50 p-4 flex justify-between gap-3 items-center">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">
                      Responsible worker
                    </p>
                    <p className="font-medium text-sm">{owner(task)}</p>
                  </div>
                  <AssignmentDialog tasks={[task]}>
                    {task.assignedTo ? "Reassign" : "Assign"}
                  </AssignmentDialog>
                </div>
                <p className="text-sm whitespace-pre-wrap text-slate-600">
                  {task.description || "No description provided."}
                </p>
                <p className="text-xs text-slate-500 flex gap-2">
                  <CalendarDays className="size-4" />
                  {task.location || "No area specified"}
                </p>
                {task.notes && (
                  <div className="border-l-2 border-blue-300 pl-3">
                    <p className="text-xs text-slate-500 mb-1">Latest update</p>
                    <p className="text-sm whitespace-pre-wrap">{task.notes}</p>
                  </div>
                )}
                <Button asChild className="w-full">
                  <Link href={`/tasks/${task.id}`}>
                    {task.status === "review"
                      ? "Review work and evidence"
                      : "Open activity and history"}
                    <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
