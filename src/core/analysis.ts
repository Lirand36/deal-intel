import { isStrong, RUBRIC, type SignalRule } from "./rubric";
import type { ScoredDeal, Stage, Tier } from "./types";

export const MIN_SAMPLE = 5;

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((s, v) => s + v, 0) / values.length;
}

function sumAmount(deals: readonly ScoredDeal[]): number {
  return deals.reduce((s, d) => s + (d.deal.amount ?? 0), 0);
}

/** Share of won deals among closed ones, or null when nothing has closed. */
export function winRate(deals: readonly ScoredDeal[]): number | null {
  const closed = deals.filter((d) => d.deal.outcome !== "open");
  if (closed.length === 0) return null;
  return closed.filter((d) => d.deal.outcome === "won").length / closed.length;
}

export interface StageRow {
  readonly stage: Stage;
  readonly count: number;
  readonly amount: number;
  readonly weighted: number;
}

export interface Summary {
  readonly openCount: number;
  readonly openAmount: number;
  readonly weightedAmount: number;
  readonly wonCount: number;
  readonly lostCount: number;
  readonly winRate: number | null;
  readonly avgWonAmount: number | null;
  readonly medianWonCycleDays: number | null;
  readonly tiers: Readonly<Record<Tier, number>>;
  readonly stages: readonly StageRow[];
}

export function summarize(deals: readonly ScoredDeal[], stages: readonly Stage[]): Summary {
  const open = deals.filter((d) => d.deal.outcome === "open");
  const won = deals.filter((d) => d.deal.outcome === "won");
  const weightedOf = (list: readonly ScoredDeal[]) =>
    list.reduce((s, d) => s + (d.deal.amount ?? 0) * d.deal.probability, 0);
  const openStages = [...stages]
    .filter((stage) => stage.probability > 0 && stage.probability < 1)
    .sort((a, b) => a.order - b.order);
  return {
    openCount: open.length,
    openAmount: sumAmount(open),
    weightedAmount: weightedOf(open),
    wonCount: won.length,
    lostCount: deals.filter((d) => d.deal.outcome === "lost").length,
    winRate: winRate(deals),
    avgWonAmount: won.length > 0 ? sumAmount(won) / won.length : null,
    medianWonCycleDays: median(won.map((d) => d.ageDays)),
    tiers: {
      healthy: open.filter((d) => d.tier === "healthy").length,
      watch: open.filter((d) => d.tier === "watch").length,
      atRisk: open.filter((d) => d.tier === "atRisk").length,
    },
    stages: openStages.map((stage) => {
      const inStage = open.filter((d) => d.deal.stageId === stage.id);
      return {
        stage,
        count: inStage.length,
        amount: sumAmount(inStage),
        weighted: weightedOf(inStage),
      };
    }),
  };
}

export interface SignalComparison {
  readonly rule: SignalRule;
  readonly wonMedian: number | null;
  readonly lostMedian: number | null;
  readonly strong: { readonly n: number; readonly winRate: number | null };
  readonly weak: { readonly n: number; readonly winRate: number | null };
  /** Too few closed deals on one side to trust the split. */
  readonly lowSample: boolean;
}

export interface WonLost {
  readonly wonCount: number;
  readonly lostCount: number;
  readonly wonAvgScore: number | null;
  readonly lostAvgScore: number | null;
  readonly signals: readonly SignalComparison[];
}

export function compareWonLost(deals: readonly ScoredDeal[]): WonLost {
  const won = deals.filter((d) => d.deal.outcome === "won");
  const lost = deals.filter((d) => d.deal.outcome === "lost");
  const closed = [...won, ...lost];
  return {
    wonCount: won.length,
    lostCount: lost.length,
    wonAvgScore: mean(won.map((d) => d.score)),
    lostAvgScore: mean(lost.map((d) => d.score)),
    signals: RUBRIC.map((rule) => {
      const strong = closed.filter((d) => isStrong(rule, d.points[rule.key]));
      const weak = closed.filter((d) => !isStrong(rule, d.points[rule.key]));
      return {
        rule,
        wonMedian: median(won.map((d) => d.signals[rule.key])),
        lostMedian: median(lost.map((d) => d.signals[rule.key])),
        strong: { n: strong.length, winRate: winRate(strong) },
        weak: { n: weak.length, winRate: winRate(weak) },
        lowSample: won.length < MIN_SAMPLE || lost.length < MIN_SAMPLE,
      };
    }),
  };
}

export interface LossReason {
  readonly reason: string;
  readonly count: number;
  readonly amount: number;
}

export const UNKNOWN_REASON = "No reason given";

export function lossReasons(deals: readonly ScoredDeal[]): LossReason[] {
  const groups = new Map<string, ScoredDeal[]>();
  for (const d of deals.filter((x) => x.deal.outcome === "lost")) {
    const reason = d.deal.lostReason?.trim() || UNKNOWN_REASON;
    groups.set(reason, [...(groups.get(reason) ?? []), d]);
  }
  return [...groups.entries()]
    .map(([reason, list]) => ({ reason, count: list.length, amount: sumAmount(list) }))
    .sort((a, b) => b.count - a.count || b.amount - a.amount);
}
