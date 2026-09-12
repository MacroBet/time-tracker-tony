"use client";
import Link from "next/link";
import {
  ClipboardCheck,
  Users,
  Clock3,
  CircleAlert,
  ArrowUpRight,
} from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import {
  isClosed,
  isOverdue,
  statusLabels,
  type TaskStatus,
} from "@/lib/domain";
export function Overview() {
  const { tasks, users, companies, projects, activities, shifts, currentUser } =
    useApp();
  const completed = tasks.filter((t) => t.status === "completed").length;
  const unassigned = tasks.filter((t) => !t.assignedTo && !isClosed(t)).length;
  const hours = shifts.reduce(
    (sum, s) =>
      sum +
      (s.endTime
        ? Math.max(
            0,
            (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) /
              3600000,
          ) + (s.manualHours || 0)
        : 0),
    0,
  );
  const statuses: { status: TaskStatus; color: string }[] = [
    { status: "pending", color: "#ffb347" },
    { status: "in-progress", color: "#2867ff" },
    { status: "review", color: "#8c74f4" },
    { status: "blocked", color: "#ef6670" },
    { status: "completed", color: "#14c77b" },
    { status: "not-applicable", color: "#cbd5e1" },
  ];
  let offset = 0;
  const gradient = statuses
    .map(({ status, color }) => {
      const start = offset;
      offset += tasks.length
        ? (tasks.filter((t) => t.status === status).length / tasks.length) * 100
        : 0;
      return `${color} ${start}% ${offset}%`;
    })
    .join(",");
  return (
    <AppShell
      title="Dashboard"
      subtitle="Your projects, people and progress in one place."
      wide
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            Welcome back, {currentUser.name.split(" ")[0]}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Here’s what’s happening across your{" "}
            {projects.length === 1 ? "project" : "projects"}.
          </p>
        </div>
        <Button asChild>
          <Link href="/supervisor">
            Open task planner
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: "Project team",
            value: users.length,
            caption: `${projects.length} ${projects.length === 1 ? "project" : "projects"}`,
            icon: Users,
            color: "text-blue-600",
          },
          {
            label: "Tasks completed",
            value: completed,
            caption: `${tasks.length} total activities`,
            icon: ClipboardCheck,
            color: "text-emerald-600",
          },
          {
            label: "Hours recorded",
            value: `${hours.toFixed(1)}h`,
            caption: "Finished shifts and adjustments",
            icon: Clock3,
            color: "text-blue-600",
          },
          {
            label: "Need assignment",
            value: unassigned,
            caption: `${tasks.filter((t) => isOverdue(t)).length} open activities overdue`,
            icon: CircleAlert,
            color: "text-amber-600",
          },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">{m.label}</p>
                <m.icon className={`size-4 ${m.color}`} />
              </div>
              <p className="text-2xl sm:text-3xl font-semibold mt-3 tracking-tight">
                {m.value}
              </p>
              <p className="text-[11px] text-slate-500 mt-2">{m.caption}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid xl:grid-cols-2 gap-5">
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-5">Tasks by status</h3>
            <div className="flex flex-wrap items-center justify-center gap-8">
              <div
                role="img"
                aria-label={`${completed} completed of ${tasks.length} tasks`}
                className="size-44 rounded-full grid place-items-center"
                style={{
                  background: tasks.length
                    ? `conic-gradient(${gradient})`
                    : "#e8eef8",
                }}
              >
                <div className="size-28 rounded-full bg-white grid place-items-center">
                  <div className="text-center">
                    <p className="text-3xl font-semibold">{tasks.length}</p>
                    <p className="text-xs text-slate-500">Activities</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 flex-1 min-w-40">
                {statuses.map((s) => (
                  <div
                    key={s.status}
                    className="flex gap-2 items-center text-xs"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: s.color }}
                    />
                    <span className="text-slate-600 flex-1">
                      {statusLabels[s.status]}
                    </span>
                    <span className="font-semibold">
                      {tasks.filter((t) => t.status === s.status).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex justify-between mb-4">
              <h3 className="text-sm font-semibold">Recent activity</h3>
              <Link href="/supervisor" className="text-xs text-blue-600">
                View tasks
              </Link>
            </div>
            <ol className="space-y-4">
              {[...activities]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, 5)
                .map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="size-8 rounded-full bg-blue-50 text-blue-600 shrink-0 grid place-items-center text-[10px] font-medium">
                      {a.actorName
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/tasks/${a.taskId}`}
                        className="text-xs font-medium leading-snug block hover:text-blue-600"
                      >
                        {a.action}
                      </Link>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {a.actorName} ·{" "}
                        {new Date(a.createdAt).toLocaleString("en-GB", {
                          timeZone: "Europe/Amsterdam",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </li>
                ))}
            </ol>
            {!activities.length && (
              <p className="text-sm text-slate-500">
                No activity recorded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="p-5">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-sm font-semibold">Progress by company</h3>
            <span className="text-xs text-slate-500">
              Completed / applicable tasks
            </span>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-5">
            {companies
              .map((c) => ({
                company: c,
                items: tasks.filter(
                  (t) => t.companyId === c.id && t.status !== "not-applicable",
                ),
              }))
              .filter((c) => c.items.length)
              .sort((a, b) => b.items.length - a.items.length)
              .map(({ company, items }) => {
                const done = items.filter(
                  (t) => t.status === "completed",
                ).length;
                return (
                  <div key={company.id}>
                    <div className="flex items-center justify-between gap-2 text-xs mb-2">
                      <span className="truncate text-slate-600">
                        {company.name}
                      </span>
                      <span className="text-slate-500">
                        {done}/{items.length}
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full bg-blue-50"
                      role="progressbar"
                      aria-label={company.name}
                      aria-valuenow={Math.round((done / items.length) * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-2 bg-blue-600 rounded-full"
                        style={{ width: `${(done / items.length) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
