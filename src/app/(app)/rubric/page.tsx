import { PageHeader, TierBadge } from "@/components/ui";
import { RECENT_WINDOW_DAYS, RUBRIC, TIER_THRESHOLDS } from "@/core/rubric";
import { requireSession } from "@/lib/auth";

export default async function RubricPage() {
  await requireSession();
  return (
    <>
      <PageHeader
        title="Scoring rubric"
        intro={`Each deal earns up to 100 points from six signals read from HubSpot activity. Activity counts use the ${RECENT_WINDOW_DAYS} days before the as-of date: today for open deals, the close date for closed ones.`}
      />

      <div className="card mb-6 flex flex-wrap items-center gap-4 p-4 text-sm">
        <TierBadge tier="healthy" /> <span className="text-muted">{TIER_THRESHOLDS.healthy}+</span>
        <TierBadge tier="watch" />
        <span className="text-muted">
          {TIER_THRESHOLDS.watch}–{TIER_THRESHOLDS.healthy - 1}
        </span>
        <TierBadge tier="atRisk" />{" "}
        <span className="text-muted">below {TIER_THRESHOLDS.watch}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {RUBRIC.map((rule) => (
          <section key={rule.key} className="card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{rule.name}</h2>
              <span className="text-xs text-muted">up to {rule.max} pts</span>
            </div>
            <p className="mt-1 text-sm text-muted">{rule.why}</p>
            <ul className="mt-3 divide-y divide-line text-sm">
              {rule.bands.map((band) => (
                <li key={band.label} className="flex justify-between py-1.5">
                  <span>{band.label}</span>
                  <span className="tabular-nums font-medium">{band.points}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
