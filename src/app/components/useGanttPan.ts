"use client";
import {
  useRef,
  useState,
  type RefObject,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import { pannedScheduleDate } from "@/lib/gantt-pan";

/** Drag the ruler/background to navigate; bars retain their separate date-edit gesture. */
export function useGanttPan({
  scroller,
  pixelsPerDay,
  getDate,
  onDate,
}: {
  scroller: RefObject<HTMLDivElement | null>;
  pixelsPerDay: number;
  getDate: () => string;
  onDate: (date: string) => void;
}) {
  const gesture = useRef<{
    pointerId: number;
    x: number;
    y: number;
    date: string;
    scrollLeft: number;
    active: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  function finish(event: PointerEvent<HTMLDivElement>, cancel = false) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (current.active && !cancel)
      onDate(
        pannedScheduleDate(
          current.date,
          event.clientX - current.x,
          pixelsPerDay,
        ),
      );
    else if (scroller.current)
      scroller.current.scrollTo({ left: current.scrollLeft });
  }
  return {
    dragging,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLDivElement>) {
        const target = event.target as Element;
        if (
          event.button !== 0 ||
          !target.closest("[data-gantt-pan]") ||
          target.closest(
            "button,a,input,select,textarea,label,[data-date-drag]",
          )
        )
          return;
        gesture.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          date: getDate(),
          scrollLeft: scroller.current?.scrollLeft ?? 0,
          active: false,
        };
      },
      onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const dx = event.clientX - current.x,
          dy = event.clientY - current.y;
        if (!current.active) {
          if (Math.abs(dx) < 6) return;
          if (Math.abs(dy) > Math.abs(dx)) {
            gesture.current = null;
            return;
          }
          current.active = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }
        event.preventDefault();
        if (scroller.current)
          scroller.current.scrollTo({ left: current.scrollLeft - dx });
      },
      onPointerUp(event: PointerEvent<HTMLDivElement>) {
        finish(event);
      },
      onPointerCancel(event: PointerEvent<HTMLDivElement>) {
        finish(event, true);
      },
      onLostPointerCapture(event: PointerEvent<HTMLDivElement>) {
        if (gesture.current) finish(event, true);
      },
      onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === "Escape" && gesture.current) {
          const current = gesture.current;
          gesture.current = null;
          setDragging(false);
          if (scroller.current)
            scroller.current.scrollTo({ left: current.scrollLeft });
          event.preventDefault();
          return;
        }
        if (
          event.target !== event.currentTarget ||
          !["ArrowLeft", "ArrowRight"].includes(event.key) ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        event.preventDefault();
        onDate(
          pannedScheduleDate(
            getDate(),
            (event.key === "ArrowLeft" ? 1 : -1) *
              pixelsPerDay *
              (event.shiftKey ? 7 : 1),
            pixelsPerDay,
          ),
        );
      },
    },
  };
}
