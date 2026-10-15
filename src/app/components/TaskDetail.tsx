"use client";
import { AssignmentDialog } from "./AssignmentDialog";
import { TestProgress } from "./CommissioningFields";
import { dueDateFor, tagReviewLabels } from "@/lib/commissioning";
import { TaskPlan } from "./TaskPlan";
import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  FileText,
  Upload,
  History,
  AlertTriangle,
} from "lucide-react";
import {
  type Task,
  type TaskStatus,
  homeFor,
  isClosed,
  isOverdue,
  statusLabels,
} from "@/lib/domain";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { TaskStatusBadge } from "./TaskBoard";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
export function TaskDetail({ taskId }: { taskId: string }) {
  const data = useApp();
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task)
    return (
      <AppShell title="Activity unavailable" back={homeFor(data.currentUser)}>
        <p>This activity does not exist or is not assigned to your team.</p>
      </AppShell>
    );
  return <TaskContent key={taskId} task={task} />;
}
function TaskContent({ task }: { task: Task }) {
  const {
    currentUser,
    users,
    companies,
    projects,
    attachments,
    activities,
    mutate,
    isOnline,
    refreshData,
  } = useApp();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const files = attachments.filter((a) => a.taskId === task.id);
  const timeline = activities
    .filter((a) => a.taskId === task.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const closed = isClosed(task);
  async function update(status?: TaskStatus) {
    setBusy(true);
    try {
      await mutate(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version: task.version,
          ...(status ? { status } : {}),
          ...(notes.trim() ? { notes } : {}),
        }),
      });
      setNotes("");
      toast.success("Activity updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save update",
      );
      await refreshData().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Choose a file smaller than 2 MB.");
      return;
    }
    setBusy(true);
    try {
      await mutate(`/api/tasks/${task.id}/attachments`, {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
        },
      });
      toast.success("Evidence uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  return (
    <AppShell
      title={
        task.externalId ? `Activity #${task.externalId}` : "Activity detail"
      }
      subtitle={`${task.discipline} · ${task.priority || "No priority"}`}
      back={homeFor(currentUser)}
    >
      <Card>
        <CardContent className="p-5 space-y-5">
          <div className="flex gap-2 items-center">
            <Badge variant="outline">{task.priority || "No priority"}</Badge>
            <TaskStatusBadge task={task} />
            {isOverdue(task) && (
              <Badge className="bg-red-50 text-red-700">
                <AlertTriangle className="size-3 mr-1" />
                Overdue
              </Badge>
            )}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {task.title}
          </h2>
          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
          <dl className="grid grid-cols-2 gap-5 border-t pt-5 text-sm">
            {[
              [
                "Responsible",
                users.find((u) => u.id === task.assignedTo)?.name ||
                  task.importData?.assignee ||
                  "Unassigned",
              ],
              [
                "Company",
                companies.find((c) => c.id === task.companyId)?.name ||
                  "Project company",
              ],
              ["Project", projects.find((p) => p.id === task.projectId)?.name],
              ["Area", task.location || "Not specified"],
              ["Due date", dueDateFor(task) || "Not set"],
              ["Asset", task.cx?.assetId || "Unlinked"],
              ["P6 Activity ID", task.cx?.activityId || "Unlinked"],
              [
                "Level / tag",
                [task.cx?.level, task.cx?.qualityTag]
                  .filter(Boolean)
                  .join(" · ") || "Not set",
              ],
              ["Test result", task.cx?.result || "untested"],
              ...(task.cx?.kind === "tag"
                ? [
                    [
                      "Tag review",
                      task.cx.tagReview
                        ? tagReviewLabels[task.cx.tagReview]
                        : "Not recorded · Legacy workflow approval",
                    ],
                  ]
                : []),
              [
                "Source",
                task.source === "manual"
                  ? "Manual activity"
                  : `${task.source.toUpperCase()} · #${task.externalId}`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-slate-500 mb-1">{label}</dt>
                <dd className="font-medium break-words">{value}</dd>
              </div>
            ))}
          </dl>
          {task.notes && (
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs font-medium text-slate-500 mb-1">
                Latest note
              </p>
              <p className="text-sm whitespace-pre-wrap">{task.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
      {!isClosed(task) && <TestProgress task={task} />}
      {currentUser.role !== "worker" && (
        <>
          <AssignmentDialog tasks={[task]} />
          <TaskPlan task={task} />
        </>
      )}
      {task.importData && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold">Original issue report</h3>
            <p className="text-sm text-slate-600">
              {task.importData.status} · {task.importData.assigneeType}:{" "}
              {task.importData.assignee}
            </p>
            <p className="text-xs text-slate-500">
              {task.importData.file} · row {task.importData.row}. Report values
              are a snapshot; progress updates are tracked separately.
            </p>
            {!task.assignedTo && (
              <p className="text-sm text-amber-700">
                The original assignee has not been linked to an app account.
              </p>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">
                View original fields
              </summary>
              <dl className="mt-3 space-y-3">
                {Object.entries(task.importData.fields)
                  .filter(([, value]) => value)
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs text-slate-500">{key}</dt>
                      <dd className="whitespace-pre-wrap break-words">
                        {value}
                      </dd>
                    </div>
                  ))}
              </dl>
            </details>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Evidence{" "}
            <span className="text-slate-400 text-sm font-normal">
              ({files.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {files.length === 0 && (
            <p className="text-sm text-slate-500">No evidence attached yet.</p>
          )}
          {files.map((f) => (
            <a
              key={f.id}
              href={`/api/attachments/${f.id}`}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50"
            >
              <FileText className="size-5 text-blue-600 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="text-sm block truncate">{f.name}</span>
                <span className="text-xs text-slate-500">
                  {Math.ceil(f.size / 1024)} KB
                </span>
              </span>
              <ArrowUpRight className="size-4 text-slate-400" />
            </a>
          ))}
          {!closed && (
            <>
              <input
                ref={inputRef}
                type="file"
                aria-label="Upload activity evidence"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="sr-only"
                onChange={(e) => upload(e.target.files?.[0])}
                disabled={busy || !isOnline}
              />
              <Button
                variant="outline"
                className="w-full h-12"
                onClick={() => inputRef.current?.click()}
                disabled={busy || !isOnline}
              >
                <Upload className="size-4" />
                Add photo or document
              </Button>
              <p className="text-xs text-slate-500">
                PNG, JPEG, WebP or PDF · up to 2 MB each.
              </p>
            </>
          )}
        </CardContent>
      </Card>
      {task.status === "review" && currentUser.role === "worker" && (
        <p className="rounded-xl border border-purple-200 bg-purple-50 p-5 text-sm">
          Your work is awaiting supervisor review. You can add evidence while
          waiting.
        </p>
      )}
      {((!closed && task.status !== "review") ||
        currentUser.role !== "worker") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {closed ? "Review activity" : "Update progress"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="progress-note">Progress note</Label>
              <Textarea
                id="progress-note"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={5000}
                rows={4}
                placeholder="What was done? Add an outcome or explain what is blocking progress."
              />
            </div>
            <p className="text-xs text-slate-500">
              Submit completed work with a note or evidence. Your supervisor
              reviews the result. Explain any blocker or returned work.
            </p>
            <div className="space-y-2">
              {!closed && (
                <Button
                  disabled={busy || !isOnline || !notes.trim()}
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => update()}
                >
                  {busy ? "Saving…" : "Save progress note"}
                </Button>
              )}
              {(task.status === "pending" ||
                task.status === "blocked" ||
                closed) && (
                <Button
                  disabled={busy || !isOnline || !task.assignedTo}
                  className="w-full h-12"
                  onClick={() => update("in-progress")}
                >
                  {closed
                    ? "Reopen activity"
                    : task.status === "blocked"
                      ? "Resume activity"
                      : "Start activity"}
                </Button>
              )}
              {task.status === "in-progress" && (
                <Button
                  disabled={busy || !isOnline}
                  className="w-full h-12 bg-green-600 hover:bg-green-700"
                  onClick={() => update("review")}
                >
                  Submit for review
                </Button>
              )}
              {task.status === "review" && currentUser.role !== "worker" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    disabled={busy || !isOnline}
                    onClick={() => update("completed")}
                  >
                    Approve completion
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !isOnline || notes.trim().length < 10}
                    onClick={() => update("in-progress")}
                  >
                    Return for correction
                  </Button>
                </div>
              )}
              {!closed && task.status !== "review" && (
                <div className="grid grid-cols-2 gap-2">
                  {task.status !== "blocked" && (
                    <Button
                      disabled={busy || !isOnline}
                      variant="outline"
                      className="h-11 text-red-700"
                      onClick={() => update("blocked")}
                    >
                      Report blocker
                    </Button>
                  )}
                  {currentUser.role !== "worker" && (
                    <Button
                      disabled={busy || !isOnline}
                      variant="outline"
                      className="h-11"
                      onClick={() => update("not-applicable")}
                    >
                      Not applicable
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex gap-2 items-center">
            <History className="size-5" />
            Activity history
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-5">
            {timeline.map((a) => (
              <li key={a.id} className="border-l-2 border-blue-100 pl-4">
                <p className="text-sm font-medium">{a.action}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {a.actorName} ·{" "}
                  {new Date(a.createdAt).toLocaleString("en-GB", {
                    timeZone: "Europe/Amsterdam",
                  })}
                </p>
                {a.note && (
                  <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                    {a.note}
                  </p>
                )}
              </li>
            ))}
          </ol>
          {!timeline.length && (
            <p className="text-sm text-slate-500">No updates recorded.</p>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-slate-400">
        Current status: {statusLabels[task.status]} · last updated{" "}
        {new Date(task.updatedAt).toLocaleString("en-GB", {
          timeZone: "Europe/Amsterdam",
        })}
      </p>
    </AppShell>
  );
}
