/**
 * Deal health as a few plain sentences anyone can read. The numbers behind it (rubric points)
 * stay in the engine; the UI shows these lines and a one-line headline.
 */
import { latestByTopic, mentionsIn } from "./conversation";
import type { ScoredDeal, Tier } from "./types";

export type Tone = "good" | "neutral" | "bad";

export interface StoryLine {
  readonly tone: Tone;
  readonly text: string;
}

export interface Story {
  readonly headline: string;
  readonly lines: readonly StoryLine[];
}

const RECENT_DAYS = 7;
const QUIET_DAYS = 14;
const HEADLINE_REASONS = 2;

const TIER_WORD: Readonly<Record<Tier, string>> = {
  healthy: "Healthy",
  watch: "Needs attention",
  atRisk: "At risk",
};

const line = (tone: Tone, text: string): StoryLine => ({ tone, text });
const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

function peopleLine(contacts: number): StoryLine {
  if (contacts === 0) return line("bad", "Nobody on the buyer side is linked");
  if (contacts === 1) return line("bad", "Only one person involved");
  return line("good", `${contacts} people involved`);
}

function momentumLine(days: number, everTouched: boolean): StoryLine {
  if (!everTouched) return line("bad", "No activity logged yet");
  if (days <= RECENT_DAYS)
    return line(
      "good",
      days === 0 ? "Touched today" : `Last touch ${plural(days, "a day", "days")} ago`,
    );
  if (days <= QUIET_DAYS) return line("neutral", `Last touch ${days} days ago`);
  return line("bad", `Quiet for ${days} days`);
}

function meetingsLine(meetings: number): StoryLine {
  if (meetings === 0) return line("bad", "No meetings yet");
  if (meetings === 1) return line("neutral", "One meeting so far");
  return line("good", `${meetings} meetings held`);
}

function timelineLine(slips: number, passed: boolean): StoryLine {
  if (passed) return line("bad", "Close date has passed");
  if (slips === 0) return line("good", "Close date has held");
  if (slips === 1) return line("neutral", "Close date moved once");
  return line("bad", `Close date moved ${slips} times`);
}

function callLines(d: ScoredDeal): StoryLine[] {
  const heard = latestByTopic(mentionsIn(d.deal.activities.filter((a) => a.at <= d.asOf)));
  return [
    ...(heard.pain ? [line("good", "The buyer has a clear pain")] : []),
    ...(heard.champion ? [line("good", "Has a champion pushing internally")] : []),
    ...(heard.economicBuyer ? [line("good", "Budget owner is involved")] : []),
    ...(heard.competitor ? [line("bad", "A competitor is in play")] : []),
    ...(heard.price ? [line("bad", "Price pushback")] : []),
  ];
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** "At risk: quiet for 42 days and only one person involved" */
function headlineFor(d: ScoredDeal, lines: readonly StoryLine[]): string {
  if (d.deal.outcome === "won") return "Won";
  if (d.deal.outcome === "lost") return d.deal.lostReason ? `Lost: ${d.deal.lostReason}` : "Lost";
  const wanted: Tone = d.tier === "healthy" ? "good" : "bad";
  const reasons = lines
    .filter((l) => l.tone === wanted)
    .slice(0, HEADLINE_REASONS)
    .map((l) => lowerFirst(l.text));
  return reasons.length > 0 ? `${TIER_WORD[d.tier]}: ${reasons.join(" and ")}` : TIER_WORD[d.tier];
}

export function storyFor(d: ScoredDeal): Story {
  const { signals, deal } = d;
  const lines = [
    peopleLine(signals.contacts),
    momentumLine(
      signals.daysSinceActivity,
      deal.activities.some((a) => a.at <= d.asOf),
    ),
    meetingsLine(signals.meetings),
    timelineLine(deal.closeDateChanges, d.flags.includes("closeDatePassed")),
    deal.nextStep ? line("good", `Next step: ${deal.nextStep}`) : line("bad", "No next step"),
    ...callLines(d),
  ];
  return { headline: headlineFor(d, lines), lines };
}

export const tierWord = (tier: Tier): string => TIER_WORD[tier];
