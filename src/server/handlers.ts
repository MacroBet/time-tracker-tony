import "server-only";
import { randomUUID } from "node:crypto";
import { currentUser, requireUser, signIn, signOut, digest } from "./auth";
import { dataMode } from "./config";
import * as repo from "./repository";
import { json, readBody, readJson } from "./http";
import { requireCondition } from "./errors";
import { canManage, isProjectMember } from "@/lib/permissions";
import { taskUpdateError } from "@/lib/workflow";
import { commissioning, hasModule, linkError } from "@/lib/commissioning";
import { verifyPassword } from "@/lib/password";
import {
  createTaskSchema,
  updateTaskSchema,
  createShiftSchema,
  updateShiftSchema,
  loginSchema,
  feedbackSchema,
} from "@/lib/validation";
import {
  type Activity,
  type User,
  type Task,
  type Shift,
  homeFor,
  isClosed,
  statusLabels,
} from "@/lib/domain";
const activity = (
  taskId: string,
  user: User,
  action: string,
  note = "",
): Activity => ({
  id: randomUUID(),
  taskId,
  actorId: user.id,
  actorName: user.name,
  action,
  note,
  createdAt: new Date().toISOString(),
});

export async function sessionInfo() {
  const mode = dataMode();
  return json({
    mode,
    currentUser: await currentUser(),
    ...(mode === "demo"
      ? await repo.demoDirectory()
      : { users: [], companies: [] }),
  });
}
export async function login(request: Request) {
  const input = loginSchema.parse(await readJson(request));
  const mode = dataMode();
  requireCondition(
    mode !== "unconfigured",
    503,
    "Configure DATABASE_URL to enable sign-in.",
  );
  let user: User | undefined;
  if (mode === "demo") {
    requireCondition("userId" in input, 400, "Select a demo user.");
    user = await repo.findUser(input.userId);
  } else {
    requireCondition("email" in input, 400, "Email and password are required.");
    await repo.consumeLoginAttempt(digest(`account:${input.email}`), 10);
    // On Vercel this header is supplied by the edge, not trusted from arbitrary forwarded headers.
    const clientIp = process.env.VERCEL
      ? request.headers.get("x-vercel-forwarded-for")
      : null;
    if (clientIp) await repo.consumeLoginAttempt(digest(`ip:${clientIp}`), 50);
    const account = await repo.credentials(input.email);
    const valid = await verifyPassword(input.password, account?.passwordHash);
    requireCondition(valid && account, 401, "Email or password is incorrect.");
    user = {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      companyId: account.companyId,
      modules: account.modules ?? undefined,
    };
  }
  requireCondition(user, 401, "Unable to sign in.");
  await signIn(user.id);
  return json({ user, redirectTo: homeFor(user) });
}
export async function logout() {
  await signOut();
  return json({ ok: true });
}
export async function bootstrap() {
  const user = await requireUser();
  return json({
    ...(await repo.loadData(user)),
    currentUser: user,
    mode: dataMode(),
  });
}
export async function createTask(request: Request) {
  const user = await requireUser();
  requireCondition(
    canManage(user),
    403,
    "Only supervisors and managers can assign activities.",
  );
  const input = createTaskSchema.parse(await readJson(request));
  const data = await repo.loadData(user);
  const project = data.projects.find((p) => p.id === input.projectId);
  requireCondition(project, 403, "Choose a project assigned to you.");
  requireCondition(
    commissioning(project).config.priorities.includes(input.priority),
    400,
    "This priority is disabled for this project.",
  );
  const cxError = linkError(input.cx, project, data.tasks);
  requireCondition(!cxError, 400, cxError || "Invalid asset link.");
  const assignee = data.users.find(
    (u) => u.id === input.assignedTo && u.role === "worker",
  );
  requireCondition(
    isProjectMember(user, input.projectId, data) &&
      assignee &&
      isProjectMember(assignee, input.projectId, data),
    403,
    "Choose a worker who belongs to this project and your team.",
  );
  const now = new Date().toISOString();
  const task: Task = {
    ...input,
    id: randomUUID(),
    companyId: assignee.companyId,
    createdBy: user.id,
    status: "pending",
    source: "manual",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  await repo.insertTask(task, activity(task.id, user, "Activity created"));
  return json(task, 201);
}
export async function updateTask(request: Request, id: string) {
  const user = await requireUser();
  const input = updateTaskSchema.parse(await readJson(request));
  const data = await repo.loadData(user);
  const old = data.tasks.find((t) => t.id === id);
  requireCondition(old, 404, "Activity not found.");
  requireCondition(
    old.version === input.version,
    409,
    "This activity changed. Refresh before saving again.",
  );
  const status = input.status ?? old.status;
  const result = input.result ?? old.cx?.result ?? "untested";
  requireCondition(
    !(status === "completed" && ["failed", "retest"].includes(result)),
    400,
    "Resolve the failed test or retest before completing this activity.",
  );
  requireCondition(
    !(
      isClosed(old) &&
      (input.result !== undefined || input.progress !== undefined) &&
      status === old.status
    ),
    400,
    "Reopen the activity before changing its test result or progress.",
  );
  requireCondition(
    input.result === undefined ||
      input.result === old.cx?.result ||
      (input.notes?.trim().length ?? 0) >= 10,
    400,
    "Explain the test result in a note of at least 10 characters.",
  );
  const error = taskUpdateError(
    user,
    old,
    status,
    input.notes ?? "",
    data.attachments.filter((a) => a.taskId === id).length,
  );
  requireCondition(!error, 400, error || "Invalid update.");
  const now = new Date().toISOString();
  const task: Task = {
    ...old,
    status,
    ...(old.cx || input.result !== undefined || input.progress !== undefined
      ? {
          cx: {
            ...old.cx,
            kind: old.cx?.kind ?? (old.source === "manual" ? "task" : "issue"),
            result,
            progress:
              status === "completed"
                ? 100
                : (input.progress ?? old.cx?.progress),
          },
        }
      : {}),
    notes: input.notes ?? old.notes,
    completedAt: isClosed({ ...old, status })
      ? (old.completedAt ?? now)
      : undefined,
    updatedAt: now,
    version: old.version + 1,
  };
  await repo.updateTask(
    task,
    activity(
      id,
      user,
      status !== old.status
        ? `${statusLabels[old.status]} → ${statusLabels[status]}`
        : "Progress update",
      [
        input.notes,
        input.result !== undefined ? `Test result: ${result}` : "",
        input.progress !== undefined ? `Progress: ${input.progress}%` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    old.version,
  );
  return json(task);
}
export async function createShift(request: Request) {
  const user = await requireUser();
  requireCondition(
    hasModule(user, "time"),
    403,
    "Time access is disabled for your profile.",
  );
  requireCondition(
    user.role === "worker",
    403,
    "Site check-in is available to workers.",
  );
  const input = createShiftSchema.parse(await readJson(request));
  const data = await repo.loadData(user);
  const project = data.projects.find((p) => p.id === input.projectId);
  requireCondition(project, 403, "Choose a project assigned to you.");
  const shift: Shift = {
    id: randomUUID(),
    userId: user.id,
    projectId: project.id,
    startTime: new Date().toISOString(),
    checkInMethod: "manual",
    status: "active",
    location: project.location,
    version: 1,
  };
  await repo.insertShift(shift);
  return json(shift, 201);
}
export async function updateShift(request: Request, id: string) {
  const user = await requireUser();
  requireCondition(
    hasModule(user, "time"),
    403,
    "Time access is disabled for your profile.",
  );
  const input = updateShiftSchema.parse(await readJson(request));
  const data = await repo.loadData(user);
  const old = data.shifts.find((s) => s.id === id);
  requireCondition(old, 404, "Timesheet not found.");
  requireCondition(
    old.version === input.version,
    409,
    "This timesheet changed. Refresh and try again.",
  );
  const now = new Date().toISOString();
  const shift = { ...old, version: old.version + 1 };
  if (input.action === "approve" || input.action === "reject") {
    requireCondition(
      canManage(user) && old.userId !== user.id,
      403,
      "You cannot approve or reject this timesheet.",
    );
    requireCondition(
      old.status === "pending-approval",
      400,
      "Only submitted timesheets can be reviewed.",
    );
    if (input.action === "reject")
      requireCondition(
        input.rejectionReason,
        400,
        "Provide a rejection reason.",
      );
    shift.status = input.action === "approve" ? "approved" : "rejected";
    shift.approvedBy = user.id;
    shift.approvedAt = now;
    shift.rejectionReason =
      input.action === "reject" ? input.rejectionReason : undefined;
  } else {
    requireCondition(
      old.userId === user.id,
      403,
      "Only the shift owner can change their timesheet.",
    );
    if (input.action === "end") {
      requireCondition(
        old.status === "active",
        400,
        "This shift has already ended.",
      );
      shift.endTime = now;
      shift.status = "completed";
    } else {
      requireCondition(
        ["completed", "rejected"].includes(old.status) && old.endTime,
        400,
        "End the shift before submitting it.",
      );
      requireCondition(
        !input.manualHours || (input.notes?.length ?? 0) >= 10,
        400,
        "Explain any extra hours in the notes.",
      );
      shift.manualHours = input.manualHours ?? 0;
      shift.notes = input.notes ?? "";
      shift.status = "pending-approval";
      shift.rejectionReason = undefined;
      shift.approvedBy = undefined;
      shift.approvedAt = undefined;
    }
  }
  await repo.updateShift(shift, old.version);
  return json(shift);
}
function fileType(buffer: Buffer) {
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { mime: "image/png", extension: "png" };
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return { mime: "image/jpeg", extension: "jpg" };
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return { mime: "image/webp", extension: "webp" };
  if (buffer.toString("ascii", 0, 5) === "%PDF-")
    return { mime: "application/pdf", extension: "pdf" };
  return null;
}
export async function uploadAttachment(request: Request, taskId: string) {
  const user = await requireUser();
  const data = await repo.loadData(user);
  const task = data.tasks.find((t) => t.id === taskId);
  requireCondition(task, 404, "Activity not found.");
  requireCondition(
    !isClosed(task),
    400,
    "Reopen the activity before adding evidence.",
  );
  requireCondition(
    data.attachments.filter((a) => a.taskId === taskId).length < 20,
    400,
    "Maximum 20 files per activity.",
  );
  const buffer = await readBody(request, 2 * 1024 * 1024);
  const type = fileType(buffer);
  requireCondition(
    type && buffer.length,
    415,
    "Choose a PNG, JPEG, WebP image or PDF (maximum 2 MB).",
  );
  const rawName = decodeURIComponent(
    request.headers.get("x-file-name") || `evidence.${type.extension}`,
  );
  const name = rawName.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 160);
  const file = {
    id: randomUUID(),
    taskId,
    uploadedBy: user.id,
    name,
    contentType: type.mime,
    size: buffer.length,
    data: buffer.toString("base64"),
    createdAt: new Date().toISOString(),
  };
  await repo.insertAttachment(
    file,
    activity(taskId, user, "Evidence uploaded", name),
    task.version,
  );
  return json({ id: file.id, name: file.name }, 201);
}
export async function getAttachment(_request: Request, id: string) {
  const user = await requireUser();
  const data = await repo.loadData(user);
  requireCondition(
    data.attachments.some((a) => a.id === id),
    404,
    "Evidence not found.",
  );
  const file = await repo.attachment(id);
  requireCondition(file, 404, "Evidence not found.");
  return new Response(Buffer.from(file.data, "base64"), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}
export async function createFeedback(request: Request) {
  const user = await requireUser();
  requireCondition(
    hasModule(user, "feedback"),
    403,
    "Feedback access is disabled for your profile.",
  );
  const input = feedbackSchema.parse(await readJson(request, 1600000));
  const data = await repo.loadData(user);
  requireCondition(
    isProjectMember(user, input.projectId, data),
    403,
    "Choose an assigned project.",
  );
  if (input.screenshot) {
    requireCondition(
      /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(input.screenshot),
      400,
      "Screenshot must be PNG.",
    );
    requireCondition(
      fileType(Buffer.from(input.screenshot.split(",")[1], "base64"))?.mime ===
        "image/png",
      400,
      "Invalid screenshot.",
    );
  }
  const item = {
    ...input,
    id: randomUUID(),
    userId: user.id,
    createdAt: new Date().toISOString(),
    hasScreenshot: !!input.screenshot,
  };
  await repo.insertFeedback(item);
  return json({ id: item.id }, 201);
}
export async function getFeedbackScreenshot(_request: Request, id: string) {
  const user = await requireUser();
  const data = await repo.loadData(user);
  requireCondition(
    data.feedback.some((f) => f.id === id),
    404,
    "Feedback not found.",
  );
  const screenshot = await repo.feedbackScreenshot(id);
  requireCondition(screenshot, 404, "No screenshot attached.");
  return new Response(Buffer.from(screenshot.split(",")[1], "base64"), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
