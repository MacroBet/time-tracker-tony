"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { hasModule } from "@/lib/commissioning";
import { canManage } from "@/lib/permissions";
import {
  MISSING_REPORT_VALUE,
  CONFLICT_REPORT_VALUE,
  REPORT_TYPES,
  LOOKAHEAD_WEEKS,
  reportQuerySchema,
  reportQueryParams,
  type OperationalStatus,
  type ProjectReportQuery,
  type ProjectReportResult,
  type ProjectReportRow,
  type StepProgress,
} from "@/lib/project-reports";
import { useApp } from "../contexts/AppContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { InfoPopover } from "./InfoPopover";

const titles = {
  tagging: "Test step progress",
  "works-to-go": "Works to go",
  lookahead: "Schedule lookahead",
  vendors: "Equipment suppliers needed",
};
type ReportViewProps = {
  projectId: string;
  initialQuery?: Partial<ProjectReportQuery>;
  externalQuery?: ProjectReportQuery;
  onQueryChange?: (query: ProjectReportQuery) => void;
  hideReportPicker?: boolean;
};
export function ProjectReportView(props: ReportViewProps) {
  return <ProjectReportSession key={props.projectId} {...props} />;
}
function ProjectReportSession({
  projectId,
  initialQuery = {},
  externalQuery,
  onQueryChange,
  hideReportPicker = false,
}: ReportViewProps) {
  const { isOnline, currentUser, projects, memberships } = useApp();
  const allowed =
    canManage(currentUser) &&
    hasModule(currentUser, "reports") &&
    projects.some((project) => project.id === projectId) &&
    memberships.some(
      (membership) =>
        membership.userId === currentUser.id &&
        membership.projectId === projectId,
    );
  const accessSignature = JSON.stringify([
    currentUser.id,
    currentUser.role,
    currentUser.modules?.slice().sort(),
    projects.map((project) => project.id).sort(),
    memberships
      .filter((membership) => membership.userId === currentUser.id)
      .map((membership) => membership.projectId)
      .sort(),
  ]);
  const [query, setQuery] = useState<ProjectReportQuery>(() =>
    reportQuerySchema.parse(initialQuery),
  );
  const externalKey = JSON.stringify(externalQuery ?? null);
  const [querySync, setQuerySync] = useState({
    observed: externalKey,
    emitted: [] as string[],
  });
  // Native history updates can arrive after the next keystroke. Own URL echoes
  // must not replace the immediate input state with an older typed value.
  if (querySync.observed !== externalKey) {
    const echo = querySync.emitted.lastIndexOf(externalKey);
    setQuerySync({
      observed: externalKey,
      emitted: echo < 0 ? [] : querySync.emitted.slice(echo + 1),
    });
    if (externalQuery && echo < 0) setQuery(externalQuery);
  }
  const [response, setResponse] = useState<{
      result: ProjectReportResult;
      access: string;
    } | null>(null),
    [error, setError] = useState("");
  const result =
    allowed && response?.access === accessSignature ? response.result : null;
  const [loadedKey, setLoadedKey] = useState(""),
    [retry, setRetry] = useState(0),
    [exporting, setExporting] = useState(false);
  const requestKey = JSON.stringify(query),
    endpoint = `/api/projects/${encodeURIComponent(projectId)}/reports`;
  const loadKey = `${endpoint}:${requestKey}:${retry}:${accessSignature}`;
  const exportRequest = useRef<AbortController | null>(null);
  const loading = loadedKey !== loadKey;
  useEffect(() => {
    const controller = new AbortController();
    if (!allowed) return () => controller.abort();
    void apiRequest<ProjectReportResult>(
      `${endpoint}?${reportQueryParams(JSON.parse(requestKey))}`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setResponse({ result: value, access: accessSignature });
          setError("");
        }
      })
      .catch((problem: unknown) => {
        if (!controller.signal.aborted)
          setError(
            problem instanceof Error
              ? problem.message
              : "The report could not load. Reconnect and try again.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(loadKey);
      });
    return () => controller.abort();
  }, [endpoint, requestKey, loadKey, accessSignature, allowed]);
  useEffect(
    () => () => exportRequest.current?.abort(),
    [accessSignature, projectId],
  );
  function update(patch: Partial<ProjectReportQuery>) {
    const next = reportQuerySchema.parse({
      ...query,
      ...patch,
      offset: patch.offset ?? 0,
    });
    setQuery(next);
    setQuerySync((current) => ({
      ...current,
      emitted: [...current.emitted.slice(-31), JSON.stringify(next)],
    }));
    onQueryChange?.(next);
  }
  async function download() {
    if (!allowed || !result) return;
    setExporting(true);
    const controller = new AbortController();
    exportRequest.current = controller;
    try {
      const response = await fetch(
        `${endpoint}?${reportQueryParams(result.query)}&format=csv&version=${result.revision.register}`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.error ?? "The report export could not be prepared.",
        );
      }
      const url = URL.createObjectURL(await response.blob()),
        link = document.createElement("a");
      link.href = url;
      link.download = `fieldtrack-${query.report}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(
        `Exported all ${response.headers.get("X-Report-Total") ?? "matching"} records`,
      );
    } catch (problem) {
      if (controller.signal.aborted) return;
      toast.error(
        problem instanceof Error
          ? problem.message
          : "Export failed. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  }
  const facets = result?.facets;
  if (!allowed)
    return (
      <p role="alert" className="text-sm text-slate-600">
        This report is no longer available to your account. Choose an assigned
        project with Reports access.
      </p>
    );
  return (
    <section className="min-w-0 space-y-5" aria-label="Project report">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <h2 className="break-words text-xl font-semibold">
            {titles[query.report]}
          </h2>
          <InfoPopover label="About this project report">
            <p>
              Totals, filters and exports use the same saved project records.
              Export includes the complete filtered population.
            </p>
            <p>
              Supplier is the recorded equipment supplier. Missing or
              conflicting mappings remain visible.
            </p>
          </InfoPopover>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={loading || !isOnline}
            onClick={() => setRetry((value) => value + 1)}
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            disabled={
              loading || exporting || !isOnline || !result || result.total === 0
            }
            onClick={() => void download()}
          >
            <Download className="size-4" />
            {exporting ? "Preparing export…" : "Export all matches"}
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!hideReportPicker && (
          <label className="min-w-0 text-sm font-medium">
            Report
            <select
              className="field-select mt-1 w-full"
              value={query.report}
              onChange={(event) =>
                update({
                  report: event.target.value as ProjectReportQuery["report"],
                  activity: undefined,
                  level: undefined,
                  late: "all",
                  query: undefined,
                })
              }
            >
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {titles[type]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="min-w-0 text-sm font-medium">
          Equipment supplier
          <select
            className="field-select mt-1 w-full"
            value={query.vendor ?? ""}
            onChange={(event) =>
              update({ vendor: event.target.value || undefined })
            }
          >
            <option value="">All suppliers</option>
            <option value={MISSING_REPORT_VALUE}>
              Not recorded / not linked
            </option>
            {facets?.vendors.map((vendor) => (
              <option key={vendor} value={vendor}>
                {vendor}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium">
          Discipline
          <select
            className="field-select mt-1 w-full"
            value={query.discipline ?? ""}
            onChange={(event) =>
              update({ discipline: event.target.value || undefined })
            }
          >
            <option value="">All disciplines</option>
            <option value={MISSING_REPORT_VALUE}>Not recorded</option>
            {query.report === "works-to-go" && (
              <option value={CONFLICT_REPORT_VALUE}>
                Conflicting recorded values
              </option>
            )}
            {facets?.disciplines.map((discipline) => (
              <option key={discipline} value={discipline}>
                {discipline}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-sm font-medium">
          Search
          <Input
            className="mt-1"
            value={query.query ?? ""}
            maxLength={200}
            placeholder="Name or reference"
            onChange={(event) =>
              update({ query: event.target.value || undefined })
            }
          />
        </label>
        {query.report === "tagging" && (
          <label className="min-w-0 text-sm font-medium">
            Tag level
            <select
              className="field-select mt-1 w-full"
              value={query.level ?? ""}
              onChange={(event) =>
                update({
                  level:
                    (event.target.value as ProjectReportQuery["level"]) ||
                    undefined,
                })
              }
            >
              <option value="">All applicable levels</option>
              {query.level &&
                facets &&
                !facets.levels.includes(query.level) && (
                  <option value={query.level} disabled>
                    {query.level} · disabled in project
                  </option>
                )}
              {facets?.levels.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>
        )}
        {query.report !== "works-to-go" && (
          <label className="min-w-0 text-sm font-medium">
            Deadline status
            <select
              className="field-select mt-1 w-full"
              value={query.late}
              onChange={(event) =>
                update({
                  late: event.target.value as ProjectReportQuery["late"],
                })
              }
            >
              <option value="all">All deadline states</option>
              <option value="late">Late</option>
              <option value="not-late">Not late · dated records</option>
              <option value="unknown">Unknown / no deadline</option>
            </select>
          </label>
        )}
        {query.report === "works-to-go" && (
          <label className="min-w-0 text-sm font-medium">
            Remaining work status
            <select
              className="field-select mt-1 w-full"
              value={query.workStatus}
              onChange={(event) =>
                update({
                  workStatus: event.target
                    .value as ProjectReportQuery["workStatus"],
                })
              }
            >
              <option value="open">Open</option>
              <option value="done">Completed</option>
              <option value="all">All saved items</option>
            </select>
          </label>
        )}
        {(query.report === "lookahead" || query.report === "vendors") && (
          <>
            <label className="min-w-0 text-sm font-medium">
              Window starts
              <Input
                className="mt-1"
                type="date"
                value={query.from ?? result?.window.from ?? ""}
                onChange={(event) =>
                  update({ from: event.target.value || undefined })
                }
              />
            </label>
            <label className="min-w-0 text-sm font-medium">
              Lookahead
              <select
                className="field-select mt-1 w-full"
                value={query.weeks ?? 2}
                onChange={(event) =>
                  update({
                    weeks: Number(event.target.value) as 2 | 4 | 6,
                  })
                }
              >
                {LOOKAHEAD_WEEKS.map((weeks) => (
                  <option key={weeks} value={weeks}>
                    {weeks} weeks
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-sm font-medium">
              Activities
              <select
                className="field-select mt-1 w-full"
                value={query.activityStatus}
                onChange={(event) =>
                  update({
                    activityStatus: event.target
                      .value as ProjectReportQuery["activityStatus"],
                  })
                }
              >
                <option value="open">Open activities</option>
                <option value="done">Completed activities</option>
                <option value="all">All dated activities</option>
              </select>
            </label>
          </>
        )}
      </div>
      {query.activity && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          <div className="flex min-w-0 items-center gap-1">
            <p className="break-words">
              Activity scope:{" "}
              {!loading && result?.activity
                ? result.activity.name
                : "Selected schedule activity"}
            </p>
            <InfoPopover label="Activity scope identity">
              <p className="break-all">{query.activity}</p>
              <p>
                Only the equipment and checksheet levels explicitly mapped to
                this schedule activity appear in this report.
              </p>
            </InfoPopover>
          </div>
          <Button
            variant="ghost"
            onClick={() => update({ activity: undefined })}
          >
            Remove activity filter
          </Button>
        </div>
      )}
      {error && !loading && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          <p>{error}</p>
          <Button
            variant="outline"
            disabled={!isOnline || loading}
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry
          </Button>
        </div>
      )}
      {loading && (
        <p role="status" className="text-sm text-slate-600">
          Loading the filtered report…
        </p>
      )}
      {result && !loading && !error && (
        <>
          {result.activity?.unknownReason && (
            <p
              role="alert"
              className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
            >
              {result.activity.unknownReason}. No equipment or tag levels have
              been inferred.
            </p>
          )}
          {query.report === "tagging" && result.progress && (
            <p className="text-sm">
              <span className="text-slate-600">Filtered required steps: </span>
              <Progress value={result.progress} />
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <p className="tabular-nums">
              {result.total.toLocaleString()} matching{" "}
              {query.report === "vendors" ? "supplier groups" : "records"} ·{" "}
              {result.total ? result.offset + 1 : 0}–
              {Math.min(result.offset + result.rows.length, result.total)} shown
            </p>
            <Button
              variant="link"
              onClick={() =>
                update({
                  vendor: undefined,
                  activity: undefined,
                  level: undefined,
                  late: "all",
                  discipline: undefined,
                  query: undefined,
                  from: undefined,
                  weeks: undefined,
                  workStatus: "open",
                  activityStatus: "open",
                })
              }
            >
              Clear filters
            </Button>
          </div>
          {(query.report === "lookahead" || query.report === "vendors") && (
            <p className="text-sm text-slate-600">
              {result.window.from}–{result.window.through} inclusive ·{" "}
              {result.timezone} · {result.coverage.activities} total saved
              activities across source and managed schedules.
            </p>
          )}
          <Coverage result={result} />
          {!result.rows.length ? (
            <p className="border-y border-slate-200 py-6 text-sm text-slate-600">
              No saved records match these filters. Clear or change the filters
              to review another population.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {result.rows.map((row) => (
                <li key={`${row.kind}:${row.id}`} className="min-w-0 py-4">
                  <ReportRow row={row} />
                </li>
              ))}
            </ul>
          )}
          {result.total > result.limit && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                disabled={result.offset === 0}
                onClick={() =>
                  update({ offset: Math.max(0, result.offset - result.limit) })
                }
              >
                Previous
              </Button>
              <span className="text-sm text-slate-600">
                Page {Math.floor(result.offset / result.limit) + 1} of{" "}
                {Math.ceil(result.total / result.limit)}
              </span>
              <Button
                variant="outline"
                disabled={result.offset + result.limit >= result.total}
                onClick={() => update({ offset: result.offset + result.limit })}
              >
                Next
              </Button>
            </div>
          )}
          <details className="border-t border-slate-200 pt-2">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
              Calculation, source and coverage notes
            </summary>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
              {result.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p className="mt-3 break-words text-xs text-slate-600">
              Register revision {result.revision.register}
              {result.revision.sourceSha
                ? ` · Source ${result.revision.sourceSha}`
                : " · No imported source"}{" "}
              · Generated {new Date(result.generatedAt).toLocaleString("en-GB")}
            </p>
          </details>
        </>
      )}
    </section>
  );
}
function Progress({ value }: { value: StepProgress }) {
  return (
    <span className="text-sm tabular-nums">
      <strong>{value.percent === null ? "—" : `${value.percent}%`}</strong> ·{" "}
      {value.passed}/{value.required} required steps passed
      {value.notApplicable ? ` · ${value.notApplicable} N/A excluded` : ""}
      {value.missingSheets
        ? ` · ${value.missingSheets} checksheet mappings missing`
        : ""}
    </span>
  );
}
function Status({ value }: { value: OperationalStatus }) {
  const colour =
    value.colour === "red"
      ? "text-red-700"
      : value.colour === "orange"
        ? "text-amber-800"
        : value.colour === "green"
          ? "text-emerald-800"
          : "text-slate-600";
  return <span className={`text-sm font-medium ${colour}`}>{value.label}</span>;
}
function ReportRow({ row }: { row: ProjectReportRow }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          href={row.href}
          className="inline-flex min-h-11 max-w-full items-center text-sm font-semibold text-blue-700 underline underline-offset-4"
        >
          <span className="min-w-0 break-words">{row.name}</span>
        </Link>
        {row.kind === "tagging" || row.kind === "lookahead" ? (
          <Status value={row.status} />
        ) : null}
      </div>
      <p className="break-words text-sm text-slate-600">
        Supplier:{" "}
        {row.vendor ??
          (row.kind === "lookahead" && row.vendors.length
            ? row.vendors.join(", ")
            : "Not recorded / not linked")}
        {row.kind === "tagging" || row.kind === "works-to-go"
          ? ` · Discipline: ${row.discipline === CONFLICT_REPORT_VALUE ? "Conflicting recorded values" : (row.discipline ?? "Not recorded")}`
          : ""}
      </p>
      {row.kind === "tagging" && (
        <>
          <p className="text-sm text-slate-600">
            {[row.equipmentType, row.phase, row.area]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p>
            <Progress value={row.progress} />
          </p>
          <p className="text-sm text-slate-600">
            {row.openIssues} open issues · {row.openWorks} open works to go ·{" "}
            {row.signatures} active signatures
          </p>
          <details>
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
              Tag levels, checksheets and approvals ({row.levels.length})
            </summary>
            <ul className="divide-y divide-slate-200">
              {row.levels.map((level) => (
                <li className="space-y-2 py-3" key={level.level}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="text-sm">{level.level}</strong>
                    <Status value={level.status} />
                  </div>
                  <p>
                    <Progress value={level.progress} />
                  </p>
                  <p className="text-sm text-slate-600">
                    {level.sheets} checksheets · {level.signatures} active
                    signatures
                  </p>
                  {level.reviews.length ? (
                    <ul className="space-y-1">
                      {level.reviews.map((review) => (
                        <li key={review.taskId}>
                          <Link
                            href={review.href}
                            className="inline-flex min-h-11 items-center text-sm text-blue-700 underline underline-offset-4"
                          >
                            Task test: {review.result} · Approval:{" "}
                            {review.review ?? "not recorded"}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-600">
                      No tag task or approval recorded.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      {row.kind === "works-to-go" && (
        <>
          <p className="text-sm text-slate-600">
            {row.status === "open" ? "Open" : "Completed"} ·{" "}
            {row.assetName ?? "No equipment attribution"}
            {row.attribution === "conflict"
              ? " · Conflicting linked attribution"
              : ""}
          </p>
          {row.notes && (
            <p className="max-w-prose whitespace-pre-wrap break-words text-sm">
              {row.notes}
            </p>
          )}
        </>
      )}
      {row.kind === "lookahead" && (
        <>
          <p className="text-sm text-slate-600">
            {row.activityId} ·{" "}
            {row.source === "source"
              ? "Imported source / working view"
              : "Managed app schedule"}{" "}
            · {row.start ?? "Undated"}–{row.finish ?? "Undated"}
            {row.calendar ? ` · ${row.calendar}` : ""}
          </p>
          {row.deadline && row.deadline !== row.finish && (
            <p className="text-sm text-slate-600">
              Saved planned deadline: {row.deadline}
              {row.deadlineSource === "target_end_date"
                ? " · imported planned target"
                : ""}
            </p>
          )}
          <ul className="flex flex-wrap gap-x-4">
            {row.assets.map((asset) => (
              <li key={asset.id}>
                <Link
                  className="inline-flex min-h-11 max-w-full items-center text-sm text-blue-700 underline underline-offset-4"
                  href={asset.href}
                >
                  {asset.name}
                </Link>
              </li>
            ))}
          </ul>
          {!row.assets.length && (
            <p className="text-sm text-amber-800">
              No equipment link recorded; a supplier cannot be identified.
            </p>
          )}
        </>
      )}
      {row.kind === "vendors" && (
        <>
          <p className="text-sm text-slate-600">
            {row.activities} activities · {row.assetCount} equipment items ·{" "}
            {row.start}–{row.finish}
          </p>
          <details>
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
              Supporting activities ({row.sources.length})
            </summary>
            <ul className="space-y-1">
              {row.sources.map((source) => (
                <li key={source.id}>
                  <Link
                    href={source.href}
                    className="inline-flex min-h-11 max-w-full items-center text-sm text-blue-700 underline underline-offset-4"
                  >
                    <span className="min-w-0 break-words">
                      {source.activityId} · {source.name} · {source.start}–
                      {source.finish}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
function Coverage({ result }: { result: ProjectReportResult }) {
  const coverage = result.coverage;
  const warnings = [
    coverage.sourceUnavailable
      ? "Imported source index unavailable; this result has partial schedule coverage."
      : "",
    coverage.assetsMissingVendor
      ? `${coverage.assetsMissingVendor} project assets have no recorded equipment supplier.`
      : "",
    coverage.ambiguousActivityReferences
      ? `${coverage.ambiguousActivityReferences} activity references are ambiguous and were not attributed.`
      : "",
    result.report === "lookahead" || result.report === "vendors"
      ? `Across the full project window before supplier and discipline filters: ${coverage.activitiesWithoutAssetLinks} activities have no equipment link; ${coverage.activitiesMissingVendor} have incomplete supplier attribution. Across the saved schedule: ${coverage.undatedActivities} activities lack dates; ${coverage.overdueActivities} open activities are overdue outside or overlapping the window.`
      : "",
    result.report === "works-to-go" && coverage.worksDisciplineConflict
      ? `${coverage.worksDisciplineConflict} saved remaining-work items have conflicting attribution.`
      : "",
  ].filter(Boolean);
  return warnings.length ? (
    <details className="text-sm text-slate-700">
      <summary className="min-h-11 cursor-pointer py-2 font-medium">
        Data coverage ({warnings.length})
      </summary>
      <ul className="list-disc space-y-2 pl-5 leading-6">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </details>
  ) : null;
}
