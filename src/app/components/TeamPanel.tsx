"use client";
import { ProjectAccess } from "./ProjectAccess";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "../contexts/AppContext";
import { isClosed } from "@/lib/domain";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
export function TeamPanel() {
  const {
    currentUser,
    users,
    projects,
    companies,
    memberships,
    tasks,
    mutate,
    isOnline,
  } = useApp();
  const [busy, setBusy] = useState(false);
  const [project, setProject] = useState("all");
  async function submit(
    event: React.FormEvent<HTMLFormElement>,
    kind: "account" | "project",
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      const body =
        kind === "account"
          ? {
              name: data.get("name"),
              email: data.get("email"),
              password: data.get("password"),
              role: data.get("role"),
              companyId: data.get("companyId"),
              projectIds: data.getAll("projectIds"),
            }
          : {
              name: data.get("name"),
              location: data.get("location"),
              companyId: data.get("companyId"),
            };
      await mutate(kind === "account" ? "/api/team" : "/api/projects", {
        method: "POST",
        body: JSON.stringify(body),
      });
      form.reset();
      toast.success(
        kind === "account"
          ? "Account created with project access"
          : "Project created",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-lg font-semibold">Project team and workload</h2>
        <select
          aria-label="Team project"
          className="field-select sm:max-w-xs"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="all">All supervised projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <p className="text-sm text-slate-500">
        Supervisors coordinate the projects listed for their account. Workers
        see only work assigned to them. Use Activities → To assign to distribute
        the remaining work.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {users
          .filter(
            (u) =>
              project === "all" ||
              memberships.some(
                (m) => m.userId === u.id && m.projectId === project,
              ),
          )
          .map((u) => {
            const work = tasks.filter(
              (t) =>
                t.assignedTo === u.id &&
                (project === "all" || t.projectId === project),
            );
            return (
              <Card key={u.id}>
                <CardContent className="p-4 space-y-2">
                  <p className="font-semibold">{u.name}</p>
                  <p className="text-xs text-slate-500 break-all">
                    {u.email} · {u.role}
                  </p>
                  <p className="text-xs text-slate-500">
                    {companies.find((c) => c.id === u.companyId)?.name}
                  </p>
                  <p className="text-sm">
                    {work.filter((t) => !isClosed(t)).length} open ·{" "}
                    {work.filter((t) => t.status === "review").length} to review
                    · {work.filter((t) => t.status === "completed").length}{" "}
                    completed
                  </p>
                  <p className="text-xs text-slate-500">
                    {projects
                      .filter((p) =>
                        memberships.some(
                          (m) => m.userId === u.id && m.projectId === p.id,
                        ),
                      )
                      .map((p) => p.name)
                      .join(", ")}
                  </p>
                  {currentUser.role === "admin" && u.id !== currentUser.id && (
                    <ProjectAccess userId={u.id} />
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>
      {currentUser.role === "admin" && (
        <div className="grid md:grid-cols-2 gap-4">
          <details className="rounded-xl border bg-white p-5">
            <summary className="font-semibold cursor-pointer">
              Create team account
            </summary>
            <form
              onSubmit={(e) => submit(e, "account")}
              className="mt-4 space-y-3"
            >
              <Input
                name="name"
                aria-label="Account name"
                placeholder="Full name"
                required
                minLength={2}
                maxLength={100}
              />
              <Input
                name="email"
                aria-label="Account email"
                type="email"
                placeholder="Email"
                required
              />
              <Input
                name="password"
                aria-label="Initial password"
                type="password"
                autoComplete="new-password"
                placeholder="Initial password (8+ characters)"
                required
                minLength={8}
              />
              <select
                name="role"
                aria-label="Account role"
                className="field-select"
              >
                {["worker", "supervisor", "manager", "admin"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <select
                name="companyId"
                aria-label="Account company"
                className="field-select"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <fieldset className="space-y-2">
                <legend className="text-sm mb-2">
                  Project access (choose at least one)
                </legend>
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      name="projectIds"
                      type="checkbox"
                      value={p.id}
                      className="size-5"
                    />
                    {p.name}
                  </label>
                ))}
              </fieldset>
              <Button disabled={busy || !isOnline}>Create account</Button>
            </form>
          </details>
          <details className="rounded-xl border bg-white p-5">
            <summary className="font-semibold cursor-pointer">
              Create project
            </summary>
            <form
              onSubmit={(e) => submit(e, "project")}
              className="mt-4 space-y-3"
            >
              <Input
                name="name"
                aria-label="Project name"
                placeholder="Project name"
                required
                minLength={3}
              />
              <Input
                name="location"
                aria-label="Project location"
                placeholder="Location"
                required
                minLength={2}
              />
              <select
                name="companyId"
                aria-label="Project company"
                className="field-select"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                You will administer the new project. Create team accounts with
                access to it to start assigning work.
              </p>
              <Button disabled={busy || !isOnline}>Create project</Button>
            </form>
          </details>
        </div>
      )}
    </div>
  );
}
