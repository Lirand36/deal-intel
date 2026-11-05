import { Bar, Notice, PageHeader } from "@/components/ui";
import { winRate } from "@/core/analysis";
import { GRADE_LABELS, type Grade, type WinFactor } from "@/core/winFactors";
import { pageData } from "@/lib/data";
import { money, pct } from "@/lib/format";

const GRADE_STYLE: Record<Grade, string> = {
  big: "bg-accent text-on-accent",
  clear: "bg-accent-soft text-accent",
  small: "bg-surface-alt text-ink",
  none: "bg-surface-alt text-muted",
  unknown: "border border-line text-muted",
};

/** "Deals that held 2+ meetings won 91%. Those that held fewer won 18%." */
function sentence(f: WinFactor): string {
  return `Deals that ${f.withIt.phrase} won ${pct(f.withIt.winRate)}. Those that ${f.without.phrase} won ${pct(f.without.winRate)}.`;
}

export default async function WonLostPage() {
  const data = await pageData();
  if (!data) return null;
  const { wonLost, currency } = data;
  const graded = data.winFactors.filter((f) => f.grade !== "unknown");
  const unknown = data.winFactors.filter((f) => f.grade === "unknown");
  const maxReason = Math.max(1, ...data.lossReasons.map((r) => r.count));

  return (
    <>
      <PageHeader
        title="Won vs lost"
        intro={`${wonLost.wonCount} won, ${wonLost.lostCount} lost · win rate ${pct(winRate(data.deals))}`}
      />

      <section>
        <h2 className="text-lg font-bold">What wins deals here</h2>
        {graded.length === 0 ? (
          <div className="mt-3">
            <Notice>Not enough closed deals yet to compare.</Notice>
          </div>
        ) : (
          <ul className="card mt-3 divide-y divide-line overflow-hidden">
            {graded.map((f) => (
              <li key={f.key} className="flex items-start gap-4 px-5 py-4">
                <span
                  className={`mt-0.5 w-32 shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-medium ${GRADE_STYLE[f.grade]}`}
                >
                  {GRADE_LABELS[f.grade]}
                </span>
                <p>{sentence(f)}</p>
              </li>
            ))}
          </ul>
        )}
        {unknown.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Not enough data yet on:{" "}
            {unknown.map((f) => f.withIt.phrase.replace(/^had /, "")).join(", ")}.
          </p>
        )}
      </section>

      <section className="card mt-8 p-5">
        <h2 className="font-bold">Why deals were lost</h2>
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

      <p className="mt-6 text-xs text-muted">
        How it's graded: the gap between the two win rates. 40+ points is a big difference, 20+
        clear, 10+ small. Closed deals are judged as they stood on their close date.
      </p>
    </>
  );
}
