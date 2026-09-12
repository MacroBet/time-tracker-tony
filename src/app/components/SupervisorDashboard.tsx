"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { TaskBoard } from "./TaskBoard";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Input } from "./ui/input";
import { type Shift } from "@/lib/domain";
export function SupervisorDashboard() {
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
    <AppShell title={manager ? "Project overview" : "Team overview"} wide>
      <div className="flex gap-4 justify-between items-end">
        <div>
          <p className="text-xs uppercase tracking-wider font-medium text-purple-600 mb-2">
            {manager ? "PROJECT MANAGEMENT" : "SUPERVISION"}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            A clear view of the work.
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {manager
              ? "Progress, priorities and accountability across your project companies."
              : "Activities and timesheets for your company’s project team."}
          </p>
        </div>
        <Button className="shrink-0" asChild>
          <Link href="/create-task">
            <Plus className="size-4" />
            <span className="hidden sm:inline">New activity</span>
            <span className="sm:hidden">New</span>
          </Link>
        </Button>
      </div>
      <Tabs defaultValue="tasks" className="space-y-5">
        <TabsList className="w-full h-12">
          <TabsTrigger value="tasks" className="flex-1">
            Activities
          </TabsTrigger>
          <TabsTrigger value="timesheets" className="flex-1">
            Timesheets ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex-1">
            Feedback ({feedback.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tasks">
          <TaskBoard management />
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
