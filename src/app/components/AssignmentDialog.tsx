"use client";
import { useState } from "react";
import { toast } from "sonner";
import type { Task } from "@/lib/domain";
import { useApp } from "../contexts/AppContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
export function AssignmentDialog({
  tasks,
  onSaved,
  children,
  compact = false,
}: {
  tasks: Task[];
  onSaved?: () => void;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  const { users, memberships, mutate, isOnline, refreshData } = useApp();
  const [open, setOpen] = useState(false);
  const [worker, setWorker] = useState("__choose");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const needsReason = tasks.some((t) => !!t.assignedTo);
  const candidates = users.filter(
    (u) =>
      u.role === "worker" &&
      tasks.every((t) =>
        memberships.some(
          (m) => m.userId === u.id && m.projectId === t.projectId,
        ),
      ),
  );
  async function save() {
    setBusy(true);
    try {
      await mutate("/api/tasks/assignments", {
        method: "POST",
        body: JSON.stringify({
          tasks: tasks.map((t) => ({ id: t.id, version: t.version })),
          assignedTo: worker || null,
          reason:
            reason.trim() ||
            `Assigned to ${users.find((u) => u.id === worker)?.name || "the project queue"} from the activity planner.`,
        }),
      });
      toast.success(`${tasks.length} assignment(s) saved`);
      setOpen(false);
      setReason("");
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assignment failed");
      await refreshData().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          setWorker(
            tasks.length === 1 ? tasks[0].assignedTo || "__choose" : "__choose",
          );
          setReason("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          size={compact ? "sm" : "default"}
          variant={tasks.every((t) => !t.assignedTo) ? "default" : "outline"}
          className={compact ? "h-9 text-xs" : ""}
          disabled={!tasks.length || tasks.length > 50}
        >
          {children || "Assign worker"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Assign{" "}
            {tasks.length === 1 ? "activity" : `${tasks.length} activities`}
          </DialogTitle>
          <DialogDescription>
            Choose a worker who belongs to all selected projects. The original
            report assignee remains in the activity history.
          </DialogDescription>
        </DialogHeader>
        <label className="space-y-2 text-sm">
          Responsible worker
          <select
            aria-label="Responsible worker"
            className="field-select mt-2"
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
          >
            <option value="__choose" disabled>
              Choose a worker…
            </option>
            <option value="">Unassigned — return to queue</option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.email}
              </option>
            ))}
          </select>
        </label>
        {!candidates.length && (
          <p className="text-sm text-amber-700">
            No eligible workers. Ask an admin to add a worker to the project.
          </p>
        )}
        <label className="space-y-2 text-sm">
          {needsReason
            ? "Handover note"
            : "Instructions for the worker (optional)"}
          <Textarea
            aria-label="Assignment note"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            placeholder="Explain the assignment or handover (at least 10 characters)"
          />
        </label>
        <Button
          onClick={save}
          disabled={
            busy ||
            !isOnline ||
            worker === "__choose" ||
            (needsReason && reason.trim().length < 10) ||
            (!!reason.trim() && reason.trim().length < 10)
          }
        >
          {busy ? "Saving…" : "Save assignment"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
