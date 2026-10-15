"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  FileEdit,
  ListChecks,
  MessageSquare,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import {
  canUseCopilot,
  type CopilotAnswer,
  type CopilotChatMessage,
  type CopilotContext,
  type CopilotProposalResponse,
  type CopilotSource,
  type CopilotTaskProposalDraft,
  type CopilotTask,
} from "@/lib/copilot";
import type { CopilotStatus } from "@/lib/copilot-provider";
import { statusLabels, type Task } from "@/lib/domain";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

type ContextResponse = CopilotContext & { configuration: CopilotStatus };
type Message = CopilotChatMessage & { answer?: CopilotAnswer };

function recentHistory(messages: Message[]): CopilotChatMessage[] {
  const history = messages.slice(-12).map(({ role, text }) => ({
    role,
    text:
      text.length > 4000 ? `${text.slice(0, 3974)}\n[History shortened]` : text,
  }));
  while (history.length && history[0].role !== "user") history.shift();
  while (history.reduce((total, item) => total + item.text.length, 0) > 24000) {
    history.shift();
    while (history.length && history[0].role !== "user") history.shift();
  }
  return history;
}

export function CopilotWorkspace() {
  const { projects, selectedProjectId, currentUser } = useApp();
  const project = projects.find((item) => item.id === selectedProjectId);
  return (
    <AppShell
      title="Project copilot"
      subtitle="Check saved project records and review changes before they are applied."
      wide
    >
      {!canUseCopilot(currentUser) ? (
        <p className="text-sm text-slate-600">
          Copilot requires management access to Tasks and Commissioning. Ask
          your administrator if you need access.
        </p>
      ) : project ? (
        <CopilotSession key={project.id} projectId={project.id} />
      ) : (
        <p className="text-sm text-slate-600">
          Choose an assigned project to open its copilot.
        </p>
      )}
    </AppShell>
  );
}

