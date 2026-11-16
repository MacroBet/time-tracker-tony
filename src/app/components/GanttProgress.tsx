import Link from "next/link";
import type { OperationalStatus } from "@/lib/project-reports";
export function GanttProgress({
  percent,
  status,
  href,
  description,
  notApplicable = false,
}: {
  percent: number | null;
  status: OperationalStatus;
  href: string;
  description?: string;
  notApplicable?: boolean;
}) {
  const colour =
    status.colour === "red"
      ? "text-red-700"
      : status.colour === "orange"
        ? "text-amber-700"
        : status.colour === "green"
          ? "text-emerald-700"
          : "text-slate-700";
  const label = `${notApplicable ? "Step progress not applicable" : percent === null ? "Step progress unknown" : `${percent}% of required applicable steps passed`}. ${status.label}${description ? `. ${description}` : ""}`;
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="flex min-h-11 min-w-11 items-center justify-center rounded hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700"
    >
      <span
        className={`relative inline-grid size-10 place-items-center text-[10px] font-semibold tabular-nums ${colour}`}
      >
        <svg
          viewBox="0 0 40 40"
          className="absolute inset-0 size-10 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="20"
            cy="20"
            r="17"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="3"
          />
          {percent !== null && (
            <circle
              cx="20"
              cy="20"
              r="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              pathLength="100"
              strokeDasharray={`${Math.max(0, Math.min(100, percent))} 100`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <span>
          {notApplicable ? "N/A" : percent === null ? "—" : `${percent}%`}
        </span>
      </span>
    </Link>
  );
}
