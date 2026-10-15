"use client";
import { ProjectAccess } from "./ProjectAccess";
import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, List, Search } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../contexts/AppContext";
import { statusLabels, type Task } from "@/lib/domain";
import {
  filterTeamWork,
  teamWorkload,
  workloadSegments,
} from "@/lib/team-workload";
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
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("all");
  const [role, setRole] = useState("all");
  const [workState, setWorkState] = useState<"all" | "open" | "closed">("all");
  const [workKind, setWorkKind] = useState<"all" | "tasks" | "issues">("all");
  const [view, setView] = useState<"cards" | "list">("cards");
  const people = users
    .filter(
      (user) =>
        (project === "all" ||
          memberships.some(
            (membership) =>
              membership.userId === user.id && membership.projectId === project,
          )) &&
        (company === "all" || user.companyId === company) &&
        (role === "all" || user.role === role) &&
        `${user.name} ${companies.find((item) => item.id === user.companyId)?.name ?? ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .map((user) => {
      const work = filterTeamWork(
        tasks.filter(
          (task) =>
            task.assignedTo === user.id &&
            (project === "all" || task.projectId === project),
        ),
        workKind,
        workState,
      );
      return { user, work, summary: teamWorkload(work) };
    })
    .filter(
      ({ work }) =>
        (workState === "all" && workKind === "all") || work.length > 0,
    );
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
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-52 flex-1 text-xs text-slate-600">
            Search person or company
            <span className="relative mt-1 block">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name or company"
                className="pl-9"
              />
            </span>
          </label>
          <div className="flex gap-1" role="group" aria-label="Team view">
            <Button
              variant={view === "cards" ? "secondary" : "outline"}
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
            >
              <LayoutGrid className="size-4" />
              Cards
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "outline"}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List className="size-4" />
              List
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-xs text-slate-600">
            Company
            <select
              className="field-select mt-1"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            >
              <option value="all">All companies</option>
              {companies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Role
            <select
              className="field-select mt-1"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="all">All roles</option>
              {["worker", "supervisor", "manager", "admin"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Work type
            <select
              className="field-select mt-1"
              value={workKind}
              onChange={(event) =>
                setWorkKind(event.target.value as typeof workKind)
              }
            >
              <option value="all">All work</option>
              <option value="tasks">Activities (excluding issues)</option>
              <option value="issues">Issues only</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Work status
            <select
              className="field-select mt-1"
              value={workState}
              onChange={(event) =>
                setWorkState(event.target.value as typeof workState)
              }
            >
              <option value="all">Open and closed</option>
              <option value="open">Open work</option>
              <option value="closed">Closed work</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-slate-600" role="status">
          {people.length} people shown. Counts and progress use the selected
          project and work filters. N/A records are excluded from completion.
        </p>
      </div>
      <div
        className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600"
        aria-label="Workload colour legend"
      >
        {workloadSegments.map((segment) => (
          <span key={segment.key} className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: segment.color }}
            />
            {segment.label}
          </span>
        ))}
      </div>
      {view === "cards" ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {people.map(({ user: u, work, summary }) => (
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
                  {summary.open} open · {summary.review} to review ·{" "}
                  {summary.completed} completed
                </p>
                <WorkloadProgress summary={summary} name={u.name} />
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
                <WorkDetails work={work} />
                {currentUser.role === "admin" && u.id !== currentUser.id && (
                  <ProjectAccess userId={u.id} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Filtered team workload</caption>
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                {[
                  "Person / company",
                  "Role",
                  "Open",
                  "To review",
                  "Completed",
                  "Completion / assigned work",
                  "Project access",
                ].map((heading) => (
                  <th key={heading} scope="col" className="p-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map(({ user, work, summary }) => (
                <tr key={user.id} className="border-t align-top">
                  <th scope="row" className="min-w-48 p-3 font-medium">
                    {user.name}
                    <span className="block text-xs font-normal text-slate-600">
                      {
                        companies.find((item) => item.id === user.companyId)
                          ?.name
                      }
                    </span>
                  </th>
                  <td className="p-3">{user.role}</td>
                  <td className="p-3 tabular-nums">{summary.open}</td>
                  <td className="p-3 tabular-nums">{summary.review}</td>
                  <td className="p-3 tabular-nums">{summary.completed}</td>
                  <td className="min-w-64 p-3">
                    <WorkloadProgress summary={summary} name={user.name} />
                    <WorkDetails work={work} />
                  </td>
                  <td className="min-w-48 p-3">
                    {currentUser.role === "admin" &&
                    user.id !== currentUser.id ? (
                      <ProjectAccess userId={user.id} />
                    ) : (
                      <span className="text-xs text-slate-600">
                        {projects
                          .filter((item) =>
                            memberships.some(
                              (membership) =>
                                membership.userId === user.id &&
                                membership.projectId === item.id,
                            ),
                          )
                          .map((item) => item.name)
                          .join(", ") || "No project access"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!people.length && (
        <p className="rounded-xl border bg-white p-6 text-sm text-slate-600">
          No people match these filters. Clear the search or broaden the
          company, role or work filters.
        </p>
      )}
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

function WorkloadProgress({
  summary,
  name,
}: {
  summary: ReturnType<typeof teamWorkload>;
  name: string;
}) {
  return (
    <div className="space-y-1.5">
      <div
        role="img"
        aria-label={`${name}: ${workloadSegments.map((segment) => `${summary.counts[segment.key]} ${segment.label.toLowerCase()}`).join(", ")}; ${summary.notApplicable} not applicable`}
        className="flex h-2.5 overflow-hidden rounded-full bg-slate-100"
      >
        {workloadSegments.map((segment) => (
          <span
            key={segment.key}
            style={{
              backgroundColor: segment.color,
              width: `${summary.total ? (100 * summary.counts[segment.key]) / summary.total : 0}%`,
            }}
            title={`${segment.label}: ${summary.counts[segment.key]}`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-600 tabular-nums">
        {summary.percent === null
          ? "No applicable work assigned"
          : `${summary.percent}% complete · ${summary.completed} / ${summary.total}`}
        {summary.notApplicable > 0 && ` · ${summary.notApplicable} N/A`}
      </p>
    </div>
  );
}

function WorkDetails({ work }: { work: Task[] }) {
  return work.length > 0 ? (
    <details className="pt-2">
      <summary className="cursor-pointer text-xs text-blue-600">
        View {work.length} assigned records
      </summary>
      <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
        {work.map((task) => (
          <li key={task.id}>
            <Link
              href={`/tasks/${task.id}`}
              className="block rounded py-1 text-xs hover:bg-slate-50 focus-visible:outline-blue-600"
            >
              <span className="font-medium">{task.title}</span>
              <span className="block text-slate-600">
                {statusLabels[task.status]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  ) : null;
}
