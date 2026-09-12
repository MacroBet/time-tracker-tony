"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { type Shift } from "@/lib/domain";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { TaskBoard } from "./TaskBoard";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
export function WorkerDashboard() {
  const { currentUser, projects, shifts, mutate, isOnline } = useApp();
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const router = useRouter();
  const active = shifts.find(
    (s) => s.userId === currentUser.id && s.status === "active",
  );
  const draft = shifts.find(
    (s) =>
      s.userId === currentUser.id &&
      ["completed", "rejected"].includes(s.status),
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const minutes = active
    ? Math.max(
        0,
        Math.floor(
          ((now || new Date(active.startTime).getTime()) -
            new Date(active.startTime).getTime()) /
            60000,
        ),
      )
    : 0;
  async function toggleShift() {
    setBusy(true);
    try {
      if (active) {
        const saved = await mutate<Shift>(`/api/shifts/${active.id}`, {
          method: "PATCH",
          body: JSON.stringify({ version: active.version, action: "end" }),
        });
        router.push(`/shifts/${saved.id}`);
      } else {
        await mutate("/api/shifts", {
          method: "POST",
          body: JSON.stringify({ projectId }),
        });
        toast.success("Shift started");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save shift",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell title="My workspace">
      <div>
        <p className="text-xs uppercase tracking-wider font-medium text-blue-600 mb-2">
          FIELD TEAM
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          Ready for the next step, {currentUser.name.split(" ")[0]}?
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Your assigned activities, with urgent work first.
        </p>
      </div>
      <TaskBoard />
      <Card className={active ? "border-emerald-200" : ""}>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-blue-600" />
            <h2 className="font-semibold">
              {active ? "Shift in progress" : "Site check-in"}
            </h2>
            {active && (
              <span className="ml-auto font-semibold text-emerald-700 tabular-nums">
                {Math.floor(minutes / 60)}h {minutes % 60}m
              </span>
            )}
          </div>
          {active ? (
            <p className="text-sm text-slate-500">
              {projects.find((p) => p.id === active.projectId)?.name}
            </p>
          ) : (
            <label className="block text-sm space-y-2">
              Project
              <select
                aria-label="Check-in project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="field-select"
              >
                {!projects.length && (
                  <option value="">No assigned projects</option>
                )}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button
            onClick={toggleShift}
            disabled={busy || !isOnline || !projectId}
            className={`w-full h-12 ${active ? "bg-red-600 hover:bg-red-700" : ""}`}
          >
            {active ? (
              <Square className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
            {busy ? "Saving…" : active ? "End shift" : "Start shift"}
          </Button>
          <p className="text-xs text-slate-500">
            Manual check-in. Start and end times are recorded by the server.
          </p>
        </CardContent>
      </Card>
      {draft && (
        <Button variant="outline" className="w-full h-12" asChild>
          <Link href={`/shifts/${draft.id}`}>
            Review your{" "}
            {draft.status === "rejected" ? "rejected" : "unsubmitted"} timesheet
          </Link>
        </Button>
      )}
      <Button variant="outline" className="w-full h-12" asChild>
        <Link href="/shift-history">
          <Clock className="size-4" />
          Shift history
        </Link>
      </Button>
    </AppShell>
  );
}
