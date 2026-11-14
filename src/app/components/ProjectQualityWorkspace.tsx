"use client";
import { useState } from "react";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { commissioning } from "@/lib/commissioning";
import type { ChecksheetCommand } from "@/lib/checksheets";
import { ChecksheetWorkspace } from "./ChecksheetWorkspace";
import { WorksToGoWorkspace } from "./WorksToGoWorkspace";

export function ProjectQualityWorkspace() {
  const app = useApp(),
    [busy, setBusy] = useState(false);
  const project = app.projects.find(
    (project) => project.id === app.selectedProjectId,
  );
  if (!project)
    return (
      <AppShell title="Checksheets and remaining work">
        <p>No project assigned.</p>
      </AppShell>
    );
  const state = commissioning(project),
    tasks = app.tasks.filter((task) => task.projectId === project.id);
  const members = new Set(
    app.memberships
      .filter((m) => m.projectId === project.id)
      .map((m) => m.userId),
  );
  async function command(command: ChecksheetCommand) {
    setBusy(true);
    try {
      await app.mutate(`/api/projects/${project!.id}/checksheets`, {
        method: "PATCH",
        body: JSON.stringify({
          version: state.version,
          reason: `Checksheet workspace: ${command.kind}`,
          command,
        }),
      });
    } finally {
      setBusy(false);
    }
  }
  const props = {
    state: state.checksheets,
    assets: state.assets,
    currentUser: app.currentUser,
    tasks,
    onCommand: command,
    busy: busy || !app.isOnline,
  };
  return (
    <AppShell
      title="Checksheets and remaining work"
      subtitle={`${project.name} · Requirements, recorded answers and configured signatories.`}
      wide
    >
      {!app.isOnline && (
        <p
          role="status"
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
        >
          You’re offline. Reconnect before saving answers, signatures or
          remaining work.
        </p>
      )}
      <ChecksheetWorkspace
        key={`checksheets-${project.id}`}
        {...props}
        users={app.users.filter((user) => members.has(user.id))}
      />
      <div className="border-t border-slate-200 pt-6">
        <WorksToGoWorkspace key={`remaining-work-${project.id}`} {...props} />
      </div>
    </AppShell>
  );
}
