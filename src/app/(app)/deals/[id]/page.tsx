import Link from "next/link";
import { notFound } from "next/navigation";
import { Bar, Flags, OutcomeBadge, TierBadge } from "@/components/ui";
import { bandFor, RUBRIC } from "@/core/rubric";
import { pageData } from "@/lib/data";
import { day, money } from "@/lib/format";

const TIMELINE_LIMIT = 15;

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await pageData();
  if (!data) return null;
  const { id } = await params;
  const scored = data.deals.find((d) => d.deal.id === id);
  if (!scored) notFound();
  const { deal } = scored;
  const timeline = [...deal.activities]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, TIMELINE_LIMIT);

  return (
    <>
      <Link href="/deals" className="text-xs text-muted hover:text-ink">
        ← All deals
      </Link>
      <header className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{deal.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <OutcomeBadge outcome={deal.outcome} />
            <span>{data.stages.get(deal.stageId)?.label ?? deal.stageId}</span>
            <span>·</span>
            <span className="tabular-nums">{money(deal.amount, data.currency)}</span>
            <span>·</span>
            <span>Close {day(deal.closeDate)}</span>
          </div>
        </div>
        {!data.demo && (
          <a href={deal.url} target="_blank" rel="noreferrer" className="btn-ghost text-xs">
            Open in HubSpot ↗
          </a>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Score breakdown</h2>
            <TierBadge tier={scored.tier} score={scored.score} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {deal.outcome === "open"
              ? "As of today."
              : `As of the close date, ${day(scored.asOf)}.`}
          </p>
          <ul className="mt-4 space-y-4">
            {RUBRIC.map((rule) => {
              const points = scored.points[rule.key];
              return (
                <li key={rule.key}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{rule.name}</span>
                    <span className="tabular-nums text-muted">
                      {points}/{rule.max}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Bar value={points} max={rule.max} />
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {bandFor(rule, scored.signals[rule.key]).label}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="text-sm font-semibold">Flags</h2>
            <div className="mt-3">
              {deal.outcome === "open" ? (
                <Flags flags={scored.flags} />
              ) : (
                <p className="text-xs text-muted">Risk flags apply to open deals only.</p>
              )}
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Next step</dt>
                <dd className="text-right">{deal.nextStep ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Age</dt>
                <dd>{scored.ageDays} days</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Contacts</dt>
                <dd>{deal.contactCount}</dd>
              </div>
              {deal.lostReason && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Lost reason</dt>
                  <dd className="text-right">{deal.lostReason}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            {timeline.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No logged activity.</p>
            ) : (
              <ol className="mt-3 space-y-2 text-sm">
                {timeline.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3">
                    <span className="capitalize">{a.type}</span>
                    <span className="text-muted">{day(a.at)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
