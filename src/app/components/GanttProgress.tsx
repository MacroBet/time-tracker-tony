import Link from "next/link";
import type { OperationalStatus } from "@/lib/project-reports";
export function GanttProgress({
  percent,
  status,
  href,
  description,
}: {
  percent: number | null;
  status: OperationalStatus;
  href: string;
  description?: string;
}) {
  const colour =
    status.colour === "red"
      ? "bg-red-700 text-white"
      : status.colour === "orange"
        ? "bg-amber-200 text-amber-950"
        : status.colour === "green"
          ? "bg-emerald-700 text-white"
          : "text-slate-700";
  const label = `${percent === null ? "Step progress unknown" : `${percent}% of required applicable steps passed`}. ${status.label}${description ? `. ${description}` : ""}`;
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="flex min-h-11 min-w-11 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-blue-700"
    >
      <span
        className={`inline-flex min-h-7 min-w-11 items-center justify-center rounded px-1 text-xs font-semibold tabular-nums ${colour}`}
      >
        {percent === null ? "—" : `${percent}%`}
      </span>
    </Link>
  );
}
