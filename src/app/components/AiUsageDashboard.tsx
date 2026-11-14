"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AiUsageResult, AiUsageTotals } from "@/lib/ai-usage";
import type { TokenUsage } from "@/lib/openai-metering";
import { apiRequest } from "@/lib/api-client";
import { useApp } from "../contexts/AppContext";
import { AppShell } from "./AppShell";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { InfoPopover } from "./InfoPopover";

type Filters = {
  from: string;
  through: string;
  timezone: "Europe/Rome" | "UTC";
  model: string;
  source: "" | "responses" | "transcription";
};
type DashboardData = AiUsageResult & {
  dataSource: "database" | "synthetic-demo";
};
type Metric = "tokens" | "cost" | "calls";
const number = new Intl.NumberFormat("en-GB");
const compact = new Intl.NumberFormat("en-GB", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const allItems = "__all__";
const sourceLabel = (source: string) =>
  source === "responses" ? "Chat · Responses API" : "Transcription";
function period(days: number, timezone: Filters["timezone"]): Filters {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string) =>
    parts.find((item) => item.type === name)?.value;
  const through = `${part("year")}-${part("month")}-${part("day")}`;
  const start = new Date(`${through}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return {
    from: start.toISOString().slice(0, 10),
    through,
    timezone,
    model: "",
    source: "",
  };
}
function dayLabel(date: string, long = false) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: long ? "long" : "short",
    ...(long ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
function usd(value: number) {
  if (value > 0 && value < 0.000001) return "<$0.000001";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value !== 0 && Math.abs(value) < 0.01 ? 6 : 4,
  }).format(value);
}
function cost(totals: AiUsageTotals) {
  if (totals.estimatedUsdMin === null || totals.estimatedUsdMax === null)
    return "Unavailable";
  return totals.estimatedUsdMin === totals.estimatedUsdMax
    ? usd(totals.estimatedUsdMin)
    : `${usd(totals.estimatedUsdMin)}–${usd(totals.estimatedUsdMax)}`;
}
function tokens(totals: AiUsageTotals, field: keyof TokenUsage) {
  const value = totals.tokens[field];
  if (value !== null) return number.format(value);
  const known = totals.knownTokens[field];
  return known > 0 ? `${number.format(known)} known` : "Unavailable";
}
function missingTitle(totals: AiUsageTotals, field: keyof TokenUsage) {
  const missing = totals.unknownTokenAttempts[field];
  return missing
    ? `${number.format(missing)} API calls have no recorded value for this token field.`
    : undefined;
}

export function AiUsageDashboard() {
  const { currentUser, isOnline } = useApp();
  const isAdmin = currentUser.role === "admin";
  const [draft, setDraft] = useState<Filters>(() => period(30, "Europe/Rome"));
  const [active, setActive] = useState<Filters>(draft);
  const [preset, setPreset] = useState<number | null>(30);
  const [metric, setMetric] = useState<Metric>("tokens");
  const [revision, setRevision] = useState(0);
  const [filterError, setFilterError] = useState("");
  const [response, setResponse] = useState<{
    key: string;
    data: DashboardData;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const params = new URLSearchParams({
    from: active.from,
    through: active.through,
    timezone: active.timezone,
  });
  if (active.model) params.set("model", active.model);
  if (active.source) params.set("source", active.source);
  const query = params.toString();
  const key = JSON.stringify([
    currentUser.id,
    currentUser.role,
    query,
    revision,
  ]);
  const data = isAdmin && response?.key === key ? response.data : null;
  const error = !data && failure?.key === key ? failure.message : "";
  const loading = isAdmin && !data && !error && isOnline;
  const dirty = JSON.stringify(draft) !== JSON.stringify(active);
  useEffect(() => {
    if (!isAdmin || !isOnline) return;
    const controller = new AbortController();
    void apiRequest<DashboardData>(`/api/admin/ai-usage?${query}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setResponse({ key, data: result });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setFailure({
            key,
            message:
              reason instanceof Error
                ? reason.message
                : "Recorded AI usage could not load. Please retry.",
          });
      });
    return () => controller.abort();
  }, [isAdmin, isOnline, key, query]);
  function choosePeriod(days: number) {
    const next = {
      ...period(days, draft.timezone),
      model: draft.model,
      source: draft.source,
    };
    setDraft(next);
    setActive(next);
    setPreset(days);
    setFilterError("");
  }
  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const from = Date.parse(`${draft.from}T12:00:00Z`),
      through = Date.parse(`${draft.through}T12:00:00Z`);
    if (!Number.isFinite(from) || !Number.isFinite(through) || from > through) {
      setFilterError(
        "Choose valid start and end dates, with the start before the end.",
      );
      return;
    }
    if ((through - from) / 86400000 + 1 > 366) {
      setFilterError("Choose a period of 366 days or fewer.");
      return;
    }
    setFilterError("");
    setActive(draft);
    setRevision((value) => value + 1);
  }
  return (
    <AppShell title="AI usage" wide projectScoped={false}>
      {!isAdmin ? (
        <p role="alert" className="text-sm text-slate-700">
          AI usage is available to administrators only.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              All FieldTrack projects · Administrator view
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={loading || !isOnline}
              onClick={() => setRevision((value) => value + 1)}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
          {data?.dataSource === "synthetic-demo" && (
            <p
              role="status"
              className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-950"
            >
              Synthetic demo usage · Sample requests and estimates only. These
              figures are not real API consumption or charges.
            </p>
          )}
          <form
            onSubmit={apply}
            className="space-y-4"
            aria-label="AI usage filters"
          >
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Period shortcuts"
            >
              {[7, 30, 90].map((days) => (
                <Button
                  key={days}
                  type="button"
                  variant={preset === days ? "default" : "outline"}
                  aria-pressed={preset === days}
                  disabled={!isOnline}
                  onClick={() => choosePeriod(days)}
                >
                  Last {days} days
                </Button>
              ))}
              <Button
                type="button"
                variant={preset === null ? "default" : "outline"}
                aria-pressed={preset === null}
                onClick={() => setPreset(null)}
              >
                Custom
              </Button>
            </div>
            <div className="grid grid-cols-2 items-end gap-3 xl:grid-cols-[minmax(8.5rem,1fr)_minmax(8.5rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(11rem,1.2fr)_auto]">
              <label className="min-w-0 space-y-1 text-sm font-medium max-[359px]:col-span-2">
                From
                <Input
                  type="date"
                  required
                  value={draft.from}
                  onChange={(event) => {
                    setDraft({ ...draft, from: event.target.value });
                    setPreset(null);
                  }}
                />
              </label>
              <label className="min-w-0 space-y-1 text-sm font-medium max-[359px]:col-span-2">
                Through
                <Input
                  type="date"
                  required
                  value={draft.through}
                  onChange={(event) => {
                    setDraft({ ...draft, through: event.target.value });
                    setPreset(null);
                  }}
                />
              </label>
              <div className="min-w-0 space-y-1 text-sm font-medium">
                <label htmlFor="ai-usage-timezone" className="text-sm">
                  Timezone
                </label>
                <Select
                  value={draft.timezone}
                  onValueChange={(value: Filters["timezone"]) => {
                    const timezone = value;
                    setDraft(
                      preset
                        ? {
                            ...period(preset, timezone),
                            model: draft.model,
                            source: draft.source,
                          }
                        : { ...draft, timezone },
                    );
                  }}
                >
                  <SelectTrigger id="ai-usage-timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Rome">Europe/Rome</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-1 text-sm font-medium">
                <label htmlFor="ai-usage-source" className="text-sm">
                  Source
                </label>
                <Select
                  value={draft.source || allItems}
                  onValueChange={(value) =>
                    setDraft({
                      ...draft,
                      source:
                        value === allItems ? "" : (value as Filters["source"]),
                    })
                  }
                >
                  <SelectTrigger id="ai-usage-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allItems}>All sources</SelectItem>
                    <SelectItem value="responses">
                      Chat · Responses API
                    </SelectItem>
                    <SelectItem value="transcription">Transcription</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-1 text-sm font-medium">
                <label htmlFor="ai-usage-model" className="text-sm">
                  Model
                </label>
                <Select
                  value={draft.model || allItems}
                  onValueChange={(value) =>
                    setDraft({
                      ...draft,
                      model: value === allItems ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id="ai-usage-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allItems}>All models</SelectItem>
                    {Array.from(
                      new Set([
                        ...(data?.facets.models ?? []),
                        ...(draft.model ? [draft.model] : []),
                      ]),
                    ).map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={!isOnline}>
                Apply filters
              </Button>
            </div>
            {filterError && (
              <p role="alert" className="text-sm text-red-700">
                {filterError}
              </p>
            )}
            {dirty && !filterError && (
              <p className="text-sm text-slate-600">
                Apply the selected filters to update this view.
              </p>
            )}
          </form>
          {!isOnline && (
            <p
              role="status"
              className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
            >
              You are offline.{" "}
              {data
                ? "Showing the last loaded view. Reconnect before refreshing."
                : "Reconnect to load recorded AI usage."}
            </p>
          )}
          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-800"
            >
              <p>{error} No usage totals are shown for this failed request.</p>
              <Button
                variant="outline"
                disabled={!isOnline}
                onClick={() => setRevision((value) => value + 1)}
              >
                Retry
              </Button>
            </div>
          )}
          {loading && (
            <p role="status" className="py-8 text-sm text-slate-600">
              Loading recorded AI usage…
            </p>
          )}
          {data && (
            <UsageResults data={data} metric={metric} onMetric={setMetric} />
          )}
        </div>
      )}
    </AppShell>
  );
}

function UsageResults({
  data,
  metric,
  onMetric,
}: {
  data: AiUsageResult;
  metric: Metric;
  onMetric: (metric: Metric) => void;
}) {
  const totals = data.totals;
  const incomplete = totals.partialUsageAttempts + totals.missingUsageAttempts;
  const coverageWarning =
    incomplete > 0 || totals.unpricedAttempts > 0 || totals.pendingAttempts > 0;
  const metrics: {
    label: string;
    value: string;
    hint?: string;
    title?: string;
  }[] = [
    {
      label: "API calls",
      value: number.format(totals.attempts),
      hint: "Recorded requests",
    },
    {
      label: "Input tokens",
      value: tokens(totals, "inputTokens"),
      title: missingTitle(totals, "inputTokens"),
    },
    {
      label: "Output tokens",
      value: tokens(totals, "outputTokens"),
      title: missingTitle(totals, "outputTokens"),
    },
    {
      label: "Total tokens",
      value: tokens(totals, "totalTokens"),
      title: missingTitle(totals, "totalTokens"),
    },
    {
      label: "Cached input",
      value: tokens(totals, "cachedInputTokens"),
      hint: "Included in input",
      title: missingTitle(totals, "cachedInputTokens"),
    },
    {
      label: "Reasoning output",
      value: tokens(totals, "reasoningOutputTokens"),
      hint: "Included in output",
      title: missingTitle(totals, "reasoningOutputTokens"),
    },
    {
      label: "Estimated cost · USD",
      value: cost(totals),
      hint: `${number.format(totals.pricedAttempts)} of ${number.format(totals.attempts)} calls priced`,
    },
  ];
  return (
    <>
      <section
        aria-label="Period usage totals"
        className="space-y-4 border-y border-slate-200 py-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {dayLabel(data.query.from, true)}–
              {dayLabel(data.query.through, true)}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Inclusive dates · {data.query.timezone}
              {data.query.source
                ? ` · ${sourceLabel(data.query.source)}`
                : " · All sources"}
              {data.query.model ? ` · ${data.query.model}` : " · All models"}
            </p>
          </div>
          <InfoPopover label="How AI usage is counted">
            <p>
              API calls are individual recorded provider requests, including
              failures and pending requests. One assistant question can make
              several API calls.
            </p>
            <p>
              Cached input and reasoning output are subsets of input and output;
              they are not added again to total tokens. Missing usage is shown
              as unavailable or as a known subtotal.
            </p>
            <p>
              Costs are estimates for recorded, priced calls. Provider billing
              and activity outside FieldTrack are not included.
            </p>
          </InfoPopover>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-4">
          {metrics.map((item) => (
            <div key={item.label} className="min-w-28">
              <dt className="text-sm text-slate-600">{item.label}</dt>
              <dd
                className="mt-1 text-lg font-semibold tabular-nums text-slate-900"
                title={item.title}
              >
                {item.value}
              </dd>
              {item.hint && (
                <p className="mt-1 text-xs text-slate-600">{item.hint}</p>
              )}
            </div>
          ))}
        </dl>
        <div
          className={`rounded-lg p-3 text-sm leading-6 ${coverageWarning ? "bg-amber-50 text-amber-950" : "bg-slate-100 text-slate-700"}`}
          role="status"
        >
          <p>
            <strong className="font-semibold">Coverage: </strong>
            {number.format(totals.completeUsageAttempts)} complete ·{" "}
            {number.format(totals.partialUsageAttempts)} partial ·{" "}
            {number.format(totals.missingUsageAttempts)} missing usage records.{" "}
            {number.format(totals.pendingAttempts)} pending ·{" "}
            {number.format(totals.failedAttempts)} failed ·{" "}
            {number.format(totals.incompleteAttempts)} incomplete calls.
          </p>
          {totals.unpricedAttempts > 0 && (
            <p>
              {number.format(totals.unpricedAttempts)} calls have no price
              estimate; the estimated cost covers priced calls only.
            </p>
          )}
          {totals.invalidUsageAttempts > 0 && (
            <p>
              {number.format(totals.invalidUsageAttempts)} calls have invalid
              token usage; those token values are excluded.
            </p>
          )}
          <p>Recorded FieldTrack requests only. Invoice total: unavailable.</p>
        </div>
        {!totals.attempts && (
          <p className="text-sm text-slate-700">
            No API calls were recorded for these filters. Choose a different
            period, source or model to inspect other usage.
          </p>
        )}
      </section>
      <DailyChart data={data} metric={metric} onMetric={onMetric} />
      <section aria-labelledby="daily-usage-heading" className="space-y-3">
        <h2 id="daily-usage-heading" className="text-lg font-semibold">
          Daily usage
        </h2>
        <p className="text-sm text-slate-600">
          All {data.days.length} selected days. Known subtotals are labelled;
          missing values are not zero.
        </p>
        <UsageTable
          rows={data.days.map((day) => ({
            label: dayLabel(day.date, true),
            totals: day,
          }))}
          firstHeading="Day"
          label="Scrollable daily AI usage"
        />
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section
          aria-labelledby="model-usage-heading"
          className="min-w-0 space-y-3"
        >
          <h2 id="model-usage-heading" className="text-lg font-semibold">
            By model
          </h2>
          <UsageTable
            rows={data.byModel.map((row) => ({
              label: row.model ?? "Unknown model",
              totals: row,
            }))}
            firstHeading="Model"
            label="Scrollable AI usage by model"
            compactView
          />
        </section>
        <section
          aria-labelledby="source-usage-heading"
          className="min-w-0 space-y-3"
        >
          <h2 id="source-usage-heading" className="text-lg font-semibold">
            By source
          </h2>
          <UsageTable
            rows={data.bySource.map((row) => ({
              label: sourceLabel(row.source),
              totals: row,
            }))}
            firstHeading="Source"
            label="Scrollable AI usage by source"
            compactView
          />
        </section>
      </div>
      <PricingNote data={data} />
    </>
  );
}

function DailyChart({
  data,
  metric,
  onMetric,
}: {
  data: AiUsageResult;
  metric: Metric;
  onMetric: (metric: Metric) => void;
}) {
  const title =
    metric === "tokens"
      ? "Tokens"
      : metric === "cost"
        ? "Estimated cost"
        : "API calls";
  const chart = data.days.map((day) => ({
    date: day.date,
    day,
    value:
      metric === "calls"
        ? day.attempts
        : metric === "cost"
          ? day.estimatedUsdMax
          : (day.tokens.totalTokens ??
            (day.knownTokens.totalTokens > 0
              ? day.knownTokens.totalTokens
              : null)),
  }));
  return (
    <section aria-labelledby="usage-chart-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="usage-chart-heading" className="text-lg font-semibold">
          Usage over time
        </h2>
        <div
          role="group"
          aria-label="Daily chart metric"
          className="flex flex-wrap gap-2"
        >
          {(
            [
              ["tokens", "Tokens"],
              ["cost", "Estimated cost"],
              ["calls", "API calls"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={metric === value ? "default" : "outline"}
              aria-pressed={metric === value}
              onClick={() => onMetric(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <figure aria-describedby="usage-chart-description" className="min-w-0">
        <div className="h-72 min-w-0" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              data={chart}
              margin={{ top: 12, right: 8, bottom: 8, left: 0 }}
              accessibilityLayer={false}
            >
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(date: string) => dayLabel(date)}
                tickLine={false}
                axisLine={false}
                minTickGap={32}
                tick={{ fill: "#475569", fontSize: 12 }}
              />
              <YAxis
                width={64}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#475569", fontSize: 12 }}
                tickFormatter={(value: number) =>
                  metric === "cost" ? usd(value) : compact.format(value)
                }
                allowDecimals={metric === "cost"}
              />
              <Tooltip
                cursor={{ fill: "#eff6ff" }}
                content={({ active, payload }) => {
                  const day = active
                    ? (
                        payload?.[0]?.payload as
                          (typeof chart)[number] | undefined
                      )?.day
                    : undefined;
                  return day ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-900">
                      <p className="font-semibold">
                        {dayLabel(day.date, true)}
                      </p>
                      <p>{number.format(day.attempts)} API calls</p>
                      <p>{tokens(day, "totalTokens")} tokens</p>
                      <p>{cost(day)} estimated USD</p>
                      {day.missingUsageAttempts + day.partialUsageAttempts >
                        0 && (
                        <p className="text-amber-900">
                          Some token usage is missing.
                        </p>
                      )}
                      {day.unpricedAttempts > 0 && (
                        <p className="text-amber-900">
                          {day.unpricedAttempts} unpriced calls
                        </p>
                      )}
                    </div>
                  ) : null;
                }}
              />
              <Bar
                dataKey="value"
                name={title}
                fill="#2458e8"
                radius={[2, 2, 0, 0]}
                maxBarSize={40}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <figcaption
          id="usage-chart-description"
          className="mt-2 text-sm leading-6 text-slate-600"
        >
          {metric === "cost"
            ? "Daily estimated cost in USD uses the upper estimate. The tooltip and table show the full minimum–maximum range; unpriced calls are excluded."
            : metric === "tokens"
              ? "Daily total tokens. Incomplete days show only the known subtotal; days with no token usage available have no bar."
              : "Daily recorded API requests, including pending and failed requests."}{" "}
          The table below provides the same daily values.
        </figcaption>
      </figure>
    </section>
  );
}

function UsageTable({
  rows,
  firstHeading,
  label,
  compactView = false,
}: {
  rows: { label: string; totals: AiUsageTotals }[];
  firstHeading: string;
  label: string;
  compactView?: boolean;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="max-h-96 min-w-0 overflow-auto rounded-lg border border-slate-200 bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
    >
      <table className="w-full border-collapse text-left text-sm tabular-nums">
        <caption className="sr-only">{label}</caption>
        <thead className="sticky top-0 bg-slate-100 text-slate-700">
          <tr>
            {[
              firstHeading,
              "API calls",
              ...(!compactView
                ? ["Input", "Output", "Cached input", "Reasoning"]
                : []),
              "Total tokens",
              "Estimated USD",
              "Coverage",
            ].map((heading) => (
              <th
                key={heading}
                scope="col"
                className="whitespace-nowrap border-b border-slate-200 px-3 py-3 font-semibold"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!rows.length ? (
            <tr>
              <td colSpan={compactView ? 5 : 9} className="p-4 text-slate-600">
                No recorded calls for these filters.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-slate-200 last:border-0"
              >
                <th scope="row" className="min-w-36 px-3 py-3 font-medium">
                  {row.label}
                </th>
                <td className="px-3 py-3">
                  {number.format(row.totals.attempts)}
                </td>
                {!compactView &&
                  (
                    [
                      "inputTokens",
                      "outputTokens",
                      "cachedInputTokens",
                      "reasoningOutputTokens",
                    ] as const
                  ).map((field) => (
                    <td
                      key={field}
                      className="whitespace-nowrap px-3 py-3"
                      title={missingTitle(row.totals, field)}
                    >
                      {tokens(row.totals, field)}
                    </td>
                  ))}
                <td
                  className="whitespace-nowrap px-3 py-3"
                  title={missingTitle(row.totals, "totalTokens")}
                >
                  {tokens(row.totals, "totalTokens")}
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {cost(row.totals)}
                </td>
                <td className="min-w-44 px-3 py-3 text-xs leading-5 text-slate-600">
                  {row.totals.attempts
                    ? `${row.totals.completeUsageAttempts}/${row.totals.attempts} complete · ${row.totals.unpricedAttempts} unpriced · ${row.totals.pendingAttempts} pending`
                    : "No calls"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function PricingNote({ data }: { data: AiUsageResult }) {
  return (
    <footer className="space-y-2 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-600">
      <p>
        Public standard pricing snapshot: {dayLabel(data.pricing.asOf, true)} ·
        USD. Cached or incomplete usage can produce a minimum–maximum range.{" "}
        {data.pricing.note}
      </p>
      <p className="flex flex-wrap gap-x-4 gap-y-2">
        Public price sources:{" "}
        {data.pricing.sources.map((href, index) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm text-blue-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {[
              "Chat model pricing",
              "Transcription pricing",
              "Prompt caching pricing",
            ][index] ?? "Pricing documentation"}
          </a>
        ))}
      </p>
      <p>
        Last refreshed:{" "}
        {new Intl.DateTimeFormat("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: data.query.timezone,
        }).format(new Date(data.generatedAt))}{" "}
        · {data.query.timezone}
      </p>
    </footer>
  );
}
