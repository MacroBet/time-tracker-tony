"use client";

import { useEffect, useRef, useState } from "react";
import { AssistantMarkdown } from "./AssistantMarkdown";

/** Presentation of a completed response; provider transport remains unchanged. */
export function AssistantReply({
  text,
  animate = false,
  onComplete,
}: {
  text: string;
  animate?: boolean;
  onComplete?: () => void;
}) {
  const [visible, setVisible] = useState(animate ? 0 : text.length);
  const completed = useRef(onComplete);
  useEffect(() => {
    completed.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    if (!animate) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let length = 0;
    const timer = window.setInterval(() => {
      length = reduced.matches
        ? text.length
        : Math.min(
            text.length,
            length + Math.max(18, Math.ceil(text.length / 36)),
          );
      setVisible(length);
      if (length >= text.length) {
        window.clearInterval(timer);
        completed.current?.();
      }
    }, 25);
    return () => window.clearInterval(timer);
  }, [text, animate]);
  return (
    <div aria-busy={animate && visible < text.length}>
      <AssistantMarkdown text={animate ? text.slice(0, visible) : text} />
    </div>
  );
}
