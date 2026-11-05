/**
 * One-page account brief for an AE, following the account-research-brief skill: every claim is
 * tagged as evidence (read from a source) or inference (our read), and a source that returned
 * nothing is said out loud instead of padded over. Nothing here is invented.
 */
import { type Action, bestAction } from "./actions";
import type { Company, Contact, ScoredDeal } from "./types";

export type Tag = "evidence" | "inference";

export interface Claim {
  readonly text: string;
  readonly tag: Tag;
}

export interface Swot {
  readonly strengths: readonly Claim[];
  readonly weaknesses: readonly Claim[];
  readonly opportunities: readonly Claim[];
  readonly threats: readonly Claim[];
}

export interface Brief {
  readonly company: Company | null;
  readonly buyingGroup: readonly Contact[];
  readonly swot: Swot;
  /** Sources with nothing to say about this account, in plain words. */
  readonly gaps: readonly string[];
  readonly action: Action | null;
}

const LARGE_ORG = 1_000;
const RECENT_TOUCH_DAYS = 7;
const DARK_DAYS = 14;
const LATE_STAGE = 0.8;
const ECONOMIC_BUYER = /\b(cfo|ceo|coo|cro|chief|vp|vice president|head of|director)\b/i;

/** Sources the app doesn't read yet. Listed so the AE knows what the brief can't see. */
export const UNCONNECTED_SOURCES = [
  "No call recordings connected: pains, objections and quotes are not in this brief.",
  "No hiring or news source connected: no live buying signals.",
] as const;

const evidence = (text: string): Claim => ({ text, tag: "evidence" });
const inference = (text: string): Claim => ({ text, tag: "inference" });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const when = <T>(condition: boolean, value: T): T[] => (condition ? [value] : []);

function swotFor(d: ScoredDeal, hasEconomicBuyer: boolean): Swot {
  const { signals, deal } = d;
  const open = deal.outcome === "open";
  const neverTouched = deal.activities.length === 0;
  return {
    strengths: [
      ...when(signals.meetings >= 2, evidence(`${plural(signals.meetings, "meeting")} held`)),
      ...when(signals.contacts >= 3, evidence(`${signals.contacts} contacts on the deal`)),
      ...when(
        !neverTouched && signals.daysSinceActivity <= RECENT_TOUCH_DAYS,
        evidence(`Last touch ${plural(signals.daysSinceActivity, "day")} ago`),
      ),
      ...when(deal.nextStep !== null, evidence(`Next step: ${deal.nextStep}`)),
    ],
    weaknesses: [
      ...when(signals.contacts === 0, evidence("No contacts on the deal")),
      ...when(signals.contacts === 1, evidence("Only one contact on the deal")),
      ...when(signals.meetings === 0, evidence("No meetings logged")),
      ...when(neverTouched, evidence("No logged activity at all")),
      ...when(
        !neverTouched && signals.daysSinceActivity > DARK_DAYS,
        evidence(`No activity for ${signals.daysSinceActivity} days`),
      ),
    ],
    opportunities: [
      ...when(
        open && !hasEconomicBuyer,
        inference("No exec-level contact yet: bring in the economic buyer before pricing"),
      ),
      ...when(
        (deal.company?.employees ?? 0) >= LARGE_ORG,
        inference("Large organisation: likely room to expand beyond this team"),
      ),
      ...when(
        open && deal.probability >= LATE_STAGE,
        inference("Late stage: a written close plan can lock in the date"),
      ),
    ],
    threats: [
      ...when(
        deal.closeDateChanges > 0,
        evidence(`Close date moved ${plural(deal.closeDateChanges, "time")}`),
      ),
      ...when(d.flags.includes("closeDatePassed"), evidence("Close date has passed")),
      ...when(
        open && d.tier === "atRisk",
        inference("Engagement looks like the deals we lost (health score below 40)"),
      ),
    ],
  };
}

export function buildBrief(d: ScoredDeal, now: Date): Brief {
  const { deal } = d;
  const hasEconomicBuyer = deal.contacts.some((c) => c.title && ECONOMIC_BUYER.test(c.title));
  const gaps = [
    ...when(deal.company === null, "No company record linked to this deal in HubSpot."),
    ...when(
      deal.contacts.length === 0,
      deal.contactCount > 0
        ? "Contacts are linked, but their names and titles couldn't be read."
        : "No contacts linked to this deal in HubSpot.",
    ),
    ...UNCONNECTED_SOURCES,
  ];
  return {
    company: deal.company,
    buyingGroup: deal.contacts,
    swot: swotFor(d, hasEconomicBuyer),
    gaps,
    action: bestAction(d, now),
  };
}
