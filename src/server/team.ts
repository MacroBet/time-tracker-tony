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
} from "./repository";
import { json, readJson } from "./http";
import { requireCondition } from "./errors";
import { hashPassword, verifyPassword } from "@/lib/password";
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
  const input = z
    .object({
      name: z.string().trim().min(3).max(150),
      location: z.string().trim().min(2).max(200),
      companyId: z.string().min(1),
    })
    .strict()
    .parse(await readJson(request));
  const data = await loadData(admin);
  requireCondition(
    data.companies.some((c) => c.id === input.companyId),
    403,
    "Choose a company in your workspace.",
  );
  const project = { id: randomUUID(), ...input };
  await putProject(project, admin.id);
  return json(project, 201);
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
