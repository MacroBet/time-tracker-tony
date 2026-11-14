"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "./ui/button";
import { COPILOT_AUDIO, encodeCopilotWav } from "@/lib/copilot-audio";
import { InfoPopover } from "./InfoPopover";

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
}: {
  projectId: string;
  disabled?: boolean;
  onTranscript: (text: string) => void;
}) {
  const [state, setState] = useState<
    "idle" | "permission" | "recording" | "transcribing"
  >("idle");
  const [seconds, setSeconds] = useState(0),
    [error, setError] = useState("");
  const recording = useRef<Recording | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0),
    lock = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishRef = useRef<() => void>(() => {});

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
      lock.current = false;
      request.current?.abort();
      release();
      setState("idle");
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
      lock.current = false;
      request.current?.abort();
      release();
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [projectId, disabled]);

  async function finish() {
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
      if (generation.current === token && !controller.signal.aborted)
        onTranscript(result.text);
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
        setState("idle");
      }
    }
  }
  useEffect(() => {
    finishRef.current = () => void finish();
  });

  async function start() {
    if (disabled || lock.current) return;
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
    lock.current = true;
    const token = ++generation.current;
    setError("");
    setSeconds(0);
    setState("permission");
    let stream: MediaStream | undefined, context: AudioContext | undefined;
    try {
      // Permission is requested only by this explicit button click.
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
        setState("idle");
        setError(
          "Microphone access is unavailable. Check your browser permission or type your question.",
        );
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={state === "recording" ? "destructive" : "outline"}
          className="min-h-11 gap-2"
          disabled={
            disabled || state === "permission" || state === "transcribing"
          }
          onClick={
            state === "recording" ? () => void finish() : () => void start()
          }
          aria-label={
            state === "recording"
              ? "Stop recording and transcribe"
              : "Record a voice query"
          }
        >
          {state === "recording" ? (
            <Square className="size-4" />
          ) : (
            <Mic className="size-4" />
          )}
          {state === "recording"
            ? `Stop · ${seconds}s`
            : state === "permission"
              ? "Allow microphone…"
              : state === "transcribing"
                ? "Transcribing…"
                : "Use microphone"}
        </Button>
        {state === "idle" ? (
          <InfoPopover label="About voice questions">
            <p>
              Up to 30 seconds. Review the text before sending. Recording starts
              only when you choose Use microphone.
            </p>
          </InfoPopover>
        ) : (
          <span className="text-xs text-slate-600" role="status">
            {state === "recording"
              ? "Recording · stops after 30 seconds"
              : state === "transcribing"
                ? "Microphone off. Preparing text for your review."
                : "Up to 30 seconds. Review the text before sending."}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
