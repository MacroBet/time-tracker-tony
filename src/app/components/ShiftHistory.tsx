"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "../contexts/AppContext";
import { homeFor } from "@/lib/domain";
import { AppShell } from "./AppShell";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
export function ShiftHistory() {
  const { currentUser, shifts, projects } = useApp();
  const [filter, setFilter] = useState("all");
  const mine = shifts
    .filter(
      (s) =>
        s.userId === currentUser.id &&
        (filter === "all" || s.status === filter),
    )
    .sort((a, b) => b.startTime.localeCompare(a.startTime));
  const hours = mine
    .filter((s) => s.endTime)
    .reduce(
      (total, s) =>
        total +
        (new Date(s.endTime!).getTime() - new Date(s.startTime).getTime()) /
          3600000 +
        (s.manualHours || 0),
      0,
    );
  return (
    <AppShell title="Shift history" back={homeFor(currentUser)}>
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-slate-500">
            Recorded hours · current selection
          </p>
          <p className="text-3xl font-semibold text-blue-600 mt-1">
            {hours.toFixed(2)}h
          </p>
        </CardContent>
      </Card>
      <label className="block space-y-2 text-sm">
        Status
        <select
          className="field-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All timesheets</option>
          {[
            "active",
            "completed",
            "pending-approval",
            "approved",
            "rejected",
          ].map((s) => (
            <option key={s} value={s}>
              {s === "completed" ? "Not submitted" : s.replaceAll("-", " ")}
            </option>
          ))}
        </select>
      </label>
      {mine.length === 0 && (
        <p className="text-center text-slate-500 py-8">
          No timesheets in this view.
        </p>
      )}
      {mine.map((s) => (
        <Link key={s.id} href={`/shifts/${s.id}`} className="block">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <h2 className="font-semibold">
                  {projects.find((p) => p.id === s.projectId)?.name}
                </h2>
                <Badge
                  variant="secondary"
                  className={
                    s.status === "rejected" ? "bg-red-50 text-red-700" : ""
                  }
                >
                  {s.status === "completed"
                    ? "Not submitted"
                    : s.status.replaceAll("-", " ")}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                {new Date(s.startTime).toLocaleString("en-GB", {
                  timeZone: "Europe/Amsterdam",
                })}
              </p>
              {s.endTime && (
                <p className="text-xl font-semibold text-blue-600">
                  {(
                    (new Date(s.endTime).getTime() -
                      new Date(s.startTime).getTime()) /
                      3600000 +
                    (s.manualHours || 0)
                  ).toFixed(2)}
                  h
                </p>
              )}
              {s.notes && <p className="text-sm text-slate-600">{s.notes}</p>}
              {s.rejectionReason && (
                <p className="text-sm text-red-700">{s.rejectionReason}</p>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </AppShell>
  );
}
