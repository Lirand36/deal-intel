import type { QuarterForecast } from "@/core/forecast";
import { money } from "@/lib/format";

const SEGMENTS = [
  { key: "closedWon", label: "Closed won", className: "bg-cat-closed" },
  { key: "commit", label: "Commit", className: "bg-cat-commit" },
  { key: "bestCase", label: "Best case", className: "bg-cat-best" },
  { key: "pipeline", label: "Pipeline", className: "bg-cat-pipeline" },
] as const;

export function railTotal(f: QuarterForecast): number {
  return f.closedWon + f.commit + f.bestCase + f.pipeline;
}

type Props = {
  forecast: QuarterForecast;
  /** Shared scale so several quarters' rails can be compared. */
  scale: number;
  currency: string;
  showLegend?: boolean;
  size?: "lg" | "sm";
};

/** Closed → commit → best case → pipeline as one bar, darkest is most certain. */
export function QuarterRail({ forecast, scale, currency, showLegend = true, size = "lg" }: Props) {
  const height = size === "lg" ? "h-5" : "h-2.5";
  return (
    <div>
      <div
        className={`flex ${height} w-full gap-0.5 overflow-hidden rounded-full bg-surface-alt`}
        role="img"
        aria-label={SEGMENTS.map((s) => `${s.label} ${money(forecast[s.key], currency)}`).join(
          ", ",
        )}
      >
        {SEGMENTS.map((s) =>
          forecast[s.key] > 0 ? (
            <div
              key={s.key}
              className={`${s.className} first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${(forecast[s.key] / Math.max(1, scale)) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      {showLegend && (
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          {SEGMENTS.map((s) => (
            <div key={s.key}>
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <span className={`h-2 w-2 rounded-full ${s.className}`} aria-hidden="true" />
                {s.label}
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {money(forecast[s.key], currency)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
