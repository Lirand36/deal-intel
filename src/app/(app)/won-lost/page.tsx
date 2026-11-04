import { Bar, Kpi, Notice, PageHeader } from "@/components/ui";
import { weakestStrongBand } from "@/core/rubric";
import { pageData } from "@/lib/data";
import { money, num, pct } from "@/lib/format";

export default async function WonLostPage() {
  const data = await pageData();
  if (!data) return null;
  const { wonLost, currency } = data;
  const lowSample = wonLost.signals.some((s) => s.lowSample);
  const maxReason = Math.max(1, ...data.lossReasons.map((r) => r.count));

  return (
    <>
      <PageHeader
        title="Won vs lost"
        intro="What separated deals you won from deals you lost, measured at each deal's close date. Use it to check the rubric and see which habits actually move win rate."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Won" value={String(wonLost.wonCount)} />
        <Kpi label="Lost" value={String(wonLost.lostCount)} />
        <Kpi label="Avg score · won" value={num(wonLost.wonAvgScore, 0)} hint="at close" />
        <Kpi label="Avg score · lost" value={num(wonLost.lostAvgScore, 0)} hint="at close" />
      </section>

      {lowSample && (
        <div className="mt-4">
          <Notice>
            Fewer than 5 won or lost deals so far — treat these splits as early hints, not findings.
          </Notice>
        </div>
      )}

      <section className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="eyebrow border-b border-line text-left">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Signal</th>
              <th className="px-3 py-2.5 text-right font-semibold">Median · won</th>
              <th className="px-3 py-2.5 text-right font-semibold">Median · lost</th>
              <th className="w-64 px-5 py-2.5 font-semibold">Win rate when strong vs weak</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {wonLost.signals.map((s) => (
              <tr key={s.rule.key}>
                <td className="px-5 py-3">
                  <div className="font-medium">{s.rule.name}</div>
                  <div className="text-xs text-muted">
                    Strong = {weakestStrongBand(s.rule).label} or better
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-won">{num(s.wonMedian)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-lost">{num(s.lostMedian)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-14 text-muted">Strong</span>
                    <Bar value={s.strong.winRate ?? 0} max={1} tone="won" />
                    <span className="w-16 text-right tabular-nums">
                      {pct(s.strong.winRate)} <span className="text-muted">({s.strong.n})</span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs">
                    <span className="w-14 text-muted">Weak</span>
                    <Bar value={s.weak.winRate ?? 0} max={1} tone="lost" />
                    <span className="w-16 text-right tabular-nums">
                      {pct(s.weak.winRate)} <span className="text-muted">({s.weak.n})</span>
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="text-sm font-semibold">Why deals were lost</h2>
        {data.lossReasons.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No lost deals yet.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <tbody>
              {data.lossReasons.map((r) => (
                <tr key={r.reason}>
                  <td className="w-56 py-2 pr-3">{r.reason}</td>
                  <td className="py-2 pr-3">
                    <Bar value={r.count} max={maxReason} tone="lost" />
                  </td>
                  <td className="w-10 py-2 pr-3 text-right tabular-nums">{r.count}</td>
                  <td className="w-20 py-2 text-right tabular-nums text-muted">
                    {money(r.amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
