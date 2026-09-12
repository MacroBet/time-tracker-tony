import "server-only";
import { randomUUID } from "node:crypto";
import { requireUser } from "./auth";
import { loadData, assignTasks, planTask } from "./repository";
import { json, readJson } from "./http";
import { requireCondition } from "./errors";
import { assignmentSchema, taskPlanSchema } from "@/lib/validation";
import { canManage, isProjectMember } from "@/lib/permissions";
export async function assign(request: Request) {
  const user = await requireUser();
  requireCondition(
    canManage(user),
    403,
    "Only supervisors and managers can assign work.",
  );
  const input = assignmentSchema.parse(await readJson(request));
  const data = await loadData(user);
  const worker = input.assignedTo
    ? data.users.find((u) => u.id === input.assignedTo && u.role === "worker")
    : undefined;
  requireCondition(
    !input.assignedTo || worker,
    400,
    "Choose a worker in your project team.",
  );
  const now = new Date().toISOString();
  const updates = input.tasks.map((selection) => {
    const old = data.tasks.find((t) => t.id === selection.id);
    requireCondition(
      old,
      404,
      "Activity not found in your supervised projects.",
    );
    requireCondition(
      old.version === selection.version,
      409,
      "An activity changed. Refresh the selection and try again.",
    );
    requireCondition(
      !worker || isProjectMember(worker, old.projectId, data),
      403,
      "The worker must belong to every selected project.",
    );
    const previous =
      data.users.find((u) => u.id === old.assignedTo)?.name || "Unassigned";
    const task = {
      ...old,
      assignedTo: worker?.id,
      updatedAt: now,
      version: old.version + 1,
    };
    // Removing responsibility returns active work to the queue; closed history is retained.
    if (
      (!worker || (old.assignedTo && old.assignedTo !== worker.id)) &&
      ["in-progress", "review"].includes(task.status)
    )
      task.status = "pending";
    return {
      task,
      expectedVersion: selection.version,
      activity: {
        id: randomUUID(),
        taskId: old.id,
        actorId: user.id,
        actorName: user.name,
        action: `Assignment: ${previous} → ${worker?.name || "Unassigned"}`,
        note: input.reason,
        createdAt: now,
      },
    };
  });
  await assignTasks(updates);
  return json({ updated: updates.length });
}
export async function plan(request: Request, id: string) {
  const user = await requireUser();
  requireCondition(
    canManage(user),
    403,
    "Only supervisors and managers can plan work.",
  );
  const input = taskPlanSchema.parse(await readJson(request));
  const data = await loadData(user);
  const old = data.tasks.find((t) => t.id === id);
  requireCondition(old, 404, "Activity not found.");
  requireCondition(
    old.version === input.version,
    409,
    "Activity changed. Refresh before saving.",
  );
  const { reason, version, ...fields } = input;
  const now = new Date().toISOString();
  const task = {
    ...old,
    ...fields,
    priority: fields.priority ?? undefined,
    dueDate: fields.dueDate ?? undefined,
    version: version + 1,
    updatedAt: now,
  };
  await planTask(
    task,
    {
      id: randomUUID(),
      taskId: id,
      actorId: user.id,
      actorName: user.name,
      action: "Activity plan updated",
      note: reason,
      createdAt: now,
    },
    version,
  );
  return json(task);
}
