"use client";
import { hasModule } from "@/lib/commissioning";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Camera, X } from "lucide-react";
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
  const { projects, selectedProjectId, mutate, isOnline, currentUser } =
    useApp();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [screenshot, setScreenshot] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const show = () => {
      if (busy || !projects.length || !hasModule(currentUser, "feedback"))
        return;
      returnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setProjectId(selectedProjectId);
      setOpen(true);
    };
    window.addEventListener("fieldtrack:open-feedback", show);
    return () => window.removeEventListener("fieldtrack:open-feedback", show);
  }, [busy, projects.length, currentUser, selectedProjectId]);
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
  if (!hasModule(currentUser, "feedback")) return null;
  return (
    <div data-feedback>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Report an issue</DialogTitle>
            <DialogDescription>
              Help improve FieldTrack. Your report will be saved in project
              feedback for review.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} aria-busy={busy}>
            <fieldset disabled={busy} className="min-w-0 space-y-4">
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
              <p className="break-words text-xs text-slate-600">
                Page: {pathname}. Review the screenshot before submitting.
              </p>
              <Button disabled={busy || !isOnline} className="w-full h-11">
                {busy ? "Working…" : "Save report"}
              </Button>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
