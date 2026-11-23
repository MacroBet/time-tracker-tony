"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  filterIssues,
  groupIssues,
  issueCount,
  issueStatuses,
  projectIssues,
  summarizeIssues,
  type IssueCounts,
  type IssueDimension,
  type IssueFilters,
  type IssueStatus,
} from "@/lib/dashboard-issues";
import { projectDate, statusLabels } from "@/lib/domain";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";

const status = {
  open: { label: "Open", color: "bg-blue-600" },
  closed: { label: "Closed", color: "bg-emerald-600" },
  notApplicable: { label: "Not applicable", color: "bg-slate-400" },
} satisfies Record<IssueStatus, { label: string; color: string }>;
const monthFormat = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});
const labelFor = (value: string, dimension: IssueDimension) =>
  !value
    ? "Not recorded"
    : dimension === "month"
      ? monthFormat.format(new Date(`${value}-01T00:00:00Z`))
      : value;
const visibleStatuses = (counts: IssueCounts) =>
  issueStatuses.filter((key) => counts[key]);
const breakdown = (counts: IssueCounts) =>
  visibleStatuses(counts)
    .map((key) => `${counts[key]} ${status[key].label.toLowerCase()}`)
    .join(", ");
const pageSize = 12;

function IssueBreakdown({
  title,
  dimension,
  groups,
  selected,
  onSelect,
}: {
  title: string;
  dimension: IssueDimension;
  groups: ReturnType<typeof groupIssues>;
  selected?: string;
  onSelect: (value: string) => void;
}) {
  const monthly = dimension === "month";
  const maximum = groups.reduce((max, row) => Math.max(max, row.total), 1);
  return (
    <section className="min-w-0 space-y-3 p-4 sm:p-5" aria-label={title}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div
        className={
          monthly
            ? "flex min-h-44 items-end overflow-x-auto pb-1"
            : "max-h-52 space-y-1 overflow-y-auto pr-1"
        }
      >
        {groups.map(({ value, counts, total }) => (
          <button
            key={value}
            type="button"
            title={`${labelFor(value, dimension)} · ${breakdown(counts)}`}
            aria-label={`${labelFor(value, dimension)}, ${breakdown(counts)}`}
            aria-pressed={selected === value}
            onClick={() => onSelect(value)}
            className={`rounded-md text-left text-xs tabular-nums outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 aria-pressed:bg-blue-50 aria-pressed:text-blue-900 ${
              monthly
                ? "grid w-16 min-w-16 flex-1 grid-rows-[7rem_2rem] gap-1 px-1 text-center"
                : "grid min-h-10 w-full grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_2.5rem] items-center gap-2 px-1"
            }`}
          >
            {!monthly && (
              <span className="truncate leading-tight">
                {labelFor(value, dimension)}
              </span>
            )}
            <span
              className={
                monthly
                  ? "flex h-full flex-col items-center justify-end gap-1"
                  : "block min-w-0"
              }
              aria-hidden="true"
            >
              {monthly && <span>{total}</span>}
              <span
                className={`flex overflow-hidden rounded-sm ${
                  monthly ? "w-7 flex-col-reverse" : "h-2.5"
                }`}
                style={
                  monthly
                    ? { height: `${Math.max(5, (total / maximum) * 88)}px` }
                    : { width: `${(total / maximum) * 100}%` }
                }
              >
                {visibleStatuses(counts).map((key) => (
                  <span
                    key={key}
                    className={status[key].color}
                    style={{ flexGrow: counts[key], flexBasis: 0 }}
                  />
                ))}
              </span>
            </span>
            <span
              className={
                monthly ? "self-start justify-self-center" : "text-right"
              }
              aria-hidden="true"
            >
              {monthly ? labelFor(value, dimension) : total}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function DashboardIssues({ projectId }: { projectId: string }) {
  const { tasks, companies } = useApp();
  const today = projectDate();
  const issues = useMemo(
    () => projectIssues(tasks, companies, projectId, today),
    [tasks, companies, projectId, today],
  );
  const [filters, setFilters] = useState<IssueFilters>({});
  const [limit, setLimit] = useState(pageSize);
  const match = useMemo(() => filterIssues(issues, filters), [issues, filters]);
  const { counts, datedOpen, average } = summarizeIssues(match);
  const visible = issueCount(counts);
  const hasFilters = Object.keys(filters).length > 0;
  const options = useMemo(() => {
    const values = (key: "company" | "year" | "type" | "cause") =>
      [...new Set(issues.map((issue) => issue[key]))].sort((a, b) =>
        key === "year" ? b.localeCompare(a) : a.localeCompare(b),
      );
    return {
      company: values("company"),
      year: values("year"),
      type: values("type"),
      cause: values("cause"),
    };
  }, [issues]);
  const setFilter = (key: keyof IssueFilters, value?: string) => {
    setLimit(pageSize);
    setFilters((previous) => {
      const next = { ...previous };
      if (value === undefined || previous[key] === value) delete next[key];
      else next[key] = value;
      if (key === "year") delete next.month;
      return next;
    });
  };
  if (!issues.length)
    return (
      <section className="space-y-2 rounded-xl border bg-white p-5">
        <h2 className="text-xl font-semibold">Issues overview</h2>
        <p role="status" className="text-sm text-slate-600">
          No issues are recorded for this project.
        </p>
      </section>
    );

  const selections = [
    { key: "company", label: "Assigned company", all: "All companies" },
    { key: "year", label: "Created year", all: "All years" },
    { key: "type", label: "Issue type", all: "All types" },
    { key: "cause", label: "Root cause", all: "All root causes" },
  ] as const;
  const dimensions = [
    { key: "company", title: "Issues by assigned company" },
    { key: "month", title: "Issues by created month" },
    { key: "type", title: "Issues by type" },
    { key: "cause", title: "Issues by root cause" },
  ] as const;
  const chartDimensions = dimensions.filter(({ key }) =>
    key === "type" || key === "cause" ? options[key].some(Boolean) : true,
  );
  const missing = [
    ...(!options.type.some(Boolean) ? ["issue type"] : []),
    ...(!options.cause.some(Boolean) ? ["root cause"] : []),
  ];
  const kpis = [
    { label: "Issues", value: visible, key: undefined },
    { label: "Open", value: counts.open, key: "open" },
    { label: "Closed", value: counts.closed, key: "closed" },
  ] as const;
  return (
    <section className="min-w-0 space-y-4" aria-labelledby="issues-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="issues-heading"
          className="text-xl font-semibold tracking-tight"
        >
          Issues overview
        </h2>
        {visible > 0 && (
          <a
            className="text-sm font-medium text-blue-700 hover:underline"
            href="#issue-records"
          >
            View issue records
          </a>
        )}
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-200 overflow-hidden rounded-xl border bg-white md:grid-cols-4">
        {kpis.map(({ label, value, key }) => (
          <button
            key={label}
            type="button"
            aria-pressed={filters.status === key}
            onClick={() => setFilter("status", key)}
            className="min-w-0 border-b px-4 py-3 text-left outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 aria-pressed:bg-blue-50 md:border-b-0"
          >
            <span className="block text-xs font-medium text-slate-600">
              {label}
            </span>
            <span className="block text-2xl font-semibold tabular-nums text-slate-900">
              {value.toLocaleString("en-GB")}
            </span>
          </button>
        ))}
        <div
          className="px-4 py-3"
          title="Average calendar days since creation for currently open issues with a valid creation date"
        >
          <div className="text-xs font-medium text-slate-600">
            Avg days open
          </div>
          <div className="text-2xl font-semibold tabular-nums text-slate-900">
            {average === null ? "—" : average.toLocaleString("en-GB")}
          </div>
          {datedOpen < counts.open && (
            <p className="text-xs text-slate-600">
              {datedOpen} open issues with usable dates
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {selections
          .filter(({ key }) => options[key].some(Boolean))
          .map(({ key, label, all }) => (
            <label
              key={key}
              className="grid min-w-0 max-w-full grow basis-36 gap-1 text-xs font-medium text-slate-600 sm:flex-none"
            >
              {label}
              <select
                aria-label={label}
                value={filters[key] === undefined ? "" : `v:${filters[key]}`}
                onChange={(event) =>
                  setFilter(
                    key,
                    event.target.value
                      ? event.target.value.slice(2)
                      : undefined,
                  )
                }
                className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus-visible:outline-blue-600 sm:w-40"
              >
                <option value="">{all}</option>
                {options[key].map((value) => (
                  <option key={value} value={`v:${value}`}>
                    {value || "Not recorded"}
                  </option>
                ))}
              </select>
            </label>
          ))}
        {filters.month !== undefined && (
          <Button variant="outline" onClick={() => setFilter("month")}>
            {labelFor(filters.month, "month")} <span aria-hidden="true">×</span>
            <span className="sr-only">Clear month filter</span>
          </Button>
        )}
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setFilters({});
              setLimit(pageSize);
            }}
          >
            Reset filters
          </Button>
        )}
      </div>
      {visible > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2.5 text-xs font-medium text-slate-700 sm:px-5">
            <div
              className="flex h-2.5 w-24 overflow-hidden rounded-sm"
              role="img"
              aria-label={`Issues by status: ${breakdown(counts)}`}
            >
              {visibleStatuses(counts).map((key) => (
                <span
                  key={key}
                  className={status[key].color}
                  style={{ flexGrow: counts[key] }}
                />
              ))}
            </div>
            {visibleStatuses(counts).map((key) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-sm ${status[key].color}`}
                  aria-hidden="true"
                />
                {status[key].label}
                {key === "notApplicable" ? ` (${counts[key]})` : ""}
              </span>
            ))}
          </div>
          <div className="grid divide-y divide-slate-200 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:divide-y-0 lg:gap-px lg:bg-slate-200">
            {chartDimensions.map(({ key, title }) => (
              <div key={key} className="min-w-0 bg-white">
                <IssueBreakdown
                  title={title}
                  dimension={key}
                  groups={groupIssues(match, key)}
                  selected={filters[key]}
                  onSelect={(value) => setFilter(key, value)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p
          role="status"
          className="rounded-xl border bg-white p-4 text-sm text-slate-600"
        >
          No issues match these filters.
        </p>
      )}
      {missing.length > 0 && (
        <p className="text-xs text-slate-600">
          No {missing.join(" or ")} recorded in this project.
        </p>
      )}
      {visible > 0 && (
        <section
          id="issue-records"
          className="scroll-mt-28 overflow-hidden rounded-xl border bg-white"
        >
          <h3 className="border-b px-4 py-3 text-sm font-semibold">
            Issue records{" "}
            <span className="ml-1 font-normal text-slate-600">
              ({visible.toLocaleString("en-GB")})
            </span>
          </h3>
          <ul className="divide-y">
            {match.slice(0, limit).map(({ task, company, created }) => (
              <li key={task.id}>
                <Link
                  href={`/tasks/${encodeURIComponent(task.id)}`}
                  className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:grid-cols-[minmax(0,1fr)_9rem_6rem_auto]"
                >
                  <span className="font-medium leading-tight text-blue-700">
                    {task.externalId && (
                      <span className="mr-1.5 text-slate-600">
                        #{task.externalId}
                      </span>
                    )}
                    {task.title}
                  </span>
                  <span className="hidden truncate text-xs text-slate-600 sm:block">
                    {company || "Not recorded"}
                  </span>
                  <span className="text-right text-xs text-slate-600 sm:text-left">
                    {statusLabels[task.status]}
                  </span>
                  <span className="hidden items-center gap-2 whitespace-nowrap text-xs text-slate-600 sm:flex">
                    {created || "No date"}{" "}
                    <ArrowUpRight aria-hidden="true" size={14} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {visible > limit && (
            <div className="border-t px-3 py-2">
              <Button
                variant="ghost"
                onClick={() => setLimit(limit + pageSize)}
              >
                Show more issues
              </Button>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
