import { mentionsIn, type Topic } from "./conversation";
import { bandFor, NEVER_ACTIVE_DAYS, RECENT_WINDOW_DAYS, RUBRIC, tierFor } from "./rubric";
import type { Deal, RiskFlag, ScoredDeal, SignalKey, SignalValues } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const GOING_DARK_DAYS = 14;
const REPEATED_SLIPS = 2;

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

/** Closed deals are judged as they stood on their close date; open deals as of now. */
export function asOfDate(deal: Deal, now: Date): Date {
  return deal.outcome !== "open" && deal.closeDate ? deal.closeDate : now;
}

export function computeSignals(deal: Deal, asOf: Date): SignalValues {
  const past = deal.activities.filter((a) => a.at.getTime() <= asOf.getTime());
  const windowStart = asOf.getTime() - RECENT_WINDOW_DAYS * DAY_MS;
  const lastTouch = Math.max(...past.map((a) => a.at.getTime()));
  return {
    contacts: deal.contactCount,
    recentActivity: past.filter((a) => a.at.getTime() >= windowStart).length,
    meetings: past.filter((a) => a.type === "meeting").length,
    daysSinceActivity: past.length > 0 ? daysBetween(new Date(lastTouch), asOf) : NEVER_ACTIVE_DAYS,
    closeDateSlips: deal.closeDateChanges,
    nextStep: deal.nextStep?.trim() ? 1 : 0,
  };
}

/** Buyer topics count as live risks only if raised recently. */
const LIVE_OBJECTION_DAYS = 30;

function raisedRecently(deal: Deal, now: Date): Set<Topic> {
  const since = now.getTime() - LIVE_OBJECTION_DAYS * DAY_MS;
  return new Set(
    mentionsIn(deal.activities)
      .filter((m) => m.at.getTime() >= since)
      .map((m) => m.topic),
  );
}

export function riskFlags(deal: Deal, signals: SignalValues, now: Date): RiskFlag[] {
  if (deal.outcome !== "open") return [];
  const recent = raisedRecently(deal, now);
  const checks: ReadonlyArray<readonly [RiskFlag, boolean]> = [
    ["singleThreaded", signals.contacts <= 1],
    ["goingDark", signals.daysSinceActivity > GOING_DARK_DAYS],
    ["noMeetings", signals.meetings === 0],
    ["closeDatePassed", deal.closeDate !== null && deal.closeDate.getTime() < now.getTime()],
    ["repeatedSlips", signals.closeDateSlips >= REPEATED_SLIPS],
    ["noNextStep", signals.nextStep === 0],
    ["competitor", recent.has("competitor")],
    ["priceObjection", recent.has("price")],
  ];
  return checks.filter(([, hit]) => hit).map(([flag]) => flag);
}

export function scoreDeal(deal: Deal, now: Date): ScoredDeal {
  const asOf = asOfDate(deal, now);
  const signals = computeSignals(deal, asOf);
  const points = Object.fromEntries(
    RUBRIC.map((rule) => [rule.key, bandFor(rule, signals[rule.key]).points]),
  ) as Record<SignalKey, number>;
  const score = Object.values(points).reduce((sum, p) => sum + p, 0);
  return {
    deal,
    asOf,
    ageDays: daysBetween(deal.createdAt, asOf),
    signals,
    points,
    score,
    tier: tierFor(score),
    flags: riskFlags(deal, signals, now),
  };
}

export const FLAG_LABELS: Readonly<Record<RiskFlag, string>> = {
  singleThreaded: "Single-threaded",
  goingDark: `No touch in ${GOING_DARK_DAYS}+ days`,
  noMeetings: "No meetings yet",
  closeDatePassed: "Close date passed",
  repeatedSlips: "Close date pushed 2+ times",
  noNextStep: "No next step",
  competitor: "Competitor in play",
  priceObjection: "Price pushback",
};
