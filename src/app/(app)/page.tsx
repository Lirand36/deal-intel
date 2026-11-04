import Link from "next/link";
import { QuarterRail, railTotal } from "@/components/QuarterRail";
import { Flags, Notice, TierBadge } from "@/components/ui";
import { type Category, categoryOf, type QuarterForecast } from "@/core/forecast";
import { pageData } from "@/lib/data";
import { day, money } from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORY_STYLE: Record<Category, { label: string; className: string }> = {
  commit: { label: "Commit", className: "bg-accent-soft text-accent" },
  bestCase: { label: "Best case", className: "bg-surface-alt text-ink" },
  pipeline: { label: "Pipeline", className: "border border-line text-muted" },
};

function daysLeft(f: QuarterForecast, now: Date): number {
  return Math.max(0, Math.ceil((f.quarter.end.getTime() - now.getTime()) / DAY_MS));
}

function Callout({
  tone,
  title,
  detail,
  href,
}: {
  tone: "warn" | "bad";
  title: string;
  detail: string;
  href: string;
}) {
  const style = tone === "bad" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn";
  return (
    <Link
      href={href}
      className={`block rounded-2xl px-4 py-3 transition hover:opacity-85 ${style}`}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-0.5 text-xs opacity-90">{detail}</div>
    </Link>
  );
}

export default async function QuarterPage() {
  const data = await pageData();
  if (!data) return null;
  const { currency } = data;
  const [current, ...later] = data.quarters;
  if (!current) return null;
  const now = data.fetchedAt;
  const scale = Math.max(...data.quarters.map(railTotal));

  return (
    <>
      <header className="mb-7">
        <p className="text-sm font-medium text-accent">
          {current.quarter.label} · {daysLeft(current, now)} days left
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Quarter forecast</h1>
      </header>

      <section className="card p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-sm text-muted">Forecast floor · closed won + commit</div>
            <div className="mt-1 text-5xl font-bold tracking-tight tabular-nums">
              {money(current.floor, currency)}
            </div>
            <div className="mt-2 text-sm text-muted">
              Upside with best case{" "}
              <span className="font-semibold text-ink tabular-nums">
                {money(current.upside, currency)}
              </span>
              {" · "}weighted open{" "}
              <span className="font-semibold text-ink tabular-nums">
                {money(current.weighted, currency)}
              </span>
            </div>
          </div>
          <div className="grid w-full gap-2 sm:w-72">
            {current.commitAtRisk > 0 && (
              <Callout
                tone="bad"
                title={`${money(current.commitAtRisk, currency)} of commit is at risk`}
                detail="Commit deals with weak engagement"
                href="/deals?outcome=open&tier=atRisk"
              />
            )}
            {current.overdue.count > 0 && (
              <Callout
                tone="warn"
                title={`${current.overdue.count} deals past their close date`}
                detail={`${money(current.overdue.amount, currency)} to close or move`}
                href="/deals?outcome=open&sort=close"
              />
            )}
          </div>
        </div>
        <div className="mt-8">
          <QuarterRail forecast={current} scale={scale} currency={currency} />
        </div>
      </section>

      <section className="mt-5 grid gap-5 md:grid-cols-2">
        {later.map((f) => (
          <div key={f.quarter.key} className="card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{f.quarter.label}</h2>
              <span className="text-xs text-muted">{f.openCount} open deals</span>
            </div>
            <div className="mt-3 flex items-baseline gap-4">
              <div>
                <div className="text-2xl font-bold tabular-nums">{money(f.weighted, currency)}</div>
                <div className="text-xs text-muted">weighted pipeline</div>
              </div>
              <div>
                <div className="text-lg font-semibold tabular-nums text-muted">
                  {money(f.upside, currency)}
                </div>
                <div className="text-xs text-muted">commit + best case</div>
              </div>
            </div>
            <div className="mt-4">
              <QuarterRail
                forecast={f}
                scale={scale}
                currency={currency}
                showLegend={false}
                size="sm"
              />
            </div>
          </div>
        ))}
      </section>

      <section className="card mt-5 overflow-hidden">
        <div className="px-6 pt-5">
          <h2 className="font-semibold">Deals that decide {current.quarter.label}</h2>
          <p className="mt-0.5 text-sm text-muted">Commit first, then the largest deals.</p>
        </div>
        {current.movers.length === 0 ? (
          <div className="p-6">
            <Notice>No open deals close this quarter.</Notice>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[720px] text-sm">
              <thead className="border-b border-line text-left text-xs text-muted">
                <tr>
                  <th className="px-6 py-2 font-medium">Deal</th>
                  <th className="px-3 py-2 font-medium">Forecast</th>
                  <th className="px-3 py-2 font-medium">Health</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Close</th>
                  <th className="px-6 py-2 font-medium">Watch out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {current.movers.map((d) => {
                  const category = CATEGORY_STYLE[categoryOf(d.deal.probability)];
                  return (
                    <tr key={d.deal.id} className="hover:bg-surface-alt/60">
                      <td className="px-6 py-3">
                        <Link
                          href={`/deals/${d.deal.id}`}
                          className="font-medium hover:text-accent"
                        >
                          {d.deal.name}
                        </Link>
                        <div className="text-xs text-muted">
                          {data.stages.get(d.deal.stageId)?.label}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${category.className}`}
                        >
                          {category.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <TierBadge tier={d.tier} score={d.score} />
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {money(d.deal.amount, currency)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted">
                        {day(d.deal.closeDate)}
                      </td>
                      <td className="px-6 py-3">
                        <Flags flags={d.flags} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
