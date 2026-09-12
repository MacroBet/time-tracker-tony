"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type Shift, homeFor } from "@/lib/domain";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { Card, CardContent } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
export function ShiftSummary({ shiftId }: { shiftId: string }) {
  const { shifts, currentUser } = useApp();
  const shift = shifts.find((s) => s.id === shiftId);
  return shift ? (
    <SummaryForm key={shift.id} shift={shift} />
  ) : (
    <AppShell title="Timesheet unavailable" back={homeFor(currentUser)}>
      <p>This timesheet does not exist or is not assigned to you.</p>
    </AppShell>
  );
}
function SummaryForm({ shift }: { shift: Shift }) {
  const { currentUser, projects, mutate, isOnline } = useApp();
  const [hours, setHours] = useState(String(shift.manualHours || 0));
  const [notes, setNotes] = useState(shift.notes || "");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const base = shift.endTime
    ? (new Date(shift.endTime).getTime() -
        new Date(shift.startTime).getTime()) /
      3600000
    : 0;
  const editable =
    ["completed", "rejected"].includes(shift.status) &&
    shift.userId === currentUser.id;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await mutate(`/api/shifts/${shift.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version: shift.version,
          action: "submit",
          manualHours: Number(hours),
          notes,
        }),
      });
      toast.success("Timesheet submitted for approval");
      router.push(homeFor(currentUser));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell
      title="Shift summary"
      subtitle="Review your hours before submitting."
      back={homeFor(currentUser)}
    >
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold">
            {projects.find((p) => p.id === shift.projectId)?.name}
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Started</p>
              <p>
                {new Date(shift.startTime).toLocaleString("en-GB", {
                  timeZone: "Europe/Amsterdam",
                })}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Ended</p>
              <p>
                {shift.endTime
                  ? new Date(shift.endTime).toLocaleString("en-GB", {
                      timeZone: "Europe/Amsterdam",
                    })
                  : "In progress"}
              </p>
            </div>
          </div>
          <p className="text-3xl font-semibold text-blue-600">
            {(base + (Number(hours) || 0)).toFixed(2)}
            <span className="text-base ml-1">hours</span>
          </p>
          <p className="text-sm text-slate-500 capitalize">
            {shift.status.replaceAll("-", " ")}
          </p>
          {shift.rejectionReason && (
            <p className="p-3 rounded-lg text-sm text-red-800 bg-red-50">
              Returned for review: {shift.rejectionReason}
            </p>
          )}
        </CardContent>
      </Card>
      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="extra-hours">Extra hours (0–12)</Label>
              <Input
                id="extra-hours"
                type="number"
                min="0"
                max="12"
                step="0.25"
                required
                value={hours}
                disabled={!editable}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift-notes">
                Notes / explanation for extra hours
              </Label>
              <Textarea
                id="shift-notes"
                value={notes}
                disabled={!editable}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={5000}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
        {editable && (
          <Button disabled={busy || !isOnline} className="w-full h-12">
            {busy ? "Submitting…" : "Submit for approval"}
          </Button>
        )}
      </form>
    </AppShell>
  );
}
