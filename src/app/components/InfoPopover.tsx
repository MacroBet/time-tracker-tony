"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/** Help remains available to keyboard, touch and pointer users. */
export function InfoPopover({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={`inline-flex size-11 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${className}`}
        >
          <Info aria-hidden="true" className="size-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={label}
        className="w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl bg-white text-sm leading-6 text-slate-700"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
