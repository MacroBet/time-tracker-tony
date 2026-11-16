import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "./auth";
import {
  loadData,
  credentials,
  putAccount,
  putProject,
  changePassword,
  setProjectAccess,
  renameProjectProfile,
} from "./repository";
import { json, readJson } from "./http";
import { requireCondition } from "./errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createProjectInput,
  renameProjectInput,
  projectIdForRequest,
  projectCreationEvent,
  projectRenameEvent,
} from "./project-profile";
const password = z.string().min(8).max(256);
export async function createAccount(request: Request) {
  const admin = await requireUser();
  requireCondition(
    admin.role === "admin",
    403,
    "Only admins can create accounts.",
  );
  const input = z
    .object({
      name: z.string().trim().min(2).max(100),
      email: z
        .email()
        .max(254)
        .transform((v) => v.toLowerCase()),
      password,
      role: z.enum(["worker", "supervisor", "manager", "admin"]),
      companyId: z.string().min(1),
      projectIds: z.array(z.string().min(1)).min(1).max(50),
    })
    .strict()
    .parse(await readJson(request));
  const data = await loadData(admin);
  requireCondition(
    data.companies.some((c) => c.id === input.companyId) &&
      input.projectIds.every((id) => data.projects.some((p) => p.id === id)),
    403,
    "Choose companies and projects in your workspace.",
  );
  requireCondition(
    !(await credentials(input.email)),
    409,
    "An account with this email already exists.",
  );
  const user = {
    id: randomUUID(),
    name: input.name,
    email: input.email,
    companyId: input.companyId,
    role: input.role,
  };
  await putAccount(user, await hashPassword(input.password), [
    ...new Set(input.projectIds),
  ]);
  return json(user, 201);
}
export async function createProject(request: Request) {
  const admin = await requireUser();
  requireCondition(
    admin.role === "admin",
    403,
    "Only admins can create projects.",
  );
  const input = createProjectInput.parse(await readJson(request));
  const data = await loadData(admin);
  requireCondition(
    data.companies.some((c) => c.id === input.companyId),
    403,
    "Choose a company in your workspace.",
  );
  const requestId = input.requestId ?? randomUUID();
  const project = {
    id: projectIdForRequest(admin.id, requestId),
    name: input.name,
    location: input.location,
    companyId: input.companyId,
  };
  const saved = await putProject(
    project,
    admin.id,
    projectCreationEvent(project, admin, requestId),
  );
  return json(
    {
      id: saved.id,
      name: saved.name,
      location: saved.location,
      companyId: saved.companyId,
      requestId,
    },
    201,
  );
}
export async function renameProject(request: Request, id: string) {
  const admin = await requireUser();
  requireCondition(
    admin.role === "admin",
    403,
    "Only admins can rename projects.",
  );
  const input = renameProjectInput.parse(await readJson(request));
  const data = await loadData(admin);
  const project = data.projects.find((row) => row.id === id);
  requireCondition(project, 404, "Project not found in your workspace.");
  requireCondition(
    input.name !== input.expectedName,
    400,
    "Choose a different FieldTrack project name.",
  );
  if (input.preview) {
    requireCondition(
      project.name === input.expectedName,
      409,
      "The project name changed. Refresh and review the rename again.",
    );
    return json({
      projectId: id,
      before: project.name,
      name: input.name,
      reason: input.reason,
      requestId: input.requestId,
    });
  }
  const saved = await renameProjectProfile(
    id,
    admin.id,
    input.expectedName,
    input.name,
    projectRenameEvent(project, admin, input),
  );
  return json({
    id: saved.id,
    name: saved.name,
    location: saved.location,
    companyId: saved.companyId,
  });
}
export async function updatePassword(request: Request) {
  const user = await requireUser();
  const input = z
    .object({
      currentPassword: z.string().min(1).max(256),
      newPassword: password,
    })
    .strict()
    .parse(await readJson(request));
  const account = await credentials(user.email);
  requireCondition(
    account &&
      (await verifyPassword(input.currentPassword, account.passwordHash)),
    400,
    "Current password is incorrect.",
  );
  await changePassword(user.id, await hashPassword(input.newPassword));
  return json({ updated: true });
}
export async function updateAccess(request: Request, id: string) {
  const admin = await requireUser();
  requireCondition(
    admin.role === "admin",
    403,
    "Only admins can manage project access.",
  );
  const input = z
    .object({ projectIds: z.array(z.string().min(1)).max(50) })
    .strict()
    .parse(await readJson(request));
  const data = await loadData(admin);
  requireCondition(
    data.users.some((u) => u.id === id),
    404,
    "Account not found in your projects.",
  );
  requireCondition(
    id !== admin.id,
    400,
    "You cannot remove or change your own project access here.",
  );
  requireCondition(
    input.projectIds.every((p) => data.projects.some((x) => x.id === p)),
    403,
    "Choose projects in your workspace.",
  );
  const removed = data.memberships
    .filter((m) => m.userId === id && !input.projectIds.includes(m.projectId))
    .map((m) => m.projectId);
  requireCondition(
    !data.tasks.some(
      (t) =>
        t.assignedTo === id &&
        removed.includes(t.projectId) &&
        !["completed", "not-applicable"].includes(t.status),
    ),
    409,
    "Reassign this worker’s open activities before removing project access.",
  );
  await setProjectAccess(
    id,
    data.projects.map((p) => p.id),
    [...new Set(input.projectIds)],
  );
  return json({ updated: true });
}
