"use client";

import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import {
  dragGanttDates,
  ganttDateDelta,
  type GanttDateDragMode,
  type GanttDateRange,
  type GanttDragRow,
} from "@/lib/gantt-date-drag";

type Gesture = {
  row: GanttDragRow;
  mode: GanttDateDragMode;
  pointerId: number;
  x: number;
  y: number;
  trigger: HTMLElement;
  moved: boolean;
  dates: GanttDateRange | null;
};

/** Shared by source and managed bars. Saving belongs to the separate review panel. */
export function useGanttDateDrag({
  pixelsPerDay,
  onPropose,
}: {
  pixelsPerDay: number;
  onPropose: (
    row: GanttDragRow,
    dates: GanttDateRange,
    trigger: HTMLElement,
  ) => void;
}) {
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const [preview, setPreview] = useState<
    (GanttDateRange & { id: string }) | null
  >(null);
  function consumeClick() {
    const result = suppressClick.current;
    suppressClick.current = false;
    return result;
  }
  function clear() {
    const previous = gesture.current;
    gesture.current = null;
    setPreview(null);
    if (previous?.trigger.hasPointerCapture(previous.pointerId))
      previous.trigger.releasePointerCapture(previous.pointerId);
    // The synthetic click immediately following pointerup is suppressed; a later click is normal.
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    return previous;
  }
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !gesture.current) return;
      event.preventDefault();
      const previous = gesture.current;
      gesture.current = null;
      setPreview(null);
      if (previous.trigger.hasPointerCapture(previous.pointerId))
        previous.trigger.releasePointerCapture(previous.pointerId);
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, []);

  function bindings(
    row: GanttDragRow,
    mode: GanttDateDragMode,
  ): HTMLAttributes<HTMLElement> {
    return {
      onPointerDown(event) {
        if (
          !event.isPrimary ||
          event.button !== 0 ||
          !dragGanttDates(row, mode, 0)
        )
          return;
        gesture.current = {
          row,
          mode,
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          trigger: event.currentTarget,
          moved: false,
          dates: null,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove(event) {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const dx = event.clientX - current.x,
          dy = event.clientY - current.y;
        if (!current.moved) {
          if (Math.abs(dx) < 6) return;
          if (Math.abs(dy) > Math.abs(dx)) {
            clear();
            return;
          }
          current.moved = true;
          suppressClick.current = true;
        }
        event.preventDefault();
        event.stopPropagation();
        current.dates = dragGanttDates(
          current.row,
          current.mode,
          ganttDateDelta(dx, pixelsPerDay),
        );
        if (current.dates) setPreview({ id: current.row.id, ...current.dates });
      },
      onPointerUp(event) {
        if (gesture.current?.pointerId !== event.pointerId) return;
        const current = clear();
        if (
          current?.moved &&
          current.dates &&
          (current.dates.start !== current.row.start ||
            current.dates.finish !== current.row.finish)
        )
          onPropose(current.row, current.dates, current.trigger);
      },
      onPointerCancel(event) {
        if (gesture.current?.pointerId === event.pointerId) clear();
      },
      onLostPointerCapture(event) {
        if (gesture.current?.pointerId === event.pointerId) clear();
      },
      onClickCapture(event) {
        if (!consumeClick()) return;
        event.preventDefault();
        event.stopPropagation();
      },
      onKeyDown(event) {
        if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key))
          return;
        event.preventDefault();
        event.stopPropagation();
        const changeMode = mode === "move" && event.shiftKey ? "finish" : mode;
        const dates = dragGanttDates(
          row,
          changeMode,
          event.key === "ArrowRight" ? 1 : -1,
        );
        if (dates && (dates.start !== row.start || dates.finish !== row.finish))
          onPropose(row, dates, event.currentTarget);
      },
    };
  }
  return { preview, bindings, consumeClick };
}