function CopilotSession({ projectId }: { projectId: string }) {
  const { isOnline } = useApp();
  const [context, setContext] = useState<ContextResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [suggestion, setSuggestion] = useState<{
    draft: CopilotTaskProposalDraft;
    key: number;
  } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const suggestionSequence = useRef(0);
  const chatLock = useRef(false);
  const mounted = useRef(true);
  const composer = useRef<HTMLTextAreaElement>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/copilot`;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<ContextResponse>(endpoint, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setContext(result);
          setLoadError("");
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Project checks could not load.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [endpoint, retry]);
  useEffect(() => {
    if (manualOpen) editorHeading.current?.focus();
  }, [manualOpen, suggestion]);
  useEffect(() => {
    if (messages.length)
      transcriptEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);
  const refreshContext = useCallback(async () => {
    const result = await apiRequest<ContextResponse>(endpoint);
    if (mounted.current) setContext(result);
  }, [endpoint]);
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !context ||
      context.configuration.state !== "ready" ||
      chatLock.current ||
      !draft.trim() ||
      !isOnline
    )
      return;
    chatLock.current = true;
    setChatBusy(true);
    setChatError("");
    const text = draft.trim(),
      controller = new AbortController();
    request.current = controller;
    const history = recentHistory(messages);
    setMessages((previous) => [...previous, { role: "user", text }]);
    setDraft("");
    try {
      const answer = await apiRequest<CopilotAnswer>(endpoint, {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({ message: text, history }),
      });
      if (mounted.current && !controller.signal.aborted)
        setMessages((previous) => [
          ...previous,
          { role: "assistant", text: answer.text, answer },
        ]);
    } catch (error) {
      if (mounted.current && !controller.signal.aborted) {
        setChatError(
          error instanceof Error
            ? error.message
            : "The message could not be sent. Try again.",
        );
        setMessages((previous) => previous.slice(0, -1));
        setDraft(text);
      }
    } finally {
      chatLock.current = false;
      if (mounted.current) setChatBusy(false);
    }
  }
  function reviewSuggestion(value: CopilotTaskProposalDraft) {
    suggestionSequence.current += 1;
    setSuggestion({ draft: value, key: suggestionSequence.current });
    setManualOpen(true);
  }
  if (loading)
    return (
      <div
        role="status"
        aria-label="Loading project copilot"
        className="space-y-4"
      >
        <div className="h-6 w-56 rounded bg-slate-200 animate-pulse motion-reduce:animate-none" />
        <div className="h-32 rounded-xl bg-slate-100 animate-pulse motion-reduce:animate-none" />
        <p className="text-sm text-slate-600">Loading project checks…</p>
      </div>
    );
  if (loadError || !context)
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-white p-5 space-y-3"
      >
        <p className="flex gap-2 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          {loadError || "Project data is unavailable."}
        </p>
        <p className="text-sm text-slate-600">
          Check your connection and project access, then retry.
        </p>
        <Button
          className="h-11"
          variant="outline"
          disabled={!isOnline}
          onClick={() => {
            setLoading(true);
            setRetry((value) => value + 1);
          }}
        >
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </div>
    );
  const ready = context.configuration.state === "ready";
  const contextPanel = <ProjectChecks context={context} />;
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {context.summary.assets} assets · {context.summary.tasks} tasks ·{" "}
          {context.summary.programmeActivities} programme activities
        </p>
        <Button
          variant="ghost"
          className="h-11"
          disabled={chatBusy || manualBusy || !isOnline}
          onClick={() =>
            void refreshContext().catch((error: unknown) =>
              toast.error(
                error instanceof Error ? error.message : "Refresh failed",
              ),
            )
          }
        >
          <RefreshCw className="size-4" />
          Refresh checks
        </Button>
      </div>
      {!ready && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="text-sm font-semibold">
            {context.configuration.state === "disabled"
              ? "AI chat is disabled"
              : "AI chat not configured yet"}
          </p>
          <p className="mt-1 text-sm leading-6">
            Project checks and manual change previews work below. An
            administrator must configure and enable AI before chat can answer.
          </p>
        </div>
      )}
      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="min-w-0 space-y-6">
          <section
            className="rounded-xl border bg-white p-4 sm:p-5 space-y-5"
            aria-label="Project chat"
          >
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <MessageSquare className="size-4" />
                Ask about this project
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Answers use project records. Any suggested change must be
                reviewed separately.
              </p>
            </div>
            {messages.length > 0 && (
              <ol
                className="max-h-[28rem] space-y-5 overflow-y-auto overscroll-contain"
                aria-live="polite"
                aria-relevant="additions"
                aria-label="Conversation"
              >
                {messages.map((message, index) => (
                  <li
                    key={index}
                    className={
                      message.role === "user"
                        ? "ml-4 rounded-lg bg-slate-100 p-4 sm:ml-10"
                        : "space-y-3 border-b border-slate-200 pb-5"
                    }
                  >
                    <p className="text-xs font-medium text-slate-600">
                      {message.role === "user" ? "You" : "Copilot"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                      {message.text}
                    </p>
                    {message.answer && (
                      <>
                        <SourceList sources={message.answer.sources} />
                        {message.answer.proposals.map(
                          (proposal, proposalIndex) => (
                            <div
                              key={proposalIndex}
                              className="border-t border-slate-200 pt-3"
                            >
                              <p className="text-sm text-slate-600">
                                Suggested task change ·{" "}
                                {proposal.changes.title ??
                                  context.tasks.find(
                                    (task) => task.id === proposal.taskId,
                                  )?.title ??
                                  proposal.taskId}
                              </p>
                              <Button
                                variant="outline"
                                className="mt-2 h-11"
                                disabled={chatBusy || manualBusy}
                                onClick={() => reviewSuggestion(proposal)}
                              >
                                Review suggested change
                                <ArrowRight className="size-4" />
                              </Button>
                            </div>
                          ),
                        )}
                      </>
                    )}
                  </li>
                ))}
                <li aria-hidden="true">
                  <div ref={transcriptEnd} />
                </li>
              </ol>
            )}
            {!messages.length && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">
                  Example questions · select to edit
                </p>
                {context.examples.slice(0, 4).map((example) => (
                  <button
                    type="button"
                    key={example}
                    disabled={chatBusy}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50"
                    onClick={() => {
                      setDraft(example);
                      composer.current?.focus();
                    }}
                  >
                    {example}
                    <ArrowRight className="size-4 shrink-0" />
                  </button>
                ))}
                {!ready && (
                  <p className="text-xs leading-5 text-slate-600">
                    Examples only fill the message box. Project checks are
                    saved-data queries, not AI responses.
                  </p>
                )}
              </div>
            )}
            {chatError && (
              <p role="alert" className="text-sm text-red-700">
                {chatError}
              </p>
            )}
            <form onSubmit={send} className="space-y-3">
              <label className="block text-sm font-medium">
                Your question
                <Textarea
                  ref={composer}
                  className="mt-2 min-h-24"
                  rows={3}
                  maxLength={4000}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={chatBusy}
                  placeholder="Ask about delays, test records or task priorities…"
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-600">
                  {ready
                    ? "Changes always need your confirmation."
                    : "Sending is available after AI setup."}
                </span>
                <Button
                  className="h-11"
                  disabled={!ready || chatBusy || !isOnline || !draft.trim()}
                >
                  <Send className="size-4" />
                  {chatBusy ? "Waiting for answer…" : "Send question"}
                </Button>
              </div>
            </form>
          </section>
          <section
            className="border-t border-slate-200 pt-5"
            aria-label="Controlled task changes"
          >
            <Button
              variant="outline"
              className="h-11"
              aria-expanded={manualOpen}
              disabled={chatBusy || manualBusy}
              onClick={() => {
                setManualOpen(!manualOpen);
                setSuggestion(null);
              }}
            >
              <FileEdit className="size-4" />
              Prepare a task change
            </Button>
            <p className="mt-2 text-sm text-slate-600">
              Works without AI. Review the exact changes, then confirm one task
              at a time.
            </p>
            {manualOpen && (
              <div className="mt-5">
                <h2
                  tabIndex={-1}
                  ref={editorHeading}
                  className="font-semibold focus:outline-none"
                >
                  Prepare a task change
                </h2>
                <TaskChangeEditor
                  key={suggestion?.key ?? "manual"}
                  context={context}
                  initialDraft={suggestion?.draft}
                  onRefresh={refreshContext}
                  onBusyChange={setManualBusy}
                />
              </div>
            )}
          </section>
        </div>
        <aside className="order-first min-w-0 lg:order-last">
          <div className="hidden lg:block">{contextPanel}</div>
          <details
            open={!ready}
            className="border-t border-slate-200 pt-5 lg:hidden"
          >
            <summary className="min-h-11 cursor-pointer font-medium">
              Project checks & recorded groups
            </summary>
            <div className="mt-4">{contextPanel}</div>
          </details>
        </aside>
      </div>
    </div>
  );
}

function ProjectChecks({ context }: { context: CopilotContext }) {
  const noRecords = !(
    context.summary.assets +
    context.summary.tasks +
    context.summary.programmeActivities
  );
  return (
    <section aria-label="Saved project checks" className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <ListChecks className="size-4" />
          Project checks
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Calculated from saved records. These checks do not use AI.
        </p>
      </div>
      {noRecords ? (
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            No project records yet. Add equipment and tasks to start checking
            progress.
          </p>
          <Link
            href="/commissioning"
            className="inline-flex min-h-11 items-center gap-2 text-blue-700 underline underline-offset-4"
          >
            Start in Assets
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {context.checks.map((check) => (
            <details key={check.id} className="py-3">
              <summary className="min-h-11 cursor-pointer text-sm font-medium">
                <span>{check.label}</span>
                <span className="ml-2 text-slate-600 tabular-nums">
                  {check.count}
                </span>
              </summary>
              <div className="mt-2 space-y-3">
                <p className="text-xs leading-5 text-slate-600">
                  {check.description}
                </p>
                <SourceList sources={check.sources} />
                {check.count > check.sources.length && (
                  <p className="text-xs text-slate-600">
                    {check.sources.length} of {check.count} supporting records
                    shown.
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
      <details className="border-t border-slate-200 pt-4">
        <summary className="min-h-11 cursor-pointer text-sm font-medium">
          Recorded asset groups ({context.groups.length})
        </summary>
        <div className="mt-2 space-y-4">
          {!context.groups.length && (
            <p className="text-xs leading-5 text-slate-600">
              No parent/child asset links are recorded. Equipment type alone
              does not define a shared task group.
            </p>
          )}
          {context.groups.map((group) => (
            <details key={group.id} className="border-t border-slate-200 pt-3">
              <summary className="min-h-11 cursor-pointer text-sm font-medium">
                {group.name}
                <span className="ml-2 font-normal text-slate-600">
                  {group.childAssetIds.length} assets
                </span>
              </summary>
              <div className="mt-2 space-y-3">
                <p className="break-words text-xs text-slate-600">
                  {group.id} · {group.childAssetIds.join(", ")}
                </p>
                <p className="text-xs text-slate-600">
                  {group.linkedTaskIds.length} tasks linked to the parent ·{" "}
                  {group.childTaskIds.length} linked to child assets
                </p>
                <p className="text-xs leading-5 text-slate-600">
                  {group.limitation}
                </p>
              </div>
            </details>
          ))}
        </div>
      </details>
      <details className="border-t border-slate-200 pt-4">
        <summary className="min-h-11 cursor-pointer text-sm font-medium">
          Scope & limitations
        </summary>
        <ul className="mt-2 space-y-3 text-xs leading-5 text-slate-600">
          {context.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function SourceList({ sources }: { sources: CopilotSource[] }) {
  return sources.length ? (
    <ul className="space-y-2">
      {sources.map((source, index) => {
        const href =
          source.kind === "task"
            ? `/tasks/${encodeURIComponent(source.id)}`
            : source.kind === "programme"
              ? "/schedule"
              : source.kind === "asset"
                ? "/commissioning"
                : "/overview";
        return (
          <li key={`${source.kind}-${source.id}-${index}`}>
            <Link
              href={href}
              className="inline-flex min-h-11 items-center text-sm text-blue-700 underline underline-offset-4 break-words"
            >
              {source.label}
            </Link>
          </li>
        );
      })}
    </ul>
  ) : null;
}

function TaskChangeEditor({
  context,
  initialDraft,
  onRefresh,
  onBusyChange,
}: {
  context: CopilotContext;
  initialDraft?: CopilotTaskProposalDraft;
  onRefresh: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const { tasks, isOnline, refreshData } = useApp();
  const initialTask = context.tasks.find(
    (task) => task.id === initialDraft?.taskId,
  );
  const [taskId, setTaskId] = useState(initialTask?.id ?? "");
  const [selected, setSelected] = useState<CopilotTask | undefined>(
    initialTask,
  );
  const [title, setTitle] = useState(
    initialDraft?.changes.title ?? initialTask?.title ?? "",
  );
  const [description, setDescription] = useState(
    initialDraft?.changes.description ?? initialTask?.description ?? "",
  );
  const [priority, setPriority] = useState(
    initialDraft?.changes.priority ?? initialTask?.priority ?? "",
  );
  const [reason, setReason] = useState(initialDraft?.reason ?? "");
  const [preview, setPreview] = useState<CopilotProposalResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const request = useRef<AbortController | null>(null),
    lock = useRef(false),
    mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const current = tasks.find(
    (task) => task.id === taskId && task.projectId === context.project.id,
  );
  const stale =
    !!selected &&
    (!current ||
      current.version !== selected.version ||
      (!!preview && current.version !== preview.proposal.version));
  const endpoint = `/api/projects/${encodeURIComponent(context.project.id)}/copilot`;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!preview) return;
    heading.current?.focus();
    const timeout = window.setTimeout(
      () => setExpired(true),
      Math.max(0, Date.parse(preview.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [preview]);
  function clearPreview() {
    setPreview(null);
    setExpired(false);
    setError("");
  }
  function selectTask(id: string) {
    const task = context.tasks.find((row) => row.id === id);
    setTaskId(id);
    setSelected(task);
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setPriority(task?.priority ?? "");
    clearPreview();
  }
  function working(value: boolean) {
    setBusy(value);
    onBusyChange(value);
  }
  async function reloadTasks() {
    if (lock.current || !isOnline) return;
    lock.current = true;
    working(true);
    setError("");
    try {
      await refreshData();
      await onRefresh();
      if (mounted.current) {
        selectTask("");
        clearPreview();
      }
    } catch (problem) {
      if (mounted.current)
        setError(
          problem instanceof Error
            ? problem.message
            : "Could not refresh tasks.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) working(false);
    }
  }
  function changes(): CopilotTaskProposalDraft["changes"] {
    return {
      ...(selected && title.trim() !== selected.title
        ? { title: title.trim() }
        : {}),
      ...(selected && description.trim() !== selected.description
        ? { description: description.trim() }
        : {}),
      ...(priority && priority !== selected?.priority
        ? { priority: priority as NonNullable<Task["priority"]> }
        : {}),
    };
  }
  async function prepare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || lock.current || stale || !isOnline) return;
    lock.current = true;
    working(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await apiRequest<CopilotProposalResponse>(
        `${endpoint}/proposals`,
        {
          method: "POST",
          signal: controller.signal,
          body: JSON.stringify({
            taskId: selected.id,
            version: selected.version,
            changes: changes(),
            reason,
          }),
        },
      );
      if (mounted.current && !controller.signal.aborted) {
        setPreview(result);
        setExpired(Date.parse(result.expiresAt) <= Date.now());
      }
    } catch (problem) {
      if (mounted.current && !controller.signal.aborted)
        setError(
          problem instanceof Error
            ? problem.message
            : "Could not prepare the change.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) working(false);
    }
  }
  async function confirm() {
    if (
      !preview ||
      lock.current ||
      stale ||
      expired ||
      !isOnline ||
      Date.parse(preview.expiresAt) <= Date.now()
    )
      return;
    lock.current = true;
    working(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    try {
      await apiRequest(`${endpoint}/confirm`, {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({ token: preview.token, confirmed: true }),
      });
      if (!mounted.current || controller.signal.aborted) return;
      setPreview(null);
      setReason("");
      selectTask("");
      toast.success("Task change saved");
      try {
        await refreshData();
        await onRefresh();
      } catch {
        toast.warning(
          "Saved. Refresh project checks before preparing another change.",
        );
      }
    } catch (problem) {
      if (mounted.current && !controller.signal.aborted) {
        setPreview(null);
        setError(
          problem instanceof Error
            ? problem.message
            : "Could not save the change. Refresh and prepare it again.",
        );
      }
    } finally {
      lock.current = false;
      if (mounted.current) working(false);
    }
  }
  if (!context.tasks.length)
    return (
      <p className="mt-3 text-sm leading-6 text-slate-600">
        No tasks are recorded for this project.{" "}
        <Link
          href="/supervisor"
          className="text-blue-700 underline underline-offset-4"
        >
          Add a task in Tasks
        </Link>{" "}
        before preparing a change.
      </p>
    );
  return (
    <div className="mt-3 space-y-5">
      <form onSubmit={prepare}>
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <label className="block text-sm font-medium">
            Task
            <select
              className="field-select mt-2 min-h-11"
              value={taskId}
              onChange={(event) => selectTask(event.target.value)}
              required
            >
              <option value="">Choose a task in this project</option>
              {context.tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title} · {statusLabels[task.status]}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <>
              <p className="text-xs text-slate-600">
                Task version {selected.version} ·{" "}
                {selected.assetId
                  ? `Asset ${selected.assetId}`
                  : "No asset link"}
              </p>
              <label className="block text-sm font-medium">
                Title
                <Input
                  className="mt-2 h-11"
                  value={title}
                  required
                  minLength={3}
                  maxLength={200}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    clearPreview();
                  }}
                />
              </label>
              <label className="block text-sm font-medium">
                Description
                <Textarea
                  className="mt-2"
                  rows={3}
                  maxLength={10000}
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    clearPreview();
                  }}
                />
              </label>
              <label className="block text-sm font-medium">
                Priority
                <select
                  className="field-select mt-2 min-h-11"
                  value={priority}
                  onChange={(event) => {
                    setPriority(event.target.value as typeof priority);
                    clearPreview();
                  }}
                >
                  <option value="">Keep current priority</option>
                  {[
                    ...new Set([
                      ...context.project.priorities,
                      ...(selected.priority ? [selected.priority] : []),
                    ]),
                  ].map((value) => (
                    <option
                      key={value}
                      value={value}
                      disabled={!context.project.priorities.includes(value)}
                    >
                      {value}
                      {!context.project.priorities.includes(value)
                        ? " (current · disabled in project)"
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Reason for this change
                <Textarea
                  className="mt-2"
                  rows={2}
                  required
                  minLength={10}
                  maxLength={1000}
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    clearPreview();
                  }}
                />
                <span className="mt-1 block text-xs font-normal text-slate-600">
                  At least 10 characters. Recorded with your name in task
                  history.
                </span>
              </label>
            </>
          )}
          {stale && (
            <div role="alert" className="space-y-2">
              <p className="text-sm text-amber-800">
                This task changed. Refresh project checks and select the task
                again before preparing a new change.
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={busy || !isOnline}
                onClick={() => void reloadTasks()}
              >
                Refresh & select task
              </Button>
            </div>
          )}
          <Button
            className="h-11"
            disabled={
              !selected ||
              busy ||
              !isOnline ||
              stale ||
              !Object.keys(changes()).length ||
              reason.trim().length < 10
            }
          >
            {busy ? "Working…" : "Preview task change"}
            <ArrowRight className="size-4" />
          </Button>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {preview && (
        <section
          className="border-t border-slate-200 pt-5 space-y-4"
          aria-label="Task change preview"
        >
          <h3
            ref={heading}
            tabIndex={-1}
            className="font-semibold focus:outline-none"
          >
            Review before applying
          </h3>
          <p className="text-sm text-slate-600">{preview.proposal.taskTitle}</p>
          <dl className="space-y-4">
            {(
              Object.keys(
                preview.proposal.changes,
              ) as (keyof CopilotTaskProposalDraft["changes"])[]
            ).map((field) => (
              <div key={field}>
                <dt className="text-sm font-medium capitalize">{field}</dt>
                <dd className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-slate-600">Before</p>
                    <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm text-slate-700">
                      {preview.proposal.before[field] || "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-700">After</p>
                    <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm text-slate-900">
                      {preview.proposal.changes[field] || "Empty"}
                    </p>
                  </div>
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-slate-600">
            Reason: {preview.proposal.reason}
          </p>
          <p className="text-xs text-slate-600">
            {expired
              ? "This preview expired. Prepare it again."
              : `Preview expires at ${new Date(preview.expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="h-11"
              disabled={busy || stale || expired || !isOnline}
              onClick={() => void confirm()}
            >
              <Check className="size-4" />
              {busy ? "Applying…" : "Confirm task change"}
            </Button>
            <Button
              variant="outline"
              className="h-11"
              disabled={busy}
              onClick={clearPreview}
            >
              <X className="size-4" />
              Discard preview
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
