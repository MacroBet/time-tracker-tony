"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CopilotVoiceInput } from "./CopilotVoiceInput";
import {
  AlertCircle,
  ArrowRight,
  Check,
  FileEdit,
  ListChecks,
  Mic,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Send,
  Square,
  Trash2,
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
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { InfoPopover } from "./InfoPopover";
import { useLinkedProject } from "./useLinkedProject";
import { AssistantResultPanels } from "./AssistantResultPanels";
import {
  scheduleViewSnapshotSchema,
  scheduleViewStorageKey,
  type ScheduleViewSnapshot,
} from "@/lib/schedule-view-context";
import type { AssistantReportState } from "@/lib/assistant-report-state";
import {
  MAX_CONVERSATION_MESSAGES,
  type ConversationMessage,
  type ConversationSummary,
  type SavedConversation,
} from "@/lib/assistant-conversations";
import { projectReportHref } from "@/lib/project-reports";
import { AssistantReply } from "./AssistantReply";
import {
  parseAssistantViewCommand,
  parseSchedulePanelCommand,
} from "@/lib/assistant-view-commands";
import { parseCopilotReadCommand } from "@/lib/copilot-reads";
import { VoiceSetup } from "./VoiceSetup";
import {
  createVoiceQuestionSession,
  voiceSetupKey,
} from "@/lib/voice-commands";
import {
  applyAssistantView,
  applySchedulePanel,
} from "./assistant-view-dispatch";
import { parseDashboardViewCommand } from "@/lib/dashboard-view-commands";
import { applyDashboardView } from "./dashboard-view-dispatch";
import { dashboardViewHref } from "@/lib/dashboard-views";

type ContextResponse = CopilotContext & { configuration: CopilotStatus };
type Message = ConversationMessage & { answer?: CopilotAnswer };

function recentHistory(messages: Message[]): CopilotChatMessage[] {
  const history = messages
    .filter((message) => !message.error)
    .slice(-12)
    .map(({ role, text }) => ({
      role,
      text:
        text.length > 4000
          ? `${text.slice(0, 3974)}\n[History shortened]`
          : text,
    }));
  while (history.length && history[0].role !== "user") history.shift();
  while (history.reduce((total, item) => total + item.text.length, 0) > 24000) {
    history.shift();
    while (history.length && history[0].role !== "user") history.shift();
  }
  return history;
}

export function CopilotWorkspace() {
  const { projects, currentUser } = useApp();
  const linked = useLinkedProject(),
    project = linked.project,
    requestedProject = linked.requested;
  const assignedRequest = projects.some((item) => item.id === requestedProject);
  return (
    <AppShell
      title="Project assistant"
      subtitle="Check saved project records and review changes before they are applied."
      wide
    >
      {requestedProject && !assignedRequest ? (
        <p role="alert" className="text-sm text-red-700">
          This project is not available to your account. Choose an assigned
          project.
        </p>
      ) : !canUseCopilot(currentUser) ? (
        <p className="text-sm text-slate-600">
          The assistant requires management access to Tasks and Commissioning.
          Ask your administrator if you need access.
        </p>
      ) : linked.opening ? (
        <p role="status">Opening the linked project…</p>
      ) : project ? (
        <CopilotSession
          key={`${project.id}:${currentUser.id}:${currentUser.role}:${JSON.stringify(currentUser.modules ?? null)}:${projects
            .map((item) => item.id)
            .sort()
            .join("|")}`}
          projectId={project.id}
        />
      ) : (
        <p className="text-sm text-slate-600">
          Choose an assigned project to open its assistant.
        </p>
      )}
    </AppShell>
  );
}

export function CopilotSession({
  projectId,
  embedded = false,
  input,
  voiceIntent = 0,
  sourceView = false,
}: {
  projectId: string;
  embedded?: boolean;
  input?: "voice" | "text";
  voiceIntent?: number;
  sourceView?: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const dashboardContext =
    embedded && ["/overview", "/dashboard"].includes(pathname);
  const { isOnline, refreshData, currentUser } = useApp();
  const [context, setContext] = useState<ContextResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reportState, setReportState] = useState<
    AssistantReportState | undefined
  >();
  const [draft, setDraftState] = useState(() => {
    if (embedded && typeof window !== "undefined")
      try {
        return (
          sessionStorage.getItem(
            `fieldtrack:assistant-draft:${encodeURIComponent(currentUser.id)}:${encodeURIComponent(projectId)}`,
          ) ?? ""
        ).slice(0, 4000);
      } catch {
        /* Draft remains usable without storage. */
      }
    return "";
  });
  const [voiceSetupAcknowledged, setVoiceSetupAcknowledged] = useState(false);
  const persistedVoiceSetup = useSyncExternalStore(
    useCallback((notify: () => void) => {
      window.addEventListener("storage", notify);
      return () => window.removeEventListener("storage", notify);
    }, []),
    useCallback(() => {
      try {
        return localStorage.getItem(voiceSetupKey(currentUser.id)) === "done";
      } catch {
        return false;
      }
    }, [currentUser.id]),
    () => false,
  );
  const voiceSetupReady = voiceSetupAcknowledged || persistedVoiceSetup;
  const [voiceSetupOpen, setVoiceSetupOpen] = useState<number | null>(null);
  const [voiceStartRequested, setVoiceStartRequested] = useState<number | null>(
    null,
  );
  const [voiceStartBlocked, setVoiceStartBlocked] = useState<number | null>(
    null,
  );
  const voiceSession = useRef<ReturnType<
    typeof createVoiceQuestionSession
  > | null>(null);
  const [voiceNote, setVoiceNote] = useState("");
  const [voicePartial, setVoicePartial] = useState("");
  const [voiceCapturing, setVoiceCapturing] = useState(false);
  const voiceCaptureActive = useRef(false);
  const [replaceVoice, setReplaceVoice] = useState(false);

  const lastDraft = useRef(draft);
  function setDraft(value: string | ((previous: string) => string)) {
    const next = typeof value === "function" ? value(lastDraft.current) : value;
    lastDraft.current = next;
    setDraftState(next);
  }
  function acceptVoiceSetup() {
    try {
      localStorage.setItem(voiceSetupKey(currentUser.id), "done");
    } catch {
      /* Session-only setup. */
    }
    setVoiceSetupAcknowledged(true);
    setVoiceSetupOpen(null);
    setVoiceStartBlocked(null);
    setVoiceStartRequested(voiceIntent);
  }
  useEffect(() => {
    if (!embedded) return;
    const key = `fieldtrack:assistant-draft:${encodeURIComponent(currentUser.id)}:${encodeURIComponent(projectId)}`;
    return () => {
      try {
        if (lastDraft.current.trim())
          sessionStorage.setItem(key, lastDraft.current);
        else sessionStorage.removeItem(key);
      } catch {
        /* Never block closing the microphone. */
      }
    };
  }, [embedded, currentUser.id, projectId]);
  const [chatBusy, setChatBusy] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [chatError, setChatError] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [unsavedReply, setUnsavedReply] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [historySaving, setHistorySaving] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    draft: CopilotTaskProposalDraft;
    key: number;
  } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef<AbortController | null>(null);
  const suggestionSequence = useRef(0);
  const chatLock = useRef(false);
  const mounted = useRef(true);
  const composer = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = composer.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(144, Math.max(44, element.scrollHeight))}px`;
  }, [draft, loading]);

  const editorHeading = useRef<HTMLHeadingElement>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const transcript = useRef<HTMLOListElement>(null);
  const followReply = useRef(true);
  const active = useRef<SavedConversation | null>(null);
  const pendingConversationId = useRef<string | null>(null);
  const replyNeedsSave = useRef(false);
  const currentMessages = useRef<Message[]>([]);
  const currentReport = useRef<AssistantReportState | undefined>(undefined);
  const viewGeneration = useRef(0);
  const turnGeneration = useRef(0);
  const [historyRetry, setHistoryRetry] = useState(0);
  const entryInput = input ?? params.get("input");
  useEffect(() => {
    if (!loading && entryInput === "text") composer.current?.focus();
  }, [loading, entryInput, voiceIntent]);
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/copilot`;
  const historyEndpoint = `${endpoint}/conversations`;
  const [embeddedChat, setEmbeddedChat] = useState<string | null>(null);
  const requestedChat = embedded ? embeddedChat : params.get("chat");
  const setChatUrl = (id: string | null) => {
    if (embedded) {
      setEmbeddedChat(id);
      return;
    }
    const next = new URLSearchParams(params.toString());
    if (id) next.set("chat", id);
    else next.delete("chat");
    router.replace(`/copilot?${next}`, { scroll: false });
  };
  const replaceMessages = (next: Message[]) => {
    currentMessages.current = next;
    setMessages(next);
  };
  const applySaved = (conversation: SavedConversation) => {
    active.current = conversation;
    pendingConversationId.current = conversation.id;
    setActiveId(conversation.id);
    setConversations((previous) => {
      const summary = {
        id: conversation.id,
        projectId,
        title: conversation.title,
        version: conversation.version,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messageCount: conversation.messages.length,
      };
      return [
        summary,
        ...previous.filter((row) => row.id !== conversation.id),
      ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  };
  async function saveMessages(
    next: Message[],
    state: AssistantReportState | undefined,
    signal?: AbortSignal,
  ) {
    const current = active.current;
    const response = await apiRequest<{
      conversation: SavedConversation;
      created: boolean;
    }>(historyEndpoint, {
      method: "PUT",
      signal,
      body: JSON.stringify({
        id:
          current?.id ??
          (pendingConversationId.current ??= crypto.randomUUID()),
        version: current?.version ?? 0,
        messages: next.map(({ id, role, text, error }) => ({
          id,
          role,
          text,
          ...(error ? { error } : {}),
        })),
        ...(state ? { reportState: state } : {}),
      }),
    });
    return response;
  }
  function stopWaiting() {
    turnGeneration.current++;
    request.current?.abort();
    chatLock.current = false;
    setChatBusy(false);
    setSavingQuestion(false);
    setRevealingId(null);
    setChatError("");
    setAnnouncement("Stopped waiting for the reply.");
  }
  function newChat() {
    stopWaiting();
    viewGeneration.current++;
    active.current = null;
    pendingConversationId.current = null;
    currentMessages.current = [];
    currentReport.current = undefined;
    setActiveId(null);
    setMessages([]);
    setReportState(undefined);
    setDraft("");
    setSuggestion(null);
    setManualOpen(false);
    setOpeningChat(false);
    setHistoryOpen(false);
    replyNeedsSave.current = false;
    setUnsavedReply(false);
    setChatUrl(null);
    composer.current?.focus();
  }
  function openChat(id: string) {
    setHistoryOpen(false);
    if (id === active.current?.id) return;
    stopWaiting();
    setOpeningChat(true);
    setSuggestion(null);
    setManualOpen(false);
    setChatUrl(id);
  }
  async function retrySaving() {
    if (historySaving || !isOnline) return;
    const generation = turnGeneration.current;
    setHistorySaving(true);
    try {
      const result = await saveMessages(
        currentMessages.current,
        currentReport.current,
      );
      if (mounted.current && generation === turnGeneration.current) {
        applySaved(result.conversation);
        replyNeedsSave.current = false;
        setUnsavedReply(false);
        setHistoryError("");
      }
    } catch (error) {
      if (mounted.current)
        setHistoryError(
          error instanceof Error
            ? error.message
            : "The reply could not be saved. Retry or reopen the saved version.",
        );
    } finally {
      if (mounted.current) setHistorySaving(false);
    }
  }
  async function loadOlderChats() {
    setHistoryLoading(true);
    try {
      const result = await apiRequest<{
        conversations: ConversationSummary[];
        total: number;
      }>(`${historyEndpoint}?offset=${conversations.length}&limit=30`);
      if (mounted.current) {
        setConversations((previous) => [
          ...previous,
          ...result.conversations.filter(
            (row) => !previous.some((old) => old.id === row.id),
          ),
        ]);
        setHistoryTotal(result.total);
        setHistoryError("");
      }
    } catch (error) {
      if (mounted.current)
        setHistoryError(
          error instanceof Error
            ? error.message
            : "Older chats could not load.",
        );
    } finally {
      if (mounted.current) setHistoryLoading(false);
    }
  }
  async function deleteChat(chat: ConversationSummary) {
    if (!isOnline || historySaving) return;
    setHistorySaving(true);
    try {
      await apiRequest(historyEndpoint, {
        method: "DELETE",
        body: JSON.stringify({ id: chat.id, version: chat.version }),
      });
      if (mounted.current) {
        setConversations((previous) =>
          previous.filter((row) => row.id !== chat.id),
        );
        setHistoryTotal((previous) => Math.max(0, previous - 1));
        setDeleteId(null);
        if (active.current?.id === chat.id) newChat();
      }
    } catch (error) {
      if (mounted.current)
        setHistoryError(
          error instanceof Error
            ? error.message
            : "The chat could not be deleted. Refresh the list and retry.",
        );
    } finally {
      if (mounted.current) setHistorySaving(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<{ conversations: ConversationSummary[]; total: number }>(
      historyEndpoint,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setConversations(result.conversations);
          setHistoryTotal(result.total);
          setHistoryLoading(false);
          if (!replyNeedsSave.current) setHistoryError("");
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setHistoryLoading(false);
          setHistoryError(
            error instanceof Error
              ? error.message
              : "Past chats could not load. Retry to reconnect.",
          );
        }
      });
    return () => controller.abort();
  }, [historyEndpoint, historyRetry]);
  useEffect(() => {
    if (
      requestedChat === active.current?.id ||
      (!requestedChat && !active.current)
    )
      return;
    const generation = ++viewGeneration.current;
    turnGeneration.current++;
    request.current?.abort();
    chatLock.current = false;
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setChatBusy(false);
      setRevealingId(null);
      setChatError("");
      replyNeedsSave.current = false;
      setUnsavedReply(false);
      if (!embedded) setDraft("");
      if (!requestedChat) {
        active.current = null;
        currentMessages.current = [];
        currentReport.current = undefined;
        setActiveId(null);
        setMessages([]);
        setReportState(undefined);
        setOpeningChat(false);
        return;
      }
      setOpeningChat(true);
      try {
        const result = await apiRequest<{ conversation: SavedConversation }>(
          `${historyEndpoint}?${new URLSearchParams({ conversationId: requestedChat })}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted || generation !== viewGeneration.current)
          return;
        active.current = result.conversation;
        pendingConversationId.current = result.conversation.id;
        currentMessages.current = result.conversation.messages;
        currentReport.current = result.conversation.reportState;
        setActiveId(result.conversation.id);
        setMessages(result.conversation.messages);
        setReportState(result.conversation.reportState);
        setHistoryError("");
      } catch (error) {
        if (!controller.signal.aborted) {
          active.current = null;
          currentMessages.current = [];
          currentReport.current = undefined;
          setActiveId(null);
          setMessages([]);
          setReportState(undefined);
          setHistoryError(
            error instanceof Error
              ? error.message
              : "This chat could not open.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setOpeningChat(false);
      }
    });
    return () => controller.abort();
  }, [requestedChat, historyEndpoint, historyRetry, embedded]);
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
    if (messages.length && followReply.current)
      transcriptEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, chatBusy]);
  const refreshContext = useCallback(async () => {
    await refreshData();
    const result = await apiRequest<ContextResponse>(endpoint);
    if (mounted.current) setContext(result);
  }, [endpoint, refreshData]);
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage(draft.trim());
  }
  async function sendMessage(text: string, retryId?: string) {
    const dashboardIntent = dashboardContext
      ? parseDashboardViewCommand(text)
      : null;
    const schedulePanel =
      embedded && sourceView ? parseSchedulePanelCommand(text) : null;
    const viewIntent =
      dashboardIntent || schedulePanel ? null : parseAssistantViewCommand(text);
    const savedRead = parseCopilotReadCommand(text);
    if (
      !context ||
      (context.configuration.state !== "ready" &&
        !dashboardIntent &&
        !schedulePanel &&
        !viewIntent &&
        !savedRead) ||
      chatLock.current ||
      !text ||
      openingChat ||
      historySaving ||
      unsavedReply ||
      voiceCaptureActive.current ||
      !isOnline
    )
      return;
    if (
      !retryId &&
      currentMessages.current.length > MAX_CONVERSATION_MESSAGES - 2
    ) {
      setChatError(
        "This chat is full. Start a new chat to continue; your saved messages are kept.",
      );
      return;
    }
    chatLock.current = true;
    setChatBusy(true);
    setSavingQuestion(true);
    setChatError("");
    const controller = new AbortController();
    const generation = ++turnGeneration.current;
    request.current = controller;
    const baseMessages = retryId
      ? currentMessages.current.filter((row) => row.id !== retryId)
      : currentMessages.current;
    const history = recentHistory(baseMessages);
    let scheduleView: ScheduleViewSnapshot | undefined;
    if (sourceView || params.get("sourceView") === "1")
      try {
        const parsed = scheduleViewSnapshotSchema.safeParse(
          JSON.parse(
            sessionStorage.getItem(scheduleViewStorageKey(projectId)) ?? "null",
          ),
        );
        if (parsed.success && parsed.data.projectId === projectId)
          scheduleView = parsed.data;
      } catch {
        /* No stored view: the assistant asks for a stable activity reference. */
      }
    const question: Message = {
      id: retryId ?? crypto.randomUUID(),
      role: "user",
      text,
    };
    const withQuestion = [...baseMessages, question];
    replaceMessages(withQuestion);
    if (!retryId) setDraft("");
    followReply.current = true;
    setAnnouncement("Assistant is working on your question.");
    let replyReceived = false;
    try {
      const saved = await saveMessages(
        withQuestion,
        currentReport.current,
        controller.signal,
      );
      if (
        !mounted.current ||
        controller.signal.aborted ||
        generation !== turnGeneration.current
      )
        return;
      applySaved(saved.conversation);
      setSavingQuestion(false);
      if (saved.created) setHistoryTotal((previous) => previous + 1);
      setChatUrl(saved.conversation.id);
      let answer: CopilotAnswer;
      if (schedulePanel) {
        answer = await applySchedulePanel(
          schedulePanel,
          projectId,
          context.project.version,
          controller.signal,
        );
      } else if (dashboardIntent) {
        answer = await applyDashboardView(
          dashboardIntent,
          projectId,
          context.project.version,
          controller.signal,
        );
      } else if (viewIntent) {
        answer =
          !embedded || !sourceView
            ? {
                mode: "view",
                text: `Schedule view command · no AI generation.\n\n[Open the working Schedule](/schedule?projectId=${encodeURIComponent(projectId)}) and use its assistant to apply this view command. No view or project record was changed here.`,
                sources: [],
                proposals: [],
              }
            : await applyAssistantView(
                viewIntent,
                scheduleView,
                projectId,
                context.project.version,
                controller.signal,
              );
      } else {
        answer = await apiRequest<CopilotAnswer>(endpoint, {
          method: "POST",
          signal: controller.signal,
          body: JSON.stringify({
            message: text,
            history,
            reportState,
            scheduleView,
          }),
        });
      }
      if (answer.dashboardView) {
        if (dashboardContext) {
          try {
            await applyDashboardView(
              {
                view: answer.dashboardView,
                description: "Requested Dashboard view displayed.",
              },
              projectId,
              context.project.version,
              controller.signal,
            );
            answer = {
              ...answer,
              text: `Dashboard view updated.\n\n${answer.text}`,
            };
          } catch (problem) {
            if (controller.signal.aborted) throw problem;
            answer = {
              ...answer,
              text: `The Dashboard view was not changed. ${problem instanceof Error ? problem.message : "Refresh the Dashboard and try again."} Saved report results below remain separate from this display request.`,
            };
          }
        } else {
          answer = {
            ...answer,
            text: `Dashboard view requested. [Open this view on the Dashboard](${dashboardViewHref(projectId, answer.dashboardView)}). No Dashboard view was changed in this assistant page.`,
          };
        }
      }
      if (
        mounted.current &&
        !controller.signal.aborted &&
        generation === turnGeneration.current
      ) {
        replyReceived = true;
        const state = answer.reportState ?? currentReport.current;
        currentReport.current = state;
        setReportState(state);
        const reply: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: answer.text,
          answer,
        };
        const complete = [...withQuestion, reply];
        replaceMessages(complete);
        setRevealingId(
          answer.mode === "view" || answer.mode === "saved-data"
            ? null
            : reply.id,
        );
        if (answer.mode === "view" || answer.mode === "saved-data")
          setAnnouncement("Reply ready from saved project records.");
        try {
          const savedReply = await saveMessages(complete, state);
          if (
            mounted.current &&
            !controller.signal.aborted &&
            generation === turnGeneration.current
          ) {
            applySaved(savedReply.conversation);
            setHistoryError("");
            replyNeedsSave.current = false;
            setUnsavedReply(false);
          }
        } catch (error) {
          if (
            mounted.current &&
            !controller.signal.aborted &&
            generation === turnGeneration.current
          ) {
            replyNeedsSave.current = true;
            setUnsavedReply(true);
            setHistoryError(
              `The reply is shown but could not be saved. ${error instanceof Error ? error.message : "Retry saving before continuing."}`,
            );
          }
        }
      }
    } catch (error) {
      if (
        mounted.current &&
        !controller.signal.aborted &&
        generation === turnGeneration.current
      ) {
        const message =
          error instanceof Error
            ? error.message
            : "The message could not be sent. Try again.";
        setChatError(message);
        replaceMessages(
          withQuestion.map((row) =>
            row.id === question.id ? { ...row, error: message } : row,
          ),
        );
        setAnnouncement("The reply could not load. Your question is kept.");
      }
    } finally {
      if (generation === turnGeneration.current) {
        chatLock.current = false;
        if (mounted.current) {
          setChatBusy(false);
          setSavingQuestion(false);
          if (!replyReceived) setRevealingId(null);
        }
      }
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
        aria-label="Loading project assistant"
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
  const showVoiceSetup =
    voiceSetupOpen === voiceIntent ||
    (!voiceSetupReady &&
      input === "voice" &&
      voiceStartBlocked !== voiceIntent);
  return (
    <div
      className={
        embedded
          ? "flex h-full min-h-0 flex-col"
          : "mx-auto flex h-[calc(100dvh-19rem-env(safe-area-inset-bottom))] min-h-0 max-w-4xl flex-col sm:h-[calc(100dvh-20.5rem-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-12rem)] lg:min-h-[22rem]"
      }
    >
      <p className="sr-only" role="status">
        {announcement}
      </p>
      <div className="relative flex shrink-0 flex-wrap items-start justify-between gap-1 border-b border-slate-100 py-1">
        <aside aria-label="Chat history" className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={unsavedReply || historySaving}
              onClick={newChat}
            >
              <Plus className="size-4" />
              New chat
            </Button>
            <Button
              variant="ghost"
              className="min-h-11"
              aria-expanded={historyOpen}
              aria-controls="past-chats"
              onClick={() => setHistoryOpen((value) => !value)}
            >
              Past chats ({historyTotal})
            </Button>
          </div>
          <div
            id="past-chats"
            className={`${historyOpen ? "block" : "hidden"} absolute left-0 right-0 top-full z-20 max-h-[50dvh] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg`}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Past chats</h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Refresh past chats"
                disabled={historyLoading || !isOnline}
                onClick={() => setHistoryRetry((value) => value + 1)}
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
            <p className="text-xs leading-5 text-slate-600">
              Private to your account in this project. Saved across devices.
            </p>
            {historyLoading && !conversations.length ? (
              <p role="status" className="text-sm text-slate-600">
                Loading past chats…
              </p>
            ) : !conversations.length && !historyError ? (
              <p className="text-sm leading-6 text-slate-600">
                Your conversations will appear here after you send a question.
              </p>
            ) : null}
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {conversations.map((chat) => (
                <li
                  key={chat.id}
                  className={
                    chat.id === activeId
                      ? "rounded-lg bg-blue-50"
                      : "rounded-lg hover:bg-slate-100"
                  }
                >
                  <div className="flex min-w-0 items-center gap-1">
                    <button
                      type="button"
                      className="min-h-11 min-w-0 flex-1 rounded-lg px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50"
                      aria-current={chat.id === activeId ? "page" : undefined}
                      disabled={unsavedReply || historySaving}
                      onClick={() => openChat(chat.id)}
                    >
                      <span className="block truncate text-sm font-medium">
                        {chat.title}
                      </span>
                      <time
                        dateTime={chat.updatedAt}
                        className="mt-1 block text-xs text-slate-600"
                      >
                        {new Date(chat.updatedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        · {chat.messageCount}{" "}
                        {chat.messageCount === 1 ? "message" : "messages"}
                      </time>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete chat: ${chat.title}`}
                      disabled={
                        chatBusy || unsavedReply || historySaving || !isOnline
                      }
                      onClick={() =>
                        setDeleteId(deleteId === chat.id ? null : chat.id)
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {deleteId === chat.id && (
                    <div className="space-y-2 px-3 pb-3 text-sm">
                      <p>Delete this saved chat?</p>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          disabled={historySaving}
                          onClick={() => void deleteChat(chat)}
                        >
                          Delete
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setDeleteId(null)}
                        >
                          Keep
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {conversations.length < historyTotal && (
              <Button
                variant="ghost"
                className="w-full"
                disabled={historyLoading || !isOnline}
                onClick={() => void loadOlderChats()}
              >
                {historyLoading ? "Loading…" : "Show older chats"}
              </Button>
            )}
          </div>
        </aside>
        <Popover open={optionsOpen} onOpenChange={setOptionsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              aria-label="Chat options"
            >
              <MoreHorizontal className="size-5" />
              <span className="sr-only">Chat options</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="max-h-[70dvh] w-80 max-w-[calc(100vw-2rem)] space-y-4 overflow-y-auto"
          >
            <h3 className="text-sm font-semibold">Chat options</h3>
            <details>
              <summary className="min-h-11 cursor-pointer text-sm font-medium">
                Example questions
              </summary>
              {context.examples.slice(0, 4).map((example) => (
                <button
                  key={example}
                  type="button"
                  className="min-h-11 w-full py-2 text-left text-sm text-blue-800"
                  onClick={() => {
                    setDraft(example);
                    composer.current?.focus();
                  }}
                >
                  {example}
                </button>
              ))}
            </details>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {embedded && (
                <InfoPopover label="Project records">
                  <p>
                    {context.summary.assets} assets · {context.summary.tasks}{" "}
                    saved tasks · {context.summary.managedProgrammeActivities}{" "}
                    managed activities ·{" "}
                    {context.summary.importedProgrammeActivities ?? "No"}{" "}
                    imported P6 activities. These are separate populations.
                  </p>
                </InfoPopover>
              )}
              <p
                className={
                  embedded
                    ? "sr-only"
                    : "min-w-0 flex-1 text-sm leading-6 text-slate-600 tabular-nums"
                }
              >
                {context.summary.assets} assets · {context.summary.tasks} tasks
                · {context.summary.managedProgrammeActivities} managed app
                activities
                {context.summary.importedProgrammeActivities !== null && (
                  <>
                    {" "}
                    · {context.summary.importedProgrammeActivities} imported P6
                    activities
                  </>
                )}
              </p>
              <Button
                variant="ghost"
                className="h-11"
                disabled={manualBusy || refreshing || !isOnline}
                aria-busy={refreshing}
                onClick={async () => {
                  setRefreshing(true);
                  try {
                    await refreshContext();
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Refresh failed",
                    );
                  } finally {
                    setRefreshing(false);
                  }
                }}
              >
                <RefreshCw className="size-4" />
                {refreshing
                  ? "Refreshing…"
                  : embedded
                    ? "Refresh"
                    : "Refresh checks"}
              </Button>
            </div>
            {!ready && !embedded && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <p className="text-sm font-semibold">
                  {context.configuration.state === "disabled"
                    ? "AI chat is disabled"
                    : "AI chat not configured yet"}
                </p>
                <p className="mt-1 text-sm leading-6">
                  Saved-data reports, import reviews, display commands and
                  manual previews remain available. An administrator must enable
                  AI for other questions.
                </p>
              </div>
            )}
            {!ready && embedded && (
              <p className="text-xs text-amber-950">
                AI unavailable · saved-data reports, import reviews and display
                commands still work.
              </p>
            )}

            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setOptionsOpen(false);
                setManualOpen(true);
                setSuggestion(null);
              }}
            >
              Prepare a task change
            </Button>
            {draft.trim() && (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                disabled={voiceCapturing || openingChat}
                onClick={() => {
                  setReplaceVoice(true);
                  setVoiceNote(
                    "Edit with the keyboard, or use the microphone to replace the whole question.",
                  );
                  composer.current?.focus();
                }}
              >
                Edit question
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setOptionsOpen(false);
                setVoiceSetupOpen(voiceIntent);
              }}
            >
              Voice help &amp; setup
            </Button>
            <details className="border-t border-slate-200 pt-5">
              <summary className="min-h-11 cursor-pointer font-medium">
                Project checks &amp; recorded groups
              </summary>
              <div className="mt-4">{contextPanel}</div>
            </details>
          </PopoverContent>
        </Popover>
      </div>
      {historyError && (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <p>{historyError}</p>
          {unsavedReply ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={historySaving || !isOnline}
                onClick={() => void retrySaving()}
              >
                {historySaving ? "Saving reply…" : "Retry saving reply"}
              </Button>
              <Button
                variant="ghost"
                disabled={historySaving || !isOnline}
                onClick={() => {
                  active.current = null;
                  setHistoryRetry((value) => value + 1);
                }}
              >
                Open saved version
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              disabled={historyLoading || !isOnline}
              onClick={() => setHistoryRetry((value) => value + 1)}
            >
              Retry loading chats
            </Button>
          )}
        </div>
      )}

      <section
        aria-label="Project chat"
        className="flex min-h-0 flex-1 flex-col"
      >
        <h2 className="sr-only">Conversation</h2>
        {openingChat && (
          <p role="status" className="py-5 text-sm text-slate-600">
            Opening saved conversation…
          </p>
        )}
        {!openingChat && !messages.length && (
          <p className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-8 text-center text-sm leading-6 text-slate-600">
            {sourceView
              ? "Ask about this Schedule or change its view."
              : "Ask about this project, or reopen a past chat."}{" "}
            {!embedded && "Suggested changes always need your review."}
            <button
              type="button"
              className="mt-1 flex min-h-11 items-center gap-2 text-left font-medium text-blue-800 underline"
              onClick={() => {
                setDraft(
                  sourceView
                    ? "Show progress"
                    : (context.examples[0] ??
                        "Show me the next two weeks look ahead."),
                );
                composer.current?.focus();
              }}
            >
              {sourceView
                ? "Show progress"
                : (context.examples[0] ??
                  "Show me the next two weeks look ahead.")}
              <ArrowRight className="size-4 shrink-0" />
            </button>
          </p>
        )}
        {!openingChat && messages.length > 0 && (
          <ol
            ref={transcript}
            className={
              "min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-1 py-4"
            }
            tabIndex={0}
            onScroll={(event) => {
              const list = event.currentTarget;
              followReply.current =
                list.scrollHeight - list.scrollTop - list.clientHeight < 100;
            }}
            aria-label="Conversation"
          >
            {messages.map((message, index) => (
              <li
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-8 rounded-2xl bg-slate-100 px-4 py-3 sm:ml-16"
                    : "space-y-3 pb-4"
                }
              >
                <p className="text-xs font-medium text-slate-600">
                  {message.role === "user" ? "You" : "Assistant"}
                </p>
                {message.role === "assistant" ? (
                  <div className="mt-2">
                    <AssistantReply
                      text={message.text}
                      animate={revealingId === message.id}
                      onComplete={() => {
                        setRevealingId((value) =>
                          value === message.id ? null : value,
                        );
                        setAnnouncement("Reply ready.");
                        if (followReply.current)
                          transcriptEnd.current?.scrollIntoView({
                            block: "nearest",
                          });
                      }}
                    />
                  </div>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                    {message.text}
                  </p>
                )}
                {message.role === "user" &&
                  !chatBusy &&
                  (message.error || index === messages.length - 1) && (
                    <div className="mt-2 space-y-2">
                      <p
                        className="text-sm text-red-700"
                        role={message.error ? "alert" : undefined}
                      >
                        {message.error ||
                          "No reply was saved for this question."}
                      </p>
                      <Button
                        variant="outline"
                        disabled={!ready || !isOnline || unsavedReply}
                        onClick={() =>
                          void sendMessage(message.text, message.id)
                        }
                      >
                        Try this question again
                      </Button>
                    </div>
                  )}
                {message.answer && revealingId !== message.id && (
                  <>
                    <AssistantResultPanels
                      answer={message.answer}
                      projectId={projectId}
                      onSaved={refreshContext}
                    />

                    {message.answer.assetSearches?.map(
                      (result, searchIndex) => (
                        <section
                          key={searchIndex}
                          aria-label="Asset search results"
                          className="min-w-0 space-y-3 border-t border-slate-200 pt-3"
                        >
                          <p className="text-sm font-semibold tabular-nums">
                            {result.total} matching assets
                          </p>
                          <p className="text-xs text-slate-600">
                            {result.records.length
                              ? `Showing ${result.offset + 1}–${result.offset + result.records.length} of ${result.total}.`
                              : "No matching records."}{" "}
                            Search covers this project’s saved asset register.
                          </p>
                          <ul className="divide-y divide-blue-100">
                            {result.records.map((asset) => (
                              <li key={asset.id}>
                                <Link
                                  href={asset.href}
                                  className="flex min-h-11 flex-col justify-center gap-1 py-2 text-sm text-blue-800 underline underline-offset-4"
                                >
                                  <span className="break-words font-medium">
                                    {asset.name}
                                  </span>
                                  <span className="text-xs text-slate-600">
                                    {[
                                      asset.equipmentType,
                                      asset.location,
                                      asset.phase,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                          <Link
                            href={result.href}
                            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-800 underline underline-offset-4"
                          >
                            Open all {result.total} in Assets
                            <ArrowRight className="size-4" />
                          </Link>
                        </section>
                      ),
                    )}
                    <SourceList
                      sources={message.answer.sources.filter(
                        (source) =>
                          source.kind !== "asset" ||
                          !message.answer?.assetSearches?.length,
                      )}
                    />
                    {message.answer.proposals.map((proposal, proposalIndex) => (
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
                    ))}
                  </>
                )}
              </li>
            ))}
            {chatBusy &&
              !revealingId &&
              messages[messages.length - 1]?.role !== "assistant" && (
                <li
                  className="space-y-2 py-3"
                  role="status"
                  aria-label="Assistant is preparing a reply"
                >
                  <p className="text-xs font-medium text-slate-600">
                    Assistant
                  </p>
                  <div className="flex min-h-8 items-center gap-3 text-sm text-slate-600">
                    <span className="flex gap-1" aria-hidden="true">
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="size-2 rounded-full bg-blue-600 animate-pulse motion-reduce:animate-none"
                          style={{ animationDelay: `${dot * 160}ms` }}
                        />
                      ))}
                    </span>
                    Preparing reply…
                  </div>
                </li>
              )}
            <li aria-hidden="true">
              <div ref={transcriptEnd} />
            </li>
          </ol>
        )}
        {chatError && messages[messages.length - 1]?.error !== chatError && (
          <p role="alert" className="text-sm text-red-700">
            {chatError}
          </p>
        )}
        {reportState && (
          <Link
            href={projectReportHref(projectId, reportState.query)}
            className="inline-flex min-h-11 items-center text-sm text-blue-800 underline"
          >
            Open current report with these saved filters
          </Link>
        )}
        {activeId && !chatBusy && (
          <p className="text-xs leading-5 text-slate-600">
            Saved replies are snapshots. Reopen a report or ask again to check
            current records. Change proposals are not stored with past messages.
          </p>
        )}

        {manualOpen && (
          <div className="max-h-[40dvh] shrink-0 overflow-y-auto">
            {" "}
            <section
              className="border-t border-slate-200 pt-5"
              aria-label="Controlled task changes"
            >
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  className="h-11"
                  aria-expanded={manualOpen}
                  disabled={manualBusy}
                  onClick={() => {
                    setManualOpen(!manualOpen);
                    setSuggestion(null);
                  }}
                >
                  <FileEdit className="size-4" />
                  Prepare a task change
                </Button>
                <InfoPopover label="About task change previews">
                  <p>
                    Works without AI. Review the exact changes, then confirm one
                    task at a time.
                  </p>
                </InfoPopover>
              </div>
              {manualOpen && (
                <div className="mt-5">
                  <h2
                    tabIndex={-1}
                    ref={editorHeading}
                    className="sr-only focus:outline-none"
                  >
                    Task change form
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
        )}
        <form
          onSubmit={send}
          className="mt-auto shrink-0 space-y-2 border-t border-slate-100 bg-white pt-3"
        >
          {showVoiceSetup && (
            <div className="max-h-[42dvh] overflow-y-auto">
              <VoiceSetup
                onContinue={acceptVoiceSetup}
                onKeyboard={() => {
                  setVoiceSetupOpen(null);
                  setVoiceStartBlocked(voiceIntent);
                  composer.current?.focus();
                }}
              />
            </div>
          )}
          {voicePartial && (
            <p
              role="status"
              aria-label="Live dictation preview"
              className="max-h-32 overflow-y-auto rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-950"
            >
              <span className="block text-xs font-medium">
                Voice preview · not sent
              </span>
              {voicePartial}
            </p>
          )}
          {voiceNote && (
            <p role="status" className="text-xs text-slate-600">
              {voiceNote}
            </p>
          )}

          <div className="flex items-end gap-1 rounded-[1.75rem] border border-slate-300 bg-slate-50 px-2 py-1.5 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Your question</span>
              <Textarea
                ref={composer}
                className="max-h-36 min-h-11 resize-none border-0 bg-transparent px-2 py-3 text-base shadow-none focus-visible:outline-none focus-visible:ring-0"
                style={{ outline: "none", outlineOffset: 0 }}
                rows={1}
                maxLength={4000}
                value={draft}
                onChange={(event) => {
                  lastDraft.current = event.target.value;
                  setDraft(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                disabled={openingChat}
                placeholder={
                  chatBusy
                    ? "Write your next question while the assistant replies…"
                    : "Ask about this project…"
                }
              />
            </label>
            {voiceSetupReady && !showVoiceSetup ? (
              <CopilotVoiceInput
                compact
                key={`${projectId}:${voiceIntent}`}
                resetKey="question"
                projectId={projectId}
                providerReady={ready}
                buttonLabel={replaceVoice ? "Dictate replacement" : "Use voice"}
                autoStart={
                  voiceStartBlocked !== voiceIntent &&
                  (voiceStartRequested === voiceIntent || input === "voice")
                }
                disabled={openingChat || !isOnline}
                onPartial={setVoicePartial}
                onNotice={(message) => {
                  if (message) setVoiceNote(message);
                }}
                onCaptureChange={(active) => {
                  if (active && !voiceCaptureActive.current)
                    voiceSession.current = createVoiceQuestionSession(
                      lastDraft.current,
                      replaceVoice,
                    );
                  if (active)
                    setVoiceNote(
                      "Preparing voice. You can cancel at any time.",
                    );
                  voiceCaptureActive.current = active;
                  setVoiceCapturing(active);
                }}
                onFinalPhrase={(phrase) => {
                  const flow = voiceSession.current;
                  if (
                    embedded &&
                    sourceView &&
                    !phrase.before.trim() &&
                    !phrase.hasInterim &&
                    !lastDraft.current.trim() &&
                    parseSchedulePanelCommand(phrase.text)
                  ) {
                    return "accept-and-finish";
                  }
                  const control = flow?.phrase(phrase, lastDraft.current);
                  if (control === "replace") setReplaceVoice(true);
                  setVoiceNote(
                    control === "replace"
                      ? "Speak the replacement question. Pause to review, then say Send."
                      : control === "finish"
                        ? "Sending this question once the microphone stops. Changes still need separate confirmation."
                        : control === "omit"
                          ? "Review the visible question first. Then pause and say Send or Edit; typing changes cancel voice sending."
                          : "Review the words above. After a pause, say Send or Edit as a separate phrase.",
                  );
                  return control;
                }}
                onTranscript={(text) => {
                  setVoicePartial("");
                  const result = (
                    voiceSession.current ??
                    createVoiceQuestionSession(lastDraft.current, replaceVoice)
                  ).complete(text, lastDraft.current);
                  voiceSession.current = null;
                  if (result.changedDuringCapture) {
                    setVoicePartial(text);
                    setVoiceNote(
                      "Your typed question changed while listening. It has been kept. Review the voice text before using it.",
                    );
                    return;
                  }
                  const opensSchedulePanel =
                    embedded &&
                    sourceView &&
                    !lastDraft.current.trim() &&
                    parseSchedulePanelCommand(result.draft);
                  lastDraft.current = result.draft;
                  setDraft(result.draft);
                  setReplaceVoice(false);
                  if (opensSchedulePanel) {
                    setVoiceNote("");
                    void sendMessage(result.draft);
                  } else if (result.send) {
                    setVoiceNote(
                      "Sending your question. This does not confirm changes.",
                    );
                    void sendMessage(result.draft);
                  } else {
                    setVoiceNote(
                      "Question ready. Review it, then Send or Edit.",
                    );
                    composer.current?.focus();
                  }
                }}
              />
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="size-11 shrink-0 rounded-full"
                aria-label="Set up voice input"
                onClick={() => setVoiceSetupOpen(voiceIntent)}
              >
                <Mic className="size-5" />
              </Button>
            )}
            {chatBusy && messages[messages.length - 1]?.role !== "assistant" ? (
              <Button
                type="button"
                variant="outline"
                className="size-11 shrink-0 rounded-full"
                aria-label="Stop waiting"
                disabled={savingQuestion}
                onClick={stopWaiting}
              >
                <Square className="size-4" />
                <span className="sr-only">Stop waiting</span>
              </Button>
            ) : (
              <Button
                className="size-11 shrink-0 rounded-full"
                aria-label="Send question"
                disabled={
                  (!ready &&
                    !(dashboardContext && parseDashboardViewCommand(draft)) &&
                    !(
                      embedded &&
                      sourceView &&
                      parseSchedulePanelCommand(draft)
                    ) &&
                    !parseAssistantViewCommand(draft) &&
                    !parseCopilotReadCommand(draft)) ||
                  chatBusy ||
                  voiceCapturing ||
                  openingChat ||
                  unsavedReply ||
                  !isOnline ||
                  !draft.trim()
                }
              >
                <Send className="size-4" />
                <span className="sr-only">Send question</span>
              </Button>
            )}
          </div>
          <p className="text-center text-xs text-slate-500">
            Questions use this project. Changes need a separate confirmation.
          </p>
        </form>
      </section>
    </div>
  );
}

function ProjectChecks({ context }: { context: CopilotContext }) {
  const noRecords = !(
    context.summary.assets +
    context.summary.tasks +
    context.summary.managedProgrammeActivities +
    (context.summary.importedProgrammeActivities ?? 0)
  );
  return (
    <section aria-label="Saved project checks" className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <ListChecks className="size-4" />
          Project checks
        </h2>
        <InfoPopover label="About saved project checks">
          <p>Calculated from saved records. These checks do not use AI.</p>
        </InfoPopover>
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
            <div key={check.id} className="flex items-start gap-2 py-2">
              <details className="min-w-0 flex-1">
                <summary className="min-h-11 cursor-pointer text-sm font-medium">
                  <span>{check.label}</span>
                  <span className="ml-2 text-slate-600 tabular-nums">
                    {check.count}
                  </span>
                </summary>
                <div className="mt-2 space-y-3">
                  <SourceList sources={check.sources} />
                  {check.count > check.sources.length && (
                    <p className="text-xs text-slate-600">
                      {check.sources.length} of {check.count} supporting records
                      shown.
                    </p>
                  )}
                </div>
              </details>
              <InfoPopover label={`About ${check.label.toLowerCase()}`}>
                <p>{check.description}</p>
              </InfoPopover>
            </div>
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
                ? source.href
                : "/overview";
        return (
          <li key={`${source.kind}-${source.id}-${index}`}>
            <Link
              href={href}
              className="inline-flex min-h-11 max-w-full items-center text-sm text-blue-700 underline underline-offset-4"
            >
              <span className="min-w-0 break-words">{source.label}</span>
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
            className="scroll-mt-36 font-semibold focus:outline-none"
          >
            Review before applying
          </h3>
          <p className="break-words text-sm text-slate-600">
            {preview.proposal.taskTitle}
          </p>
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
          <p className="break-words text-sm text-slate-600">
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
