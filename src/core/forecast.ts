import type { ScoredDeal } from "./types";

/** Forecast buckets for open deals, from HubSpot's stage probability. */
export type Category = "commit" | "bestCase" | "pipeline";

export const COMMIT_MIN_PROBABILITY = 0.8;
export const BEST_CASE_MIN_PROBABILITY = 0.5;
export const QUARTERS_AHEAD = 2;
const MOVERS_LIMIT = 8;

export interface Quarter {
  readonly year: number;
  /** 1–4 */
  readonly q: number;
  readonly key: string;
  readonly label: string;
  readonly start: Date;
  /** Exclusive. */
  readonly end: Date;
}

export function quarterOf(date: Date): Quarter {
  const year = date.getUTCFullYear();
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return {
    year,
    q,
    key: `${year}-Q${q}`,
    label: `Q${q} ${year}`,
    start: new Date(Date.UTC(year, (q - 1) * 3, 1)),
    end: new Date(Date.UTC(year, q * 3, 1)),
  };
}

/** The current quarter and the `ahead` quarters after it. */
export function upcomingQuarters(now: Date, ahead = QUARTERS_AHEAD): Quarter[] {
  const first = quarterOf(now);
  return Array.from({ length: ahead + 1 }, (_, i) =>
    quarterOf(new Date(Date.UTC(first.year, (first.q - 1 + i) * 3, 1))),
  );
}

export function categoryOf(probability: number): Category {
  if (probability >= COMMIT_MIN_PROBABILITY) return "commit";
  if (probability >= BEST_CASE_MIN_PROBABILITY) return "bestCase";
  return "pipeline";
}

function inQuarter(date: Date | null, quarter: Quarter): boolean {
  return date !== null && date >= quarter.start && date < quarter.end;
}

/**
 * Open deals whose close date has already passed are counted in the current quarter: the rep
 * still has to close or move them, and leaving them out would hide slipped pipeline.
 */
function openDealsFor(deals: readonly ScoredDeal[], quarter: Quarter, current: Quarter) {
  return deals.filter(
    (d) =>
      d.deal.outcome === "open" &&
      (inQuarter(d.deal.closeDate, quarter) ||
        (quarter.key === current.key &&
          d.deal.closeDate !== null &&
          d.deal.closeDate < current.start)),
  );
}

const amountOf = (list: readonly ScoredDeal[]) =>
  list.reduce((s, d) => s + (d.deal.amount ?? 0), 0);

export interface QuarterForecast {
  readonly quarter: Quarter;
  readonly isCurrent: boolean;
  readonly closedWon: number;
  readonly closedLost: number;
  readonly commit: number;
  readonly bestCase: number;
  readonly pipeline: number;
  /** Open amount weighted by stage probability. */
  readonly weighted: number;
  /** Closed won plus commit: the number leadership can count on. */
  readonly floor: number;
  /** Floor plus best case: what happens if the likely deals land too. */
  readonly upside: number;
  /** Commit deals whose health is "at risk": the part of the floor that may not hold. */
  readonly commitAtRisk: number;
  /** Open deals past their close date (current quarter only). */
  readonly overdue: { readonly count: number; readonly amount: number };
  readonly openCount: number;
  /** Biggest open deals that decide the quarter, commit and best case first. */
  readonly movers: readonly ScoredDeal[];
}

const CATEGORY_RANK: Record<Category, number> = { commit: 0, bestCase: 1, pipeline: 2 };

export function forecastQuarter(
  deals: readonly ScoredDeal[],
  quarter: Quarter,
  now: Date,
): QuarterForecast {
  const current = quarterOf(now);
  const open = openDealsFor(deals, quarter, current);
  const byCategory = (c: Category) => open.filter((d) => categoryOf(d.deal.probability) === c);
  const closed = (outcome: "won" | "lost") =>
    amountOf(
      deals.filter((d) => d.deal.outcome === outcome && inQuarter(d.deal.closeDate, quarter)),
    );
  const overdue = open.filter((d) => d.deal.closeDate !== null && d.deal.closeDate < now);
  const closedWon = closed("won");
  const commit = amountOf(byCategory("commit"));
  const bestCase = amountOf(byCategory("bestCase"));
  return {
    quarter,
    isCurrent: quarter.key === current.key,
    closedWon,
    closedLost: closed("lost"),
    commit,
    bestCase,
    pipeline: amountOf(byCategory("pipeline")),
    weighted: open.reduce((s, d) => s + (d.deal.amount ?? 0) * d.deal.probability, 0),
    floor: closedWon + commit,
    upside: closedWon + commit + bestCase,
    commitAtRisk: amountOf(byCategory("commit").filter((d) => d.tier === "atRisk")),
    overdue: { count: overdue.length, amount: amountOf(overdue) },
    openCount: open.length,
    movers: [...open]
      .sort(
        (a, b) =>
          CATEGORY_RANK[categoryOf(a.deal.probability)] -
            CATEGORY_RANK[categoryOf(b.deal.probability)] ||
          (b.deal.amount ?? 0) - (a.deal.amount ?? 0),
      )
      .slice(0, MOVERS_LIMIT),
  };
}

export function forecast(deals: readonly ScoredDeal[], now: Date): QuarterForecast[] {
  return upcomingQuarters(now).map((quarter) => forecastQuarter(deals, quarter, now));
}
