import Link from "next/link";
import { Bar, Flags, Kpi, Notice, PageHeader, TierBadge } from "@/components/ui";
import { pageData } from "@/lib/data";
import { day, money, num, pct } from "@/lib/format";

const AT_RISK_LIMIT = 8;

export default async function PipelineHealthPage() {
  const data = await pageData();
  if (!data) return null;
  const { summary, currency } = data;
  const open = data.deals.filter((d) => d.deal.outcome === "open");
  const atRisk = [...open]
    .filter((d) => d.tier !== "healthy")
    .sort((a, b) => a.score - b.score || (b.deal.amount ?? 0) - (a.deal.amount ?? 0))
    .slice(0, AT_RISK_LIMIT);
  const maxStageAmount = Math.max(1, ...summary.stages.map((s) => s.amount));
  const tierTotal = Math.max(1, summary.openCount);

  return (
    <>
      <PageHeader
        title="Pipeline health"
        intro="Every open deal scored 0–100 on buyer engagement signals pulled live from HubSpot. Scores update when you refresh."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Open pipeline"
          value={money(summary.openAmount, currency)}
          hint={`${summary.openCount} deals`}
        />
        <Kpi
          label="Weighted"
          value={money(summary.weightedAmount, currency)}
          hint="by stage probability"
        />
        <Kpi
          label="Win rate"
          value={pct(summary.winRate)}
          hint={`${summary.wonCount} won · ${summary.lostCount} lost`}
        />
        <Kpi
          label="Won deal size"
          value={money(summary.avgWonAmount, currency)}
          hint={`median cycle ${num(summary.medianWonCycleDays, 0)} days`}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold">Open pipeline by stage</h2>
          {summary.stages.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No open stages.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <tbody>
                {summary.stages.map((row) => (
                  <tr key={row.stage.id} className="align-middle">
                    <td className="w-40 py-2 pr-3 text-muted">{row.stage.label}</td>
                    <td className="py-2 pr-3">
                      <Bar value={row.amount} max={maxStageAmount} />
                    </td>
                    <td className="w-10 py-2 pr-3 text-right tabular-nums text-muted">
                      {row.count}
                    </td>
                    <td className="w-20 py-2 text-right font-medium tabular-nums">
                      {money(row.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Health of open deals</h2>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-surface-alt">
            <div
              className="bg-good"
              style={{ width: `${(summary.tiers.healthy / tierTotal) * 100}%` }}
            />
            <div
              className="bg-warn"
              style={{ width: `${(summary.tiers.watch / tierTotal) * 100}%` }}
            />
            <div
              className="bg-bad"
              style={{ width: `${(summary.tiers.atRisk / tierTotal) * 100}%` }}
            />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            {(["healthy", "watch", "atRisk"] as const).map((tier) => (
              <div key={tier} className="flex items-center justify-between">
                <dt>
                  <TierBadge tier={tier} />
                </dt>
                <dd className="tabular-nums">{summary.tiers[tier]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="card mt-6 overflow-hidden">
        <div className="flex items-baseline justify-between px-5 pt-5">
          <h2 className="text-sm font-semibold">Deals that need attention</h2>
          <Link href="/deals?outcome=open" className="text-xs text-accent hover:underline">
            All open deals →
          </Link>
        </div>
        {atRisk.length === 0 ? (
          <div className="p-5">
            <Notice>No open deals below the healthy line.</Notice>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[640px] text-sm">
              <thead className="eyebrow border-b border-line text-left">
                <tr>
                  <th className="px-5 py-2 font-semibold">Deal</th>
                  <th className="px-3 py-2 font-semibold">Health</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Close</th>
                  <th className="px-5 py-2 font-semibold">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {atRisk.map((d) => (
                  <tr key={d.deal.id} className="hover:bg-surface-alt">
                    <td className="px-5 py-2.5">
                      <Link href={`/deals/${d.deal.id}`} className="font-medium hover:text-accent">
                        {d.deal.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {data.stages.get(d.deal.stageId)?.label}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <TierBadge tier={d.tier} score={d.score} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {money(d.deal.amount, currency)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted">
                      {day(d.deal.closeDate)}
                    </td>
                    <td className="px-5 py-2.5">
                      <Flags flags={d.flags} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
