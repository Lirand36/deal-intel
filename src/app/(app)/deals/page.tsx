import Link from "next/link";
import { Flags, Notice, OutcomeBadge, PageHeader, TierBadge } from "@/components/ui";
import type { Outcome, ScoredDeal, Tier } from "@/core/types";
import { pageData } from "@/lib/data";
import { day, money } from "@/lib/format";

const OUTCOMES = ["all", "open", "won", "lost"] as const;
const TIERS = ["all", "healthy", "watch", "atRisk"] as const;
const SORTS = { score: "Health", amount: "Amount", close: "Close date" } as const;
type SortKey = keyof typeof SORTS;

const SORTERS: Record<SortKey, (a: ScoredDeal, b: ScoredDeal) => number> = {
  score: (a, b) => a.score - b.score,
  amount: (a, b) => (b.deal.amount ?? 0) - (a.deal.amount ?? 0),
  close: (a, b) =>
    (a.deal.closeDate?.getTime() ?? Infinity) - (b.deal.closeDate?.getTime() ?? Infinity),
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function FilterLink({
  current,
  params,
  label,
}: {
  current: boolean;
  params: Record<string, string>;
  label: string;
}) {
  return (
    <Link
      href={`/deals?${new URLSearchParams(params)}`}
      className={`rounded-md px-2.5 py-1 text-xs font-medium ${
        current ? "bg-accent text-on-accent" : "text-muted hover:bg-surface-alt hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await pageData();
  if (!data) return null;
  const sp = await searchParams;
  const outcome = oneOf<"all" | Outcome>(sp.outcome, OUTCOMES, "all");
  const tier = oneOf<"all" | Tier>(sp.tier, TIERS, "all");
  const sort = oneOf<SortKey>(sp.sort, Object.keys(SORTS) as SortKey[], "score");
  const query = typeof sp.q === "string" ? sp.q.trim().toLowerCase().slice(0, 100) : "";
  const params = { outcome, tier, sort, ...(query ? { q: query } : {}) };

  const deals = data.deals
    .filter((d) => outcome === "all" || d.deal.outcome === outcome)
    .filter((d) => tier === "all" || d.tier === tier)
    .filter((d) => !query || d.deal.name.toLowerCase().includes(query))
    .sort(SORTERS[sort]);

  return (
    <>
      <PageHeader
        title="Deals"
        intro="Every deal with its health score. Closed deals are scored as they stood on their close date."
      />

      <div className="card mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 p-3">
        <div className="flex gap-1">
          {OUTCOMES.map((o) => (
            <FilterLink
              key={o}
              current={o === outcome}
              params={{ ...params, outcome: o }}
              label={o === "all" ? "All" : o[0]?.toUpperCase() + o.slice(1)}
            />
          ))}
        </div>
        <div className="flex gap-1">
          {TIERS.map((t) => (
            <FilterLink
              key={t}
              current={t === tier}
              params={{ ...params, tier: t }}
              label={
                { all: "Any health", healthy: "Healthy", watch: "Watch", atRisk: "At risk" }[t]
              }
            />
          ))}
        </div>
        <form
          className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto"
          action="/deals"
        >
          <input type="hidden" name="outcome" value={outcome} />
          <input type="hidden" name="tier" value={tier} />
          <select
            name="sort"
            defaultValue={sort}
            className="input w-auto py-1.5 text-xs"
            aria-label="Sort by"
          >
            {Object.entries(SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                Sort: {label}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={query}
            placeholder="Search deals"
            className="input min-w-0 flex-1 py-1.5 text-xs sm:w-44 sm:flex-none"
          />
          <button type="submit" className="btn-ghost py-1.5 text-xs">
            Apply
          </button>
        </form>
      </div>

      {deals.length === 0 ? (
        <Notice>No deals match these filters.</Notice>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="eyebrow border-b border-line text-left">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Deal</th>
                <th className="px-3 py-2.5 font-semibold">Outcome</th>
                <th className="px-3 py-2.5 font-semibold">Health</th>
                <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-3 py-2.5 font-semibold">Close</th>
                <th className="px-5 py-2.5 font-semibold">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {deals.map((d) => (
                <tr key={d.deal.id} className="hover:bg-surface-alt">
                  <td className="px-5 py-2.5">
                    <Link href={`/deals/${d.deal.id}`} className="font-medium hover:text-accent">
                      {d.deal.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {data.stages.get(d.deal.stageId)?.label ?? d.deal.stageId}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <OutcomeBadge outcome={d.deal.outcome} />
                  </td>
                  <td className="px-3 py-2.5">
                    <TierBadge tier={d.tier} score={d.score} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {money(d.deal.amount, data.currency)}
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
    </>
  );
}
