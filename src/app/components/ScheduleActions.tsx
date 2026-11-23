"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { commissioning } from "@/lib/commissioning";
import type { Project } from "@/lib/domain";
import {
  schedulePanelCommandEvent,
  schedulePanelCommandResultEvent,
  schedulePanelCommandSchema,
  type SchedulePanel,
} from "@/lib/schedule-view-context";
import { useApp } from "../contexts/AppContext";
import { ProjectAudit } from "./ProjectAudit";
import { ProgrammeReference } from "./ProgrammeReference";
import { ScheduleExport } from "./ScheduleExport";
import {
  SourceProgrammeImport,
  SourceProgrammeRestore,
} from "./SourceProgrammeWorkspace";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

const actions = [
  { panel: "import", label: "Import" },
  { panel: "changes", label: "Changes" },
  { panel: "export", label: "Export" },
] as const;

export function ScheduleActions({
  project,
  openImport,
}: {
  project: Project;
  openImport: boolean;
}) {
  const app = useApp();
  const id = useId();
  const { version, sourceProgrammeSummary: source } = commissioning(project);
  const [panel, setPanel] = useState<SchedulePanel | null>(
    openImport ? "import" : null,
  );
  const [request, setRequest] = useState<{
    requestId: string;
    projectVersion: number;
    panel: SchedulePanel;
  } | null>(null);
  useEffect(() => {
    const receive = (event: Event) => {
      const input = schedulePanelCommandSchema.safeParse(
        (event as CustomEvent<unknown>).detail,
      );
      if (!input.success || input.data.projectId !== project.id) return;
      const command = input.data;
      if (command.projectVersion !== version) {
        window.dispatchEvent(
          new CustomEvent(schedulePanelCommandResultEvent, {
            detail: {
              requestId: command.requestId,
              projectId: project.id,
              projectVersion: command.projectVersion,
              ok: false,
              error: "The Schedule changed. Refresh it and try again.",
            },
          }),
        );
        return;
      }
      setRequest(command);
      setPanel(command.panel);
    };
    window.addEventListener(schedulePanelCommandEvent, receive);
    return () => window.removeEventListener(schedulePanelCommandEvent, receive);
  }, [project.id, version]);
  useEffect(() => {
    if (!request || panel !== request.panel) return;
    const ok = request.projectVersion === version;
    window.dispatchEvent(
      new CustomEvent(schedulePanelCommandResultEvent, {
        detail: {
          requestId: request.requestId,
          projectId: project.id,
          projectVersion: request.projectVersion,
          ok,
          ...(!ok
            ? { error: "The Schedule changed. Refresh it and try again." }
            : {}),
        },
      }),
    );
  }, [panel, request, project.id, version]);

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="group"
      aria-label="Schedule actions"
    >
      {actions.map(({ panel: action, label }) => (
        <Popover
          key={action}
          open={panel === action}
          onOpenChange={(open) => {
            setRequest(null);
            setPanel((current) =>
              open ? action : current === action ? null : current,
            );
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="ghost" className="min-h-11 px-2.5 sm:px-3">
              {label}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            collisionPadding={12}
            aria-labelledby={`${id}-${action}`}
            className="max-h-[var(--radix-popover-content-available-height)] w-[min(32rem,calc(100vw-1.5rem))] space-y-4 overflow-y-auto overscroll-contain bg-white"
          >
            <h2 id={`${id}-${action}`} className="text-base font-semibold">
              {label}
            </h2>
            {action === "import" ? (
              <>
                <SourceProgrammeImport
                  projectId={project.id}
                  projectName={project.name}
                  version={version}
                  onImported={app.refreshData}
                />
                <Link
                  href={`/commissioning?projectId=${encodeURIComponent(project.id)}#import-register`}
                  className="inline-flex min-h-11 items-center text-sm text-blue-700 underline underline-offset-4"
                >
                  Import an asset or managed schedule register
                </Link>
              </>
            ) : action === "changes" ? (
              <>
                <ProjectAudit projectId={project.id} refreshKey={version} />
                <ProgrammeReference project={project} />
                {source && (
                  <details className="border-t text-sm text-slate-700">
                    <summary className="min-h-11 cursor-pointer content-center font-medium">
                      Schedule source
                    </summary>
                    <p className="break-words">{source.fileName}</p>
                    <p className="mt-1 break-all font-mono text-xs">
                      SHA256 {source.sha256}
                    </p>
                    <p className="mt-2 leading-6">
                      The original file retains WBS, calendars, resource
                      assignments and source date fields.
                    </p>
                    {app.currentUser.role === "admin" && (
                      <div className="mt-3">
                        <SourceProgrammeRestore
                          projectId={project.id}
                          version={version}
                          sourceSha256={source.sha256}
                          onRestored={app.refreshData}
                        />
                      </div>
                    )}
                  </details>
                )}
              </>
            ) : (
              <ScheduleExport
                projectId={project.id}
                version={version}
                hasSource={Boolean(source)}
              />
            )}
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
