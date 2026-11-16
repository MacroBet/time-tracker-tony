"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "./ui/button";
import { COPILOT_AUDIO, encodeCopilotWav } from "@/lib/copilot-audio";
import { InfoPopover } from "./InfoPopover";
import {
  createLocalDictation,
  checkLocalDictationAvailability,
  type LocalRecognitionConstructor,
  type LocalFinalPhrase,
  type LocalPhraseControl,
} from "@/lib/live-dictation";

type Recording = {
  context: AudioContext;
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  mute: GainNode;
  chunks: Float32Array[];
  length: number;
  sampleRate: number;
};

export function CopilotVoiceInput({
  projectId,
  disabled = false,
  onTranscript,
  onPartial,
  onFinalPhrase,
  onCaptureChange,
  onNotice,
  providerReady = true,
  compact = false,
  autoStart = false,
  buttonLabel = "Use microphone",
  resetKey = "dictation",
}: {
  projectId: string;
  disabled?: boolean;
  onTranscript: (text: string) => void;
  onPartial?: (text: string) => void;
  onFinalPhrase?: (phrase: LocalFinalPhrase) => LocalPhraseControl;
  onCaptureChange?: (active: boolean) => void;
  onNotice?: (message: string) => void;
  providerReady?: boolean;
  compact?: boolean;
  /** Set only after the user chooses the voice entry; never at login. */
  autoStart?: boolean;
  buttonLabel?: string;
  resetKey?: string;
}) {
  const [state, setState] = useState<
    | "idle"
    | "checking"
    | "permission"
    | "recording"
    | "finalizing"
    | "transcribing"
  >("idle");
  const [seconds, setSeconds] = useState(0),
    [error, setError] = useState("");
  const [mode, setMode] = useState<"live" | "file">("live");
  const notice = useRef(onNotice);
  useEffect(() => {
    notice.current = onNotice;
  }, [onNotice]);
  useEffect(() => {
    if (error) notice.current?.(error);
    else if (state === "recording")
      notice.current?.(
        mode === "live"
          ? "Listening on this device. Pause, then say Send or Edit. Stops after 30 seconds."
          : "Recording audio. Stop to transcribe and review it before sending.",
      );
    else if (state === "checking")
      notice.current?.("Checking on-device English (UK). No download starts.");
    else if (state === "permission")
      notice.current?.("Waiting for microphone permission. You can cancel.");
    else if (state === "finalizing")
      notice.current?.("Microphone stopping. Preparing your final words.");
    else if (state === "transcribing")
      notice.current?.("Microphone off. Transcribing audio for review.");
  }, [error, state, mode]);
  const errorId = useId();
  const [availability, setAvailability] = useState("");
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const probeRequest = useRef<AbortController | null>(null);
  const local = useRef<ReturnType<typeof createLocalDictation> | null>(null);
  const callbacks = useRef({
    onPartial,
    onFinalPhrase,
    onCaptureChange,
    onTranscript,
  });
  useEffect(() => {
    callbacks.current = {
      onPartial,
      onFinalPhrase,
      onCaptureChange,
      onTranscript,
    };
  }, [onPartial, onFinalPhrase, onCaptureChange, onTranscript]);
  const recording = useRef<Recording | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0),
    lock = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishRef = useRef<() => void>(() => {});
  const startRef = useRef<() => void>(() => {});
  const autoStarted = useRef(false);

  function release() {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    const active = recording.current;
    recording.current = null;
    if (active) {
      active.processor.onaudioprocess = null;
      active.processor.disconnect();
      active.source.disconnect();
      active.mute.disconnect();
      active.stream.getTracks().forEach((track) => track.stop());
      void active.context.close().catch(() => {});
    }
    return active;
  }

  useEffect(() => {
    const cancel = () => {
      generation.current++;
      probeRequest.current?.abort();
      local.current?.cancel();
      local.current = null;
      callbacks.current.onPartial?.("");
      callbacks.current.onCaptureChange?.(false);
      lock.current = false;
      request.current?.abort();
      release();
      setState("idle");
      setCheckingAvailability(false);
      setSeconds(0);
    };
    if (disabled) cancel();
    const hidden = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      // This ref is an operation generation counter, not a rendered node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      probeRequest.current?.abort();
      local.current?.cancel();
      local.current = null;
      callbacks.current.onPartial?.("");
      callbacks.current.onCaptureChange?.(false);
      lock.current = false;
      request.current?.abort();
      release();
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [projectId, disabled, resetKey]);

  async function finish() {
    if (mode === "live") {
      local.current?.stop();
      return;
    }
    const active = release();
    if (!active) return;
    const token = generation.current;
    setState("transcribing");
    setError("");
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const bytes = encodeCopilotWav(active.chunks, active.sampleRate);
      if (bytes.length <= 44)
        throw new Error(
          "No audio recorded. Please try again or type your question.",
        );
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/copilot/transcribe`,
        {
          method: "POST",
          headers: { "Content-Type": "audio/wav" },
          body: new Blob([bytes], { type: "audio/wav" }),
          signal: controller.signal,
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Voice transcription is unavailable.",
        );
      if (
        typeof result?.text !== "string" ||
        result.text.length > COPILOT_AUDIO.maxText
      )
        throw new Error("No usable transcript returned.");
      if (generation.current === token && !controller.signal.aborted) {
        callbacks.current.onCaptureChange?.(false);
        callbacks.current.onPartial?.("");
        callbacks.current.onTranscript(result.text);
      }
    } catch (problem) {
      if (generation.current === token)
        setError(
          controller.signal.aborted
            ? "Voice transcription stopped. You can still type your question."
            : problem instanceof Error
              ? problem.message
              : "Could not transcribe audio. You can still type your question.",
        );
    } finally {
      clearTimeout(timeout);
      if (generation.current === token) {
        lock.current = false;
        callbacks.current.onCaptureChange?.(false);
        setState("idle");
      }
    }
  }
  useEffect(() => {
    finishRef.current = () => void finish();
    startRef.current = () => void start();
  });
  useEffect(() => {
    if (!autoStart || disabled || autoStarted.current) return;
    const timeout = setTimeout(() => {
      autoStarted.current = true;
      startRef.current();
    }, 0);
    return () => clearTimeout(timeout);
  }, [autoStart, disabled]);

  async function start() {
    if (disabled || lock.current) return;
    if (!window.isSecureContext) {
      setError(
        "Live dictation needs a secure browser page. Type your question instead.",
      );
      return;
    }
    lock.current = true;
    const token = ++generation.current;
    setMode("live");
    setError("");
    setSeconds(0);
    const surface = window as typeof window & {
      SpeechRecognition?: LocalRecognitionConstructor;
      webkitSpeechRecognition?: LocalRecognitionConstructor;
    };
    const controller = createLocalDictation(
      surface.SpeechRecognition ?? surface.webkitSpeechRecognition,
      {
        onState: (value) => {
          if (token !== generation.current) return;
          setState(value);
          if (value === "idle") {
            lock.current = false;
            if (timer.current) clearInterval(timer.current);
            timer.current = null;
          } else if (value === "recording") {
            const began = Date.now();
            timer.current = setInterval(
              () =>
                setSeconds(
                  Math.min(30, Math.floor((Date.now() - began) / 1000)),
                ),
              250,
            );
          }
        },
        onPartial: (text) => {
          if (token === generation.current) callbacks.current.onPartial?.(text);
        },
        onCaptureChange: (active) => {
          if (token === generation.current)
            callbacks.current.onCaptureChange?.(active);
        },
        onFinalPhrase: (phrase) =>
          token === generation.current
            ? callbacks.current.onFinalPhrase?.(phrase)
            : "omit",
        onTranscript: (text) => {
          if (token === generation.current)
            callbacks.current.onTranscript(text);
        },
        onError: (message) => {
          if (token === generation.current) setError(message);
        },
      },
    );
    local.current = controller;
    await controller.start();
  }

  async function checkAvailability() {
    if (disabled || lock.current) return;
    lock.current = true;
    const token = generation.current;
    const controller = new AbortController();
    probeRequest.current = controller;
    setCheckingAvailability(true);
    setAvailability("");
    const surface = window as typeof window & {
      SpeechRecognition?: LocalRecognitionConstructor;
      webkitSpeechRecognition?: LocalRecognitionConstructor;
    };
    const status = await checkLocalDictationAvailability(
      surface.SpeechRecognition ?? surface.webkitSpeechRecognition,
      { signal: controller.signal },
    );
    if (token !== generation.current || controller.signal.aborted) return;
    lock.current = false;
    setCheckingAvailability(false);
    setAvailability(
      status === "available"
        ? "English (UK) live dictation is ready on this device. This check did not start the microphone."
        : status === "downloadable" || status === "downloading"
          ? "English (UK) live dictation is not ready for this page. No language pack was downloaded or microphone started."
          : "On-device live dictation is unavailable here. This check did not start the microphone. You can still type.",
    );
  }

  async function startFile() {
    if (disabled || lock.current || !providerReady) return;
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof AudioContext === "undefined"
    ) {
      setError(
        "Voice recording is unavailable in this browser. Type your question instead.",
      );
      return;
    }
    local.current?.cancel();
    local.current = null;
    lock.current = true;
    const token = ++generation.current;
    setMode("file");
    callbacks.current.onCaptureChange?.(true);
    callbacks.current.onPartial?.("");
    setError("");
    setSeconds(0);
    setState("permission");
    let stream: MediaStream | undefined, context: AudioContext | undefined;
    try {
      // This follows an explicit microphone entry or recording-button choice.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true },
        video: false,
      });
      if (generation.current !== token) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      context = new AudioContext();
      await context.resume();
      if (generation.current !== token) {
        stream.getTracks().forEach((track) => track.stop());
        await context.close();
        return;
      }
      const source = context.createMediaStreamSource(stream),
        processor = context.createScriptProcessor(4096, 1, 1),
        mute = context.createGain();
      mute.gain.value = 0;
      const active: Recording = {
        context,
        stream,
        source,
        processor,
        mute,
        chunks: [],
        length: 0,
        sampleRate: context.sampleRate,
      };
      recording.current = active;
      processor.onaudioprocess = (event) => {
        if (recording.current !== active) return;
        const available =
          Math.floor(active.sampleRate * COPILOT_AUDIO.seconds) - active.length;
        if (available <= 0) {
          finishRef.current();
          return;
        }
        const samples = event.inputBuffer.getChannelData(0).slice(0, available);
        active.chunks.push(samples);
        active.length += samples.length;
      };
      source.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);
      setState("recording");
      const began = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.min(
          COPILOT_AUDIO.seconds,
          Math.floor((Date.now() - began) / 1000),
        );
        setSeconds(elapsed);
        if (elapsed >= COPILOT_AUDIO.seconds) finishRef.current();
      }, 250);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      if (context) void context.close().catch(() => {});
      release();
      if (generation.current === token) {
        lock.current = false;
        callbacks.current.onCaptureChange?.(false);
        setState("idle");
        setError(
          "Microphone access is unavailable. Check your browser permission or type your question.",
        );
      }
    }
  }

  const recordButton = (
    <Button
      type="button"
      variant={state === "recording" ? "destructive" : "outline"}
      className={compact ? "size-11 shrink-0 rounded-full" : "min-h-11 gap-2"}
      disabled={
        disabled ||
        checkingAvailability ||
        state === "checking" ||
        state === "permission" ||
        state === "finalizing" ||
        state === "transcribing"
      }
      onClick={state === "recording" ? () => void finish() : () => void start()}
      aria-label={
        state === "recording"
          ? mode === "live"
            ? "Stop on-device dictation and review"
            : "Stop recording and transcribe"
          : "Start on-device live dictation"
      }
      aria-describedby={error ? errorId : undefined}
    >
      {state === "recording" ? (
        <Square className="size-4" />
      ) : (
        <Mic className="size-4" />
      )}
      <span className={compact ? "sr-only" : undefined}>
        {state === "recording"
          ? `Stop · ${seconds}s`
          : state === "checking"
            ? "Checking on-device dictation…"
            : state === "finalizing"
              ? "Finishing transcript…"
              : state === "permission"
                ? "Allow microphone…"
                : state === "transcribing"
                  ? "Transcribing…"
                  : buttonLabel}
      </span>
    </Button>
  );
  if (compact)
    return (
      <div className="flex shrink-0 items-center gap-0.5">
        {recordButton}
        <InfoPopover label="Voice options">
          <p>
            On-device English (UK). Pause to review, then say Send or Edit as a
            separate phrase. Changes always need separate confirmation.
          </p>
          {state !== "idle" && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                generation.current++;
                local.current?.cancel();
                local.current = null;
                request.current?.abort();
                release();
                callbacks.current.onPartial?.("");
                callbacks.current.onCaptureChange?.(false);
                lock.current = false;
                setState("idle");
              }}
            >
              Cancel voice
            </Button>
          )}
          {state === "idle" && providerReady && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={disabled}
              onClick={() => void startFile()}
            >
              Record audio after stop
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={disabled || checkingAvailability || state !== "idle"}
            onClick={() => void checkAvailability()}
          >
            Check live availability
          </Button>
          {availability && <p role="status">{availability}</p>}
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
        </InfoPopover>
        <span
          id={error ? errorId : undefined}
          className="sr-only"
          role="status"
        >
          {error ||
            (state === "recording"
              ? `${mode === "live" ? "On-device live dictation" : "Recording audio"}, ${seconds} seconds`
              : state === "checking"
                ? "Checking on-device dictation"
                : state === "finalizing"
                  ? "Finishing transcript"
                  : state === "transcribing"
                    ? "Transcribing audio"
                    : "")}
        </span>
      </div>
    );
  return (
    <div
      className="min-w-0 space-y-2"
      aria-busy={
        state === "checking" ||
        state === "permission" ||
        state === "finalizing" ||
        state === "transcribing"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {recordButton}
        {state !== "idle" && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              generation.current++;
              probeRequest.current?.abort();
              local.current?.cancel();
              local.current = null;
              callbacks.current.onPartial?.("");
              callbacks.current.onCaptureChange?.(false);
              lock.current = false;
              request.current?.abort();
              release();
              setState("idle");
              setSeconds(0);
              setError("");
            }}
          >
            Cancel voice
          </Button>
        )}
        {state === "idle" && providerReady && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 whitespace-normal"
            disabled={disabled}
            onClick={() => void startFile()}
          >
            Record audio after stop
          </Button>
        )}
        {state === "idle" ? (
          <InfoPopover label="About voice questions">
            <p>
              On-device live dictation shows English (UK) text as you speak when
              this browser has a ready language pack. No pack is downloaded and
              no cloud fallback starts automatically. Review the final text
              before sending.
              {providerReady &&
                " Audio after stop is a separate choice: a recording of up to 30 seconds is sent to the configured transcription service after you stop."}
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 whitespace-normal"
              disabled={disabled || checkingAvailability}
              onClick={() => void checkAvailability()}
            >
              {checkingAvailability
                ? "Checking local availability…"
                : "Check live availability"}
            </Button>
            {availability && <p role="status">{availability}</p>}
          </InfoPopover>
        ) : (
          <span className="text-xs text-slate-600" role="status">
            {state === "recording"
              ? `${mode === "live" ? "On-device live dictation" : "Recording for transcription after stop"} · stops after 30 seconds`
              : state === "checking"
                ? "Checking local English (UK) availability. No download starts."
                : state === "finalizing"
                  ? "Microphone stopping. Waiting for the final transcript."
                  : state === "transcribing"
                    ? "Microphone off. Preparing text for your review."
                    : "Up to 30 seconds. Review the text before sending."}
          </span>
        )}
      </div>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="break-words text-sm text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
