import Link from "next/link";
import { QuarterRail } from "@/components/QuarterRail";
import { Notice } from "@/components/ui";
import { bestAction } from "@/core/actions";
import { type QuarterForecast, type Verdict, verdictFor } from "@/core/forecast";
import { pageData } from "@/lib/data";
import { day, money } from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;
const DECIDING_DEALS = 3;

function headline(label: string, verdict: Verdict | null): string {
  if (!verdict) return `${label} forecast`;
  if (verdict.status === "onTrack") return `On track for ${label}`;
  if (verdict.status === "needsBestCase") return `${label} needs its best-case deals`;
  return `${label} misses quota even with best case`;
}

function Figure({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <div className="text-sm text-muted">{label}</div>
      <div
        className={`mt-1 font-bold tabular-nums tracking-tight ${strong ? "text-4xl" : "text-2xl"}`}
      >
        {value}
      </div>
    </div>
  );
}

function coverage(f: QuarterForecast, quota: number): string {
  return `${((f.commit + f.bestCase + f.pipeline) / quota).toFixed(1)}×`;
}

export default async function QuarterPage() {
  const data = await pageData();
  if (!data) return null;
  const { currency, quota } = data;
  const [current, next] = data.quarters;
  if (!current) return null;
  const verdict = quota === null ? null : verdictFor(current, quota);
  const daysLeft = Math.max(
    0,
    Math.ceil((current.quarter.end.getTime() - data.fetchedAt.getTime()) / DAY_MS),
  );
  const deciding = current.movers.slice(0, DECIDING_DEALS);

  return (
    <>
      <p className="text-sm text-muted">
        {current.quarter.label} · {daysLeft} days left
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
        {headline(current.quarter.label, verdict)}
      </h1>

      <section className="card mt-6 p-6 md:p-8">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
          <Figure label="Forecast · won + commit" value={money(current.floor, currency)} strong />
          {verdict ? (
            <>
              <Figure label="Quota" value={money(verdict.quota, currency)} />
              <Figure
                label={verdict.gap > 0 ? "Gap to quota" : "Ahead of quota"}
                value={money(Math.abs(verdict.gap), currency)}
              />
            </>
          ) : (
            <Figure label="With best case" value={money(current.upside, currency)} />
          )}
        </div>
        <div className="mt-7">
          <QuarterRail
            forecast={current}
            scale={Math.max(current.upside + current.pipeline, quota ?? 0)}
            currency={currency}
          />
        </div>
        {!verdict && (
          <div className="mt-6">
            <Notice>Set QUARTER_QUOTA in Render to see the gap to target.</Notice>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">The {deciding.length} deals that decide it</h2>
        {deciding.length === 0 ? (
          <div className="mt-3">
            <Notice>No open deals close this quarter.</Notice>
          </div>
        ) : (
          <ol className="card mt-3 divide-y divide-line overflow-hidden">
            {deciding.map((d) => {
              const action = bestAction(d, data.fetchedAt);
              return (
                <li key={d.deal.id}>
                  <Link
                    href={`/deals/${d.deal.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4 transition hover:bg-surface-alt"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold">{d.deal.name}</div>
                      <div className="text-sm text-muted">
                        {action ? action.play.title : "On track: keep the next step moving"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold tabular-nums">{money(d.deal.amount, currency)}</div>
                      <div className="text-xs text-muted">closes {day(d.deal.closeDate)}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {next && (
        <p className="mt-8 text-sm text-muted">
          {next.quarter.label}: {money(next.weighted, currency)} weighted pipeline
          {quota !== null && ` · ${coverage(next, quota)} coverage of quota`}
        </p>
      )}
    </>
  );
}
