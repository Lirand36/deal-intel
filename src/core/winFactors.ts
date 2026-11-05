/**
 * What separates won deals from lost ones, as plain graded sentences: "Deals with 2+ people won
 * 73%. Deals with one won 14%." Each factor splits closed deals in two and compares win rates.
 */
import { winRate } from "./analysis";
import { mentionsIn, type Topic } from "./conversation";
import { isStrong, RUBRIC } from "./rubric";
import type { ScoredDeal, SignalKey } from "./types";

export type Grade = "big" | "clear" | "small" | "none" | "unknown";

export const GRADE_LABELS: Readonly<Record<Grade, string>> = {
  big: "Big difference",
  clear: "Clear difference",
  small: "Small difference",
  none: "No real difference",
  unknown: "Not enough data",
};

/** Win-rate gaps (in share points) for each grade. */
const GRADE_CUTS = { big: 0.4, clear: 0.2, small: 0.1 } as const;
const MIN_SIDE = 2;

interface Factor {
  readonly key: string;
  /** "Deals that … won X%." for the deals that have it. */
  readonly withIt: string;
  /** Same, for the deals that don't. */
  readonly without: string;
  readonly has: (d: ScoredDeal) => boolean;
}

const RUBRIC_PHRASES: Readonly<Record<SignalKey, readonly [string, string]>> = {
  contacts: ["had 2+ people involved", "had one person or none"],
  recentActivity: ["had 3+ touches in their last month", "had fewer touches"],
  meetings: ["held 2+ meetings", "held fewer"],
  daysSinceActivity: ["were touched in the 2 weeks before closing", "went quiet for 2+ weeks"],
  closeDateSlips: ["moved the close date once at most", "moved it 2+ times"],
  nextStep: ["had a next step set", "had none"],
};

const TOPIC_PHRASES: ReadonlyArray<readonly [Topic, string, string]> = [
  ["pain", "had a clear pain on a call", "had no clear pain"],
  ["champion", "had a champion", "had no champion"],
  ["economicBuyer", "had the budget owner involved", "didn't"],
  ["competitor", "faced a competitor", "faced none we heard of"],
  ["price", "had price pushback", "had none"],
];

const heard = (d: ScoredDeal, topic: Topic) =>
  mentionsIn(d.deal.activities.filter((a) => a.at <= d.asOf)).some((m) => m.topic === topic);

export const FACTORS: readonly Factor[] = [
  ...RUBRIC.map((rule) => ({
    key: rule.key,
    withIt: RUBRIC_PHRASES[rule.key][0],
    without: RUBRIC_PHRASES[rule.key][1],
    has: (d: ScoredDeal) => isStrong(rule, d.points[rule.key]),
  })),
  ...TOPIC_PHRASES.map(([topic, withIt, without]) => ({
    key: topic,
    withIt,
    without,
    has: (d: ScoredDeal) => heard(d, topic),
  })),
];

export interface WinFactor {
  readonly key: string;
  readonly withIt: { readonly phrase: string; readonly n: number; readonly winRate: number | null };
  readonly without: {
    readonly phrase: string;
    readonly n: number;
    readonly winRate: number | null;
  };
  /** Win rate with minus without; positive means the factor helps. */
  readonly difference: number | null;
  readonly grade: Grade;
}

function gradeFor(difference: number | null): Grade {
  if (difference === null) return "unknown";
  // Tiny epsilon so 0.6 − 0.4 counts as the 0.2 it is, not 0.1999….
  const size = Math.abs(difference) + 1e-9;
  if (size >= GRADE_CUTS.big) return "big";
  if (size >= GRADE_CUTS.clear) return "clear";
  if (size >= GRADE_CUTS.small) return "small";
  return "none";
}

const sortKey = (f: { difference: number | null }) =>
  f.difference === null ? -1 : Math.abs(f.difference);

/** Every factor graded on closed deals, biggest difference first, unknowns last. */
export function winFactors(deals: readonly ScoredDeal[]): WinFactor[] {
  const closed = deals.filter((d) => d.deal.outcome !== "open");
  return FACTORS.map((factor) => {
    const yes = closed.filter(factor.has);
    const no = closed.filter((d) => !factor.has(d));
    const [a, b] = [winRate(yes), winRate(no)];
    const enough = yes.length >= MIN_SIDE && no.length >= MIN_SIDE && a !== null && b !== null;
    const difference = enough ? (a as number) - (b as number) : null;
    return {
      key: factor.key,
      withIt: { phrase: factor.withIt, n: yes.length, winRate: a },
      without: { phrase: factor.without, n: no.length, winRate: b },
      difference,
      grade: gradeFor(difference),
    };
  }).sort((x, y) => sortKey(y) - sortKey(x));
}
