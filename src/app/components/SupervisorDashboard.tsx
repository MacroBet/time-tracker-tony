"use client";
import { TeamPanel } from "./TeamPanel";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { ManagementBoard } from "./ManagementBoard";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Input } from "./ui/input";
import { type Shift } from "@/lib/domain";
export function SupervisorDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const activeView = ["tasks", "team", "timesheets", "feedback"].includes(
    params.get("view") || "",
  )
    ? params.get("view")!
    : "tasks";
  const { currentUser, shifts, users, projects, feedback, mutate, isOnline } =
    useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const pending = shifts.filter((s) => s.status === "pending-approval");
  const manager =
    currentUser.role === "manager" || currentUser.role === "admin";
  async function review(shift: Shift, action: "approve" | "reject") {
    setBusy(shift.id);
    try {
      await mutate(`/api/shifts/${shift.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version: shift.version,
          action,
          ...(action === "reject"
            ? { rejectionReason: reasons[shift.id] || "" }
            : {}),
        }),
      });
      toast.success(
        action === "approve"
          ? "Timesheet approved"
          : "Timesheet returned for review",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review failed");
    } finally {
      setBusy(null);
    }
  }
  return (
    <AppShell
      title={
        activeView === "team"
          ? "Team management"
          : activeView === "timesheets"
            ? "Time & attendance"
            : activeView === "feedback"
              ? "Workspace feedback"
              : "Task management"
      }
      subtitle={
        activeView === "tasks"
          ? "Create, assign and track work across your projects."
          : "Manage your project workspace."
      }
      wide
    >
      <Tabs
        value={activeView}
        onValueChange={(value) =>
          router.push(`/supervisor${value === "tasks" ? "" : `?view=${value}`}`)
        }
        className="space-y-5"
      >
        <TabsList className="w-full h-11 grid grid-cols-4 lg:hidden">
          <TabsTrigger value="tasks" className="min-w-0 text-xs">
            Activities
          </TabsTrigger>
          <TabsTrigger value="team" className="min-w-0 text-xs">
            Team
          </TabsTrigger>
          <TabsTrigger value="timesheets" className="min-w-0 text-xs">
            Time ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="feedback" className="min-w-0 text-xs">
            Feedback
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tasks">
          <ManagementBoard />
        </TabsContent>
        <TabsContent value="team">
          <TeamPanel />
        </TabsContent>
        <TabsContent value="timesheets" className="space-y-3">
          <h2 className="font-semibold text-lg">Approval requests</h2>
          {pending.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-slate-500">
                No timesheets waiting for approval.
              </CardContent>
            </Card>
          )}
          {pending.map((shift) => (
            <Card key={shift.id}>
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">
                      {users.find((u) => u.id === shift.userId)?.name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {projects.find((p) => p.id === shift.projectId)?.name}
                    </p>
                  </div>
                  <p className="text-xl font-semibold text-blue-600">
                    {(
                      (new Date(shift.endTime!).getTime() -
                        new Date(shift.startTime).getTime()) /
                        3600000 +
                      (shift.manualHours || 0)
                    ).toFixed(2)}
                    h
                  </p>
                </div>
                <p className="text-sm text-slate-500">
                  {new Date(shift.startTime).toLocaleString("en-GB", {
                    timeZone: "Europe/Amsterdam",
                  })}{" "}
                  →{" "}
                  {new Date(shift.endTime!).toLocaleTimeString("en-GB", {
                    timeZone: "Europe/Amsterdam",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {shift.notes && (
                  <p className="text-sm bg-slate-50 rounded-lg p-3">
                    {shift.notes}
                  </p>
                )}
                {!!shift.manualHours && (
                  <p className="text-xs text-amber-700">
                    Includes {shift.manualHours} extra hours.
                  </p>
                )}
                <Input
                  aria-label={`Rejection reason for ${users.find((u) => u.id === shift.userId)?.name}`}
                  placeholder="Reason required if returning this timesheet"
                  value={reasons[shift.id] || ""}
                  onChange={(e) =>
                    setReasons({ ...reasons, [shift.id]: e.target.value })
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => review(shift, "approve")}
                    disabled={!!busy || !isOnline}
                    className="bg-green-600 hover:bg-green-700 h-11"
                  >
                    <CheckCircle className="size-4" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => review(shift, "reject")}
                    disabled={!!busy || !isOnline || !reasons[shift.id]?.trim()}
                    variant="outline"
                    className="h-11 text-red-700"
                  >
                    <XCircle className="size-4" />
                    Return
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <details className="rounded-xl border bg-white p-5">
            <summary className="font-semibold cursor-pointer">
              All timesheets ({shifts.length})
            </summary>
            <div className="mt-4 space-y-2">
              {[...shifts]
                .sort((a, b) => b.startTime.localeCompare(a.startTime))
                .map((shift) => (
                  <Link
                    key={shift.id}
                    href={`/shifts/${shift.id}`}
                    className="block rounded-lg border p-3 hover:bg-slate-50"
                  >
                    <p className="text-sm font-medium">
                      {users.find((u) => u.id === shift.userId)?.name} ·{" "}
                      {projects.find((p) => p.id === shift.projectId)?.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(shift.startTime).toLocaleString("en-GB", {
                        timeZone: "Europe/Amsterdam",
                      })}{" "}
                      · {shift.status.replaceAll("-", " ")}
                    </p>
                  </Link>
                ))}
              {!shifts.length && (
                <p className="text-sm text-slate-500">
                  No recorded shifts yet.
                </p>
              )}
            </div>
          </details>
        </TabsContent>
        <TabsContent value="feedback" className="space-y-3">
          <p className="text-sm text-slate-500">
            {manager
              ? "Project feedback submitted during testing."
              : "Your submitted feedback."}{" "}
            Reports are saved here; email delivery is not configured.
          </p>
          {feedback.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-slate-500">
                No feedback yet. Use “Report an issue” to add a report.
              </CardContent>
            </Card>
          )}
          {[...feedback].reverse().map((f) => (
            <Card key={f.id}>
              <CardContent className="p-5 space-y-3">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>
                    {users.find((u) => u.id === f.userId)?.name ||
                      "Project member"}
                  </span>
                  <span>
                    {new Date(f.createdAt).toLocaleString("en-GB", {
                      timeZone: "Europe/Amsterdam",
                    })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{f.description}</p>
                <p className="text-xs text-slate-500">{f.page}</p>
                {f.hasScreenshot && (
                  <a
                    className="text-sm text-blue-600 underline"
                    href={`/api/feedback/${f.id}/screenshot`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View screenshot
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
