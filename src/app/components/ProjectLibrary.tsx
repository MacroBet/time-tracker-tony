"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Search } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import {
  canEditProjectLessons,
  canReadLessonSource,
  canReadProjectLibrary,
  type ProjectLibraryPage,
  type ProjectLibraryResult,
} from "@/lib/project-library";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { InfoPopover } from "./InfoPopover";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

const selectClass =
  "min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const kindLabels = { asset: "Asset", issue: "Issue", lesson: "Lesson" };
type Draft = {
  result: ProjectLibraryResult;
  title: string;
  content: string;
  reason: string;
};

export function ProjectLibrary() {
  const app = useApp();
  const [search, setSearch] = useState("");
  const [q, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [kind, setKind] = useState("all");
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{
    key: string;
    page: ProjectLibraryPage;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);
  const canRead = canReadProjectLibrary(app.currentUser);
  const canEdit = canEditProjectLessons(app.currentUser);
  const params = new URLSearchParams({
    q,
    kind,
    offset: String(offset),
    limit: "20",
  });
  if (projectId) params.set("projectId", projectId);
  const queryString = params.toString();
  const key = JSON.stringify([
    queryString,
    app.lastSyncTime?.toISOString(),
    retry,
    canRead,
    app.currentUser.role,
    app.currentUser.modules,
    app.memberships.filter((member) => member.userId === app.currentUser.id),
  ]);
  const page = response?.key === key ? response.page : null;
  const error = failure?.key === key ? failure.message : "";
  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    void apiRequest<ProjectLibraryPage>(`/api/library?${queryString}`, {
      signal: controller.signal,
    })
      .then((result) => setResponse({ key, page: result }))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setFailure({
            key,
            message:
              reason instanceof Error
                ? reason.message
                : "The library could not load. Please retry.",
          });
      });
    return () => controller.abort();
  }, [queryString, key, canRead]);

  function startLesson(result: ProjectLibraryResult) {
    setDraft({
      result,
      title: result.lesson?.title ?? "",
      content: result.lesson?.content ?? "",
      reason: "",
    });
    setSaveError("");
    requestAnimationFrame(() => titleInput.current?.focus());
  }
  async function saveLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving || !canEdit || !draft.result.assetId) return;
    setSaving(true);
    setSaveError("");
    const { result } = draft;
    try {
      await app.mutate("/api/library", {
        method: result.lesson ? "PATCH" : "POST",
        body: JSON.stringify({
          projectId: result.projectId,
          version: result.projectVersion,
          reason: draft.reason,
          command: {
            kind: result.lesson ? "update" : "create",
            ...(result.lesson
              ? { id: result.lesson.id, lessonVersion: result.lesson.version }
              : {}),
            title: draft.title,
            content: draft.content,
            source: {
              projectId: result.projectId,
              assetId: result.assetId,
              ...(result.taskId ? { taskId: result.taskId } : {}),
            },
            visibility: "project",
          },
        }),
      });
      setDraft(null);
      setRetry((value) => value + 1);
      toast.success(
        result.lesson ? "Lesson updated." : "Lesson saved to this project.",
      );
    } catch (reason) {
      setSaveError(
        reason instanceof Error
          ? reason.message
          : "The lesson could not save. Please retry.",
      );
    } finally {
      setSaving(false);
    }
  }
  const sourceStillVisible =
    draft &&
    app.projects.some(
      (project) =>
        project.id === draft.result.projectId &&
        !!draft.result.assetId &&
        canReadLessonSource(app, app.currentUser, project, {
          projectId: project.id,
          assetId: draft.result.assetId,
          taskId: draft.result.taskId,
        }),
    );

  return (
    <AppShell title="Project library" wide>
      {!canRead ? (
        <p role="alert">
          Management commissioning access is required to open the library.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              Search assets, issues and saved lessons across your assigned
              projects.
            </p>
            <InfoPopover label="About project library access">
              <p>
                Results follow your current project membership and feature
                access. Issues open their original record; no private notes are
                copied into the library.
              </p>
              <p>
                Managers and administrators can explicitly save a lesson linked
                to an asset or its issue. Lessons are visible only within their
                source project.
              </p>
            </InfoPopover>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(search.trim());
              setOffset(0);
              setRetry((value) => value + 1);
            }}
            className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_minmax(12rem,18rem)_10rem_auto]"
          >
            <label className="space-y-1 text-sm font-medium">
              Search library
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                maxLength={200}
                placeholder="Asset, equipment or issue…"
                type="search"
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Project
              <select
                className={selectClass}
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All assigned projects</option>
                {app.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Record type
              <select
                className={selectClass}
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value);
                  setOffset(0);
                }}
              >
                <option value="all">All types</option>
                <option value="asset">Assets</option>
                <option value="issue">Issues</option>
                <option value="lesson">Lessons</option>
              </select>
            </label>
            <Button type="submit" disabled={!app.isOnline}>
              <Search className="size-4" aria-hidden="true" />
              Search
            </Button>
          </form>
          {!app.isOnline && (
            <p role="status" className="text-sm text-amber-800">
              You are offline. Reconnect to search or save a lesson.
            </p>
          )}
          {draft && canEdit && sourceStillVisible && (
            <form
              onSubmit={saveLesson}
              aria-label={
                draft.result.lesson
                  ? "Edit project lesson"
                  : "Save project lesson"
              }
              className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
            >
              <div>
                <h2 className="text-lg font-semibold">
                  {draft.result.lesson ? "Edit lesson" : "Save a lesson"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Source: {draft.result.title} · {draft.result.projectName}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Visible to authorized members of this project.
                </p>
              </div>
              <label className="block space-y-1 text-sm font-medium">
                Lesson title
                <Input
                  ref={titleInput}
                  required
                  minLength={3}
                  maxLength={200}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                  disabled={saving}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Lesson learned
                <Textarea
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={5}
                  value={draft.content}
                  onChange={(event) =>
                    setDraft({ ...draft, content: event.target.value })
                  }
                  disabled={saving}
                  placeholder="Record the learning you want to share with this project."
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Reason for saving
                <Input
                  required
                  minLength={10}
                  maxLength={1000}
                  value={draft.reason}
                  onChange={(event) =>
                    setDraft({ ...draft, reason: event.target.value })
                  }
                  disabled={saving}
                  placeholder="Explain this addition or change for project history."
                />
              </label>
              {saveError && (
                <p role="alert" className="text-sm text-red-700">
                  {saveError} Your text is kept here. Reopen the current source
                  to start from its latest version.
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !app.isOnline}
                  aria-busy={saving}
                >
                  {saving ? "Saving…" : "Save lesson"}
                </Button>
              </div>
            </form>
          )}
          {error ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 text-sm text-red-700"
            >
              <p>{error}</p>
              <Button
                variant="outline"
                disabled={!app.isOnline}
                onClick={() => setRetry((value) => value + 1)}
              >
                Retry
              </Button>
            </div>
          ) : !page ? (
            <p role="status" className="text-sm text-slate-600">
              Loading library…
            </p>
          ) : (
            <section aria-label="Library results" className="space-y-3">
              <p role="status" className="text-sm text-slate-600">
                {page.total.toLocaleString()}{" "}
                {page.total === 1 ? "result" : "results"} ·{" "}
                {page.facets.kinds.asset.toLocaleString()} assets ·{" "}
                {page.facets.kinds.issue.toLocaleString()} issues ·{" "}
                {page.facets.kinds.lesson.toLocaleString()} lessons
              </p>
              {!page.total ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <h2 className="font-semibold">No matching records</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Try a different term or search all assigned projects.
                    Lessons appear after a manager saves one from an asset or
                    issue.
                  </p>
                  {(q || projectId || kind !== "all") && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setSearch("");
                        setQuery("");
                        setProjectId("");
                        setKind("all");
                        setOffset(0);
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white px-4 sm:px-5">
                  {page.results.map((result) => (
                    <li key={result.key} className="min-w-0 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 basis-64">
                          <p className="text-sm text-slate-600">
                            {kindLabels[result.kind]} · {result.projectName}
                          </p>
                          <h2 className="mt-1 break-words font-semibold text-slate-900">
                            {result.title}
                          </h2>
                          {result.snippet && (
                            <p className="mt-2 max-w-prose break-words text-sm leading-6 text-slate-700">
                              {result.snippet}
                            </p>
                          )}
                          {result.lesson && (
                            <p className="mt-2 text-xs text-slate-600">
                              Version {result.lesson.version} · Saved by{" "}
                              {result.lesson.updatedByName} ·{" "}
                              {new Date(
                                result.lesson.updatedAt,
                              ).toLocaleDateString("en-GB")}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button asChild variant="outline">
                            <Link
                              href={result.sourceHref}
                              aria-label={`Open source for ${result.title}`}
                            >
                              <ArrowUpRight
                                className="size-4"
                                aria-hidden="true"
                              />
                              Open source
                            </Link>
                          </Button>
                          {canEdit && result.assetId && (
                            <Button
                              variant="ghost"
                              onClick={() => startLesson(result)}
                            >
                              <BookOpen className="size-4" aria-hidden="true" />
                              {result.lesson ? "Edit lesson" : "Save lesson"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {page.total > page.limit && (
                <nav
                  aria-label="Library result pages"
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <p className="text-sm text-slate-600">
                    {page.offset + 1}–
                    {Math.min(page.offset + page.limit, page.total)} of{" "}
                    {page.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={offset === 0}
                      onClick={() =>
                        setOffset(Math.max(0, offset - page.limit))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      disabled={offset + page.limit >= page.total}
                      onClick={() => setOffset(offset + page.limit)}
                    >
                      Next
                    </Button>
                  </div>
                </nav>
              )}
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
