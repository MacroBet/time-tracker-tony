"use client";
import { useState } from "react";
import { toast } from "sonner";
import { CommissioningFields, cxFromForm } from "./CommissioningFields";
import { commissioning } from "@/lib/commissioning";
import type { Task } from "@/lib/domain";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
export function TaskPlan({ task }: { task: Task }) {
  const { mutate, isOnline, projects } = useApp();
  const project = projects.find((p) => p.id === task.projectId);
  const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await mutate(`/api/tasks/${task.id}/plan`, {
        method: "PATCH",
        body: JSON.stringify({
          version: task.version,
          cx: cxFromForm(form, task.cx),
          title: form.get("title"),
          description: form.get("description"),
          priority: form.get("priority") || null,
          dueDate: form.get("dueDate") || null,
          discipline: form.get("discipline"),
          location: form.get("location"),
          reason: form.get("reason"),
        }),
      });
      toast.success("Plan updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border bg-white p-5">
      <summary className="min-h-11 cursor-pointer content-center rounded font-semibold focus-visible:outline-2 focus-visible:outline-blue-700">
        Edit activity plan
      </summary>
      <form
        key={task.version}
        onSubmit={save}
        aria-busy={busy}
        className="mt-4 space-y-4"
      >
        <label className="block text-sm">
          Title
          <Input
            name="title"
            defaultValue={task.title}
            required
            minLength={3}
            maxLength={200}
          />
        </label>
        <label className="block text-sm">
          Description
          <Textarea
            name="description"
            defaultValue={task.description}
            maxLength={10000}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            Priority
            <select
              name="priority"
              className="field-select"
              defaultValue={task.priority || ""}
            >
              <option value="">Not specified</option>
              {[
                ...new Set([
                  ...commissioning(project).config.priorities,
                  ...(task.priority ? [task.priority] : []),
                ]),
              ].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Due date
            <Input name="dueDate" type="date" defaultValue={task.dueDate} />
          </label>
        </div>
        <label className="block text-sm">
          Discipline
          <Input
            name="discipline"
            required
            defaultValue={task.discipline}
            maxLength={200}
          />
        </label>
        <label className="block text-sm">
          Area
          <Input name="location" defaultValue={task.location} maxLength={500} />
        </label>
        <CommissioningFields
          key={`${task.version}`}
          project={project}
          value={
            task.cx ?? {
              kind: task.source === "manual" ? "task" : "issue",
              result: "untested",
            }
          }
        />
        <div className="space-y-2 text-sm">
          <label htmlFor="plan-change-reason">Reason for change</label>
          <Textarea
            id="plan-change-reason"
            name="reason"
            aria-describedby="plan-change-reason-help"
            required
            minLength={10}
            maxLength={1000}
          />
          <p id="plan-change-reason-help" className="text-xs text-slate-600">
            At least 10 characters. Saved in the activity history.
          </p>
        </div>
        <Button disabled={busy || !isOnline}>
          {busy ? "Saving…" : "Save plan"}
        </Button>
      </form>
    </details>
  );
}
