import { quarterOf } from "./forecast";
import type { RiskFlag, ScoredDeal } from "./types";

export interface Play {
  readonly flag: RiskFlag;
  readonly title: string;
  readonly how: string;
  /** Rough share of the deal's value this action protects. Ranks actions; not a promise. */
  readonly lift: number;
}

/**
 * One play per risk flag, strongest first. A deal gets the first play it qualifies for. A passed
 * close date comes first: the forecast is wrong until it is fixed.
 */
export const PLAYS: readonly Play[] = [
  {
    flag: "closeDatePassed",
    title: "Reset the close date with the buyer",
    how: "Agree a real date and update HubSpot.",
    lift: 0.25,
  },
  {
    flag: "goingDark",
    title: "Re-engage the champion",
    how: "Call, don't email. Offer a specific time this week.",
    lift: 0.2,
  },
  {
    flag: "competitor",
    title: "Win the comparison",
    how: "Ask what they like about the other option, then send one proof point that beats it.",
    lift: 0.15,
  },
  {
    flag: "singleThreaded",
    title: "Get a second contact",
    how: "Ask your champion to bring in the economic buyer.",
    lift: 0.15,
  },
  {
    flag: "noMeetings",
    title: "Book a live meeting",
    how: "Propose a 30-minute working session on their use case.",
    lift: 0.15,
  },
  {
    flag: "priceObjection",
    title: "Re-anchor on value",
    how: "Tie the price to the cost of their problem before offering any discount.",
    lift: 0.1,
  },
  {
    flag: "repeatedSlips",
    title: "Build a mutual close plan",
    how: "Write down every step to signature with owners and dates.",
    lift: 0.1,
  },
  {
    flag: "noNextStep",
    title: "Set a dated next step",
    how: "Add it in HubSpot so the deal doesn't drift.",
    lift: 0.05,
  },
];

/** Deals closing in a later quarter matter, but less today. */
export const LATER_QUARTER_WEIGHT = 0.5;

export interface Action {
  readonly deal: ScoredDeal;
  readonly play: Play;
  /** Deal amount × lift × urgency: what this action is worth acting on today. */
  readonly impact: number;
}

export function bestAction(deal: ScoredDeal, now: Date): Action | null {
  const play = PLAYS.find((p) => deal.flags.includes(p.flag));
  if (!play) return null;
  const close = deal.deal.closeDate;
  const thisQuarter = close === null || close < quarterOf(now).end;
  const impact = (deal.deal.amount ?? 0) * play.lift * (thisQuarter ? 1 : LATER_QUARTER_WEIGHT);
  return { deal, play, impact };
}

/** Today's actions, biggest impact first, one per deal. */
export function actionsFor(deals: readonly ScoredDeal[], now: Date): Action[] {
  return deals
    .map((d) => bestAction(d, now))
    .filter((a): a is Action => a !== null)
    .sort((a, b) => b.impact - a.impact);
}
