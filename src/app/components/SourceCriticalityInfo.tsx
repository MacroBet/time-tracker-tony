import type { SourceProgrammePage } from "@/lib/programme-source";
import { InfoPopover } from "./InfoPopover";

export function SourceCriticalityInfo({
  metadata,
  loading,
}: {
  metadata?: SourceProgrammePage["criticality"];
  loading: boolean;
}) {
  const number = (value: number) => value.toLocaleString("en-GB");
  return (
    <div className="flex items-center gap-1">
      {metadata?.workingStale && (
        <span className="text-xs text-amber-900">
          P6 classification predates working changes
        </span>
      )}
      <InfoPopover label="About saved P6 criticality">
        <p className="font-medium text-slate-950">Saved P6 criticality</p>
        {loading ? (
          <p>Loading the source classification…</p>
        ) : !metadata ? (
          <p>
            No saved P6 classification is available. Missing information remains
            unknown.
          </p>
        ) : (
          <>
            <p>
              Red timeline bars identify activities classified critical by the
              saved P6 total-float rule. Step progress colours describe
              commissioning status separately.
            </p>
            {metadata.criteria.length ? (
              metadata.criteria.map((criterion, index) => (
                <div
                  key={`${criterion.projectId}:${index}`}
                  className="space-y-1"
                >
                  <p>
                    Source project {criterion.projectId || "not recorded"}:{" "}
                    {criterion.supported
                      ? `total float ≤ ${criterion.thresholdHours} source hours`
                      : `criterion unavailable (${criterion.pathType || "not recorded"})`}
                    .
                  </p>
                  {criterion.lastRecalculatedAt && (
                    <p>P6 calculation: {criterion.lastRecalculatedAt}</p>
                  )}
                </div>
              ))
            ) : (
              <p>
                No project criticality criterion was saved in the P6 source.
              </p>
            )}
            <p>
              Schedule coverage: {number(metadata.coverage.critical)} critical ·{" "}
              {number(metadata.coverage.nonCritical)} non-critical ·{" "}
              {number(metadata.coverage.unknown)} unknown, of{" "}
              {number(metadata.coverage.total)} activities.
            </p>
            <p>
              Current filters: {number(metadata.filteredCoverage.total)}{" "}
              activities, including {number(metadata.filteredCoverage.unknown)}{" "}
              unknown. Missing float or unsupported criteria are never treated
              as non-critical.
            </p>
            <p>
              {metadata.workingStale
                ? `Working revision ${metadata.workingRevision ?? "unknown"} contains date or link changes. The P6 classification has not been recalculated for these changes.`
                : "This classification reads the saved P6 source. Working dates and links do not recalculate criticality."}
            </p>
            <p className="break-all text-xs">
              Source {metadata.sourceSha256.slice(0, 12)}
            </p>
          </>
        )}
      </InfoPopover>
    </div>
  );
}
