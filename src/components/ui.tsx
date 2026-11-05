import { FLAG_LABELS } from "@/core/score";
import { tierWord } from "@/core/story";
import type { Outcome, RiskFlag, ScoredDeal, Tier } from "@/core/types";

export function PageHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{intro}</p>
    </header>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

const TIER_STYLE: Record<Tier, string> = {
  healthy: "bg-good-soft text-good",
  watch: "bg-warn-soft text-warn",
  atRisk: "bg-bad-soft text-bad",
};

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TIER_STYLE[tier]}`}
    >
      {tierWord(tier)}
    </span>
  );
}

/** Health only means something for open deals; closed ones show their outcome instead. */
export function HealthCell({ deal }: { deal: ScoredDeal }) {
  return deal.deal.outcome === "open" ? (
    <TierBadge tier={deal.tier} />
  ) : (
    <span className="text-xs text-muted">—</span>
  );
}

const OUTCOME_STYLE: Record<Outcome, string> = {
  won: "bg-good-soft text-good",
  lost: "bg-bad-soft text-bad",
  open: "bg-accent-soft text-accent",
};

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${OUTCOME_STYLE[outcome]}`}
    >
      {outcome}
    </span>
  );
}

export function Flags({ flags }: { flags: readonly RiskFlag[] }) {
  if (flags.length === 0) return <span className="text-xs text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((flag) => (
        <span
          key={flag}
          className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted"
        >
          {FLAG_LABELS[flag]}
        </span>
      ))}
    </div>
  );
}

/** A horizontal bar; `value` and `max` share a unit. */
export function Bar({
  value,
  max,
  tone = "accent",
}: {
  value: number;
  max: number;
  tone?: "accent" | "won" | "lost";
}) {
  const width = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color = { accent: "bg-accent", won: "bg-won", lost: "bg-lost" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-alt">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "bad";
  children: React.ReactNode;
}) {
  const style =
    tone === "bad" ? "border-bad/30 bg-bad-soft text-bad" : "border-line bg-surface-alt text-muted";
  return <div className={`rounded-lg border px-4 py-3 text-sm ${style}`}>{children}</div>;
}
