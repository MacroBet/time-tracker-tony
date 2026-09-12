"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
export function FeedbackButton() {
  const { projects, mutate, isOnline } = useApp();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [screenshot, setScreenshot] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();
  async function capture() {
    setBusy(true);
    setOpen(false);
    try {
      const { toPng } = await import("html-to-image");
      await new Promise((resolve) => setTimeout(resolve, 180));
      const png = await toPng(document.body, {
        pixelRatio: 0.8,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: "#f8fafc",
        skipFonts: true,
        filter: (node) =>
          !(
            node instanceof HTMLElement &&
            (node.dataset.feedback !== undefined ||
              node.dataset.radixPortal !== undefined)
          ),
        style: { transform: `translateY(-${window.scrollY}px)` },
      });
      if (png.length > 1500000)
        throw new Error(
          "Screenshot is too large. Submit the report without it.",
        );
      setScreenshot(png);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Screenshot unavailable. You can still submit a description.",
      );
    } finally {
      setBusy(false);
      setOpen(true);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await mutate("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          description,
          page: pathname,
          screenshot,
        }),
      });
      toast.success("Report saved in project feedback");
      setOpen(false);
      setDescription("");
      setScreenshot(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not submit report",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div data-feedback>
      <Button
        disabled={busy || !projects.length}
        onClick={() => setOpen(true)}
        aria-label="Report an issue"
        title="Report an issue"
        className="fixed bottom-4 left-4 sm:left-auto sm:right-4 z-30 shadow-lg rounded-full h-11 w-11 sm:w-auto px-0 sm:px-4 text-sm bg-slate-900 hover:bg-slate-800"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <Bug className="size-4" />
        <span className="hidden sm:inline">Report an issue</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report an issue</DialogTitle>
            <DialogDescription>
              Help improve FieldTrack. Your report will be saved in project
              feedback for review.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-project">Project</Label>
              <select
                id="feedback-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="field-select"
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-description">What happened?</Label>
              <Textarea
                id="feedback-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={10}
                maxLength={5000}
                rows={4}
                placeholder="Describe the problem and what you expected to happen…"
              />
            </div>
            {screenshot ? (
              <div className="relative rounded-lg border overflow-hidden">
                <img
                  src={screenshot}
                  alt="Screenshot to include with your report"
                  className="max-h-52 w-full object-contain bg-slate-100"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  aria-label="Remove screenshot"
                  className="absolute top-2 right-2"
                  onClick={() => setScreenshot(undefined)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={capture}
                disabled={busy}
                className="w-full"
              >
                <Camera className="size-4" />
                Capture current screen
              </Button>
            )}
            <p className="text-xs text-slate-500">
              Page: {pathname}. Review the screenshot before submitting.
            </p>
            <Button disabled={busy || !isOnline} className="w-full h-11">
              {busy ? "Working…" : "Save report"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
