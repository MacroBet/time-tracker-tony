"use client";
import { CommissioningFields, cxFromForm } from "./CommissioningFields";
import { commissioning } from "@/lib/commissioning";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type Task, homeFor } from "@/lib/domain";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
export function CreateTask() {
  const { currentUser, projects, users, memberships, mutate, isOnline } =
    useApp();
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [assignedTo, setAssignedTo] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const workers = users.filter(
    (u) =>
      u.role === "worker" &&
      memberships.some((m) => m.userId === u.id && m.projectId === projectId),
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const cx = cxFromForm(form);
    const values = Object.fromEntries(
      [...form.entries()].filter(([k]) => !k.startsWith("cx-")),
    );
    if (!values.dueDate) delete values.dueDate;
    try {
      const task = await mutate<Task>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ ...values, projectId, assignedTo, cx }),
      });
      toast.success("Activity created");
      router.push(`/tasks/${task.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create activity",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell
      title="New activity"
      subtitle="A clear instruction, one responsible person."
      back={homeFor(currentUser)}
    >
      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardContent className="p-5 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Activity title</Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g. Verify S201 valve operation"
                required
                minLength={3}
                maxLength={200}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">What needs to be done?</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe the work and the expected outcome…"
                required
                minLength={3}
                maxLength={5000}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <select
                id="project"
                className="field-select"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setAssignedTo("");
                }}
                required
              >
                <option value="">Choose project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignee">Responsible person</Label>
              <select
                id="assignee"
                className="field-select"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                required
              >
                <option value="">Choose a team member</option>
                {workers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  name="priority"
                  key={projectId}
                  defaultValue={
                    commissioning(projects.find((p) => p.id === projectId))
                      .config.priorities[0]
                  }
                  className="field-select"
                >
                  {commissioning(
                    projects.find((p) => p.id === projectId),
                  ).config.priorities.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discipline">Discipline</Label>
                <select
                  id="discipline"
                  name="discipline"
                  className="field-select"
                  required
                >
                  {[
                    "Commissioning",
                    "Electrical",
                    "Mechanical",
                    "Controls",
                    "Safety",
                    "Construction",
                  ].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Area / location</Label>
              <Input
                id="location"
                name="location"
                placeholder="e.g. S201 · LV Room B"
                maxLength={200}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" name="dueDate" type="date" className="h-12" />
            </div>
            <CommissioningFields
              key={projectId}
              project={projects.find((p) => p.id === projectId)}
            />
          </CardContent>
        </Card>
        <Button
          disabled={busy || !isOnline || !workers.length}
          className="w-full h-12"
        >
          {busy ? "Creating…" : "Create activity"}
        </Button>
      </form>
    </AppShell>
  );
}
