import type { SignalKey, Tier } from "./types";

export interface Band {
  /** Inclusive lower bound of the signal value for this band. */
  readonly min: number;
  readonly points: number;
  readonly label: string;
}

export interface SignalRule {
  readonly key: SignalKey;
  readonly name: string;
  readonly why: string;
  readonly max: number;
  readonly better: "higher" | "lower";
  readonly bands: readonly Band[];
}

export const RECENT_WINDOW_DAYS = 30;
/** No activity at all counts as dark for this many days, so it lands in the worst band. */
export const NEVER_ACTIVE_DAYS = 999;

export const RUBRIC: readonly SignalRule[] = [
  {
    key: "contacts",
    name: "Multi-threading",
    why: "Deals with several buyer contacts survive a champion leaving or going quiet.",
    max: 20,
    better: "higher",
    bands: [
      { min: 3, points: 20, label: "3+ contacts" },
      { min: 2, points: 10, label: "2 contacts" },
      { min: 0, points: 0, label: "1 or none" },
    ],
  },
  {
    key: "recentActivity",
    name: "Recent activity",
    why: `Notes, calls, meetings and emails in the last ${RECENT_WINDOW_DAYS} days show the deal is being worked.`,
    max: 20,
    better: "higher",
    bands: [
      { min: 6, points: 20, label: "6+ activities" },
      { min: 3, points: 15, label: "3–5 activities" },
      { min: 1, points: 8, label: "1–2 activities" },
      { min: 0, points: 0, label: "None" },
    ],
  },
  {
    key: "meetings",
    name: "Meetings held",
    why: "Live meetings are the strongest sign the buyer is investing time.",
    max: 20,
    better: "higher",
    bands: [
      { min: 3, points: 20, label: "3+ meetings" },
      { min: 2, points: 14, label: "2 meetings" },
      { min: 1, points: 8, label: "1 meeting" },
      { min: 0, points: 0, label: "None" },
    ],
  },
  {
    key: "daysSinceActivity",
    name: "Days since last touch",
    why: "Deals that go quiet for weeks rarely come back.",
    max: 20,
    better: "lower",
    bands: [
      { min: 0, points: 20, label: "Within 7 days" },
      { min: 8, points: 12, label: "8–14 days" },
      { min: 15, points: 5, label: "15–30 days" },
      { min: 31, points: 0, label: "Over 30 days" },
    ],
  },
  {
    key: "closeDateSlips",
    name: "Close date slips",
    why: "Each push of the close date is a sign the buyer's timeline isn't real.",
    max: 10,
    better: "lower",
    bands: [
      { min: 0, points: 10, label: "Never moved" },
      { min: 1, points: 5, label: "Moved once" },
      { min: 2, points: 0, label: "Moved 2+ times" },
    ],
  },
  {
    key: "nextStep",
    name: "Next step set",
    why: "A written next step means someone owns what happens after this call.",
    max: 10,
    better: "higher",
    bands: [
      { min: 1, points: 10, label: "Set" },
      { min: 0, points: 0, label: "Missing" },
    ],
  },
];

export const TIER_THRESHOLDS = { healthy: 70, watch: 40 } as const;

/** The band with the highest lower bound the value reaches. */
export function bandFor(rule: SignalRule, value: number): Band {
  const band = [...rule.bands].sort((a, b) => b.min - a.min).find((b) => value >= b.min);
  if (!band) throw new Error(`No band for ${rule.key}=${value}`);
  return band;
}

export function tierFor(score: number): Tier {
  if (score >= TIER_THRESHOLDS.healthy) return "healthy";
  if (score >= TIER_THRESHOLDS.watch) return "watch";
  return "atRisk";
}

/** A signal is "strong" when it earns at least half its points. Used for win-rate splits. */
export function isStrong(rule: SignalRule, points: number): boolean {
  return points >= rule.max / 2;
}

/** The lowest-scoring band that still counts as strong, to explain the cut-off. */
export function weakestStrongBand(rule: SignalRule): Band {
  const strong = rule.bands.filter((b) => isStrong(rule, b.points));
  const band = [...strong].sort((a, b) => a.points - b.points)[0];
  if (!band) throw new Error(`No strong band for ${rule.key}`);
  return band;
}
