"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import {
  checkLocalDictationAvailability,
  type LocalAvailability,
} from "@/lib/live-dictation";
import {
  installLocalVoice,
  type InstallableLocalRecognition,
} from "@/lib/voice-device";
export function VoiceSetup({
  onContinue,
  onKeyboard,
}: {
  onContinue: () => void;
  onKeyboard: () => void;
}) {
  const [canInstall, setCanInstall] = useState(false);
  const [status, setStatus] = useState<LocalAvailability | null>(null),
    [busy, setBusy] = useState(false),
    [installing, setInstalling] = useState(false);
  const generation = useRef(0);
  const operation = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      generation.current++;
      operation.current?.abort();
    },
    [],
  );
  const constructor = () => {
    const surface = window as typeof window & {
      SpeechRecognition?: InstallableLocalRecognition;
      webkitSpeechRecognition?: InstallableLocalRecognition;
    };
    return surface.SpeechRecognition ?? surface.webkitSpeechRecognition;
  };
  async function check() {
    const token = ++generation.current;
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    const engine = constructor();
    setCanInstall(typeof engine?.install === "function");
    const value = await checkLocalDictationAvailability(engine, {
      signal: controller.signal,
    });
    if (token === generation.current) {
      setStatus(value);
      setBusy(false);
    }
  }
  async function install() {
    const token = ++generation.current;
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setInstalling(true);
    const value = await installLocalVoice(
      constructor(),
      true,
      controller.signal,
    );
    if (token === generation.current) {
      setStatus(value);
      setInstalling(false);
    }
  }
  return (
    <section
      aria-label="Set up voice questions"
      className="space-y-3 border-t border-slate-200 pt-3"
    >
      <h3 className="text-sm font-semibold">Ask by voice</h3>
      <p className="text-sm text-slate-700">
        Speak your question, pause to review the words, then say{" "}
        <strong>Send</strong> or <strong>Edit</strong> as a separate phrase.
        Edit lets you dictate the whole question again. You can always type
        instead.
      </p>
      <p className="text-sm text-slate-700">
        Live English (UK) stays on this device when its language pack is ready.
        Checking or downloading a pack does not start the microphone. Recording
        begins only when you choose Start voice.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={busy || installing}
          onClick={() => void check()}
        >
          {busy ? "Checking…" : "Check this device"}
        </Button>
        {status === "downloadable" && canInstall && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 whitespace-normal"
            disabled={installing}
            onClick={() => void install()}
          >
            {installing ? "Downloading English…" : "Set up on-device English"}
          </Button>
        )}
      </div>
      {status && (
        <p role="status" className="text-sm text-slate-700">
          {status === "available"
            ? "This device is ready for live English (UK)."
            : status === "downloadable"
              ? "This page needs the English language pack. Set up downloads it to this device; it does not record or send a question."
              : status === "downloading"
                ? "The browser is downloading English. Check again when it finishes."
                : "Live dictation is unavailable here. Use your browser's on-device speech settings, or type. Audio after stop remains a separate choice when configured."}
        </p>
      )}
      {status === "downloadable" && !canInstall && (
        <p className="text-sm text-slate-700">
          This browser cannot set up the local pack from this page. Open the app
          in a browser with on-device speech setup, or use the keyboard.
        </p>
      )}
      {installing && (
        <p role="status" className="text-sm text-slate-700">
          The browser manages this download. Leaving this panel stops waiting
          here; the browser may continue the download.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-11"
          disabled={busy || installing}
          onClick={onContinue}
        >
          Start voice
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={onKeyboard}
        >
          Use keyboard
        </Button>
      </div>
    </section>
  );
}
