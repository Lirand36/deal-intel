/**
 * What buyers said on calls and in meetings. Reads the text logged on each activity (call notes,
 * meeting notes or a transcript) and finds a few topics by plain phrase matching. The rep's own
 * lines are ignored: only what the buyer said counts.
 */
import type { Activity } from "./types";

export type Topic = "pain" | "champion" | "economicBuyer" | "timeline" | "competitor" | "price";

export interface Mention {
  readonly topic: Topic;
  readonly quote: string;
  readonly speaker: string | null;
  readonly at: Date;
}

const PATTERNS: Readonly<Record<Topic, RegExp>> = {
  pain: /\b(by hand|manual(ly)?|spreadsheets?|takes (my|our) team|struggl\w*|frustrat\w*|keep missing|nobody trusts|pain point)\b/i,
  champion:
    /\b(take this to|push this internally|sell this internally|champion this|i'?ll (bring|present) (this|it))\b/i,
  economicBuyer:
    /\b(cfo|ceo|budget owner|owns the budget|signs? off|sign-off|approve the budget)\b/i,
  timeline:
    /\b(end of (the )?quarter|go[- ]live|live before|deadline|need (this|it) by|contract .{0,40}ends)\b/i,
  competitor:
    /\b(another vendor|other (tool|vendor|option)|competitor|also (looking at|evaluating))\b/i,
  price: /\b(pricing|price|expensive|discount|over budget|than we budgeted)\b/i,
};

export const TOPIC_LABELS: Readonly<Record<Topic, string>> = {
  pain: "Pain",
  champion: "Champion",
  economicBuyer: "Budget owner",
  timeline: "Timeline",
  competitor: "Competitor",
  price: "Price pushback",
};

const SPEAKER = /^([A-Z][\w .'-]{0,30}):\s*(.+)$/;
const REP_SPEAKERS = /^(rep|ae|sales|me)$/i;

function lines(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z])/))
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Every buyer mention across the deal's activities, oldest first. */
export function mentionsIn(activities: readonly Activity[]): Mention[] {
  const found: Mention[] = [];
  let speaker: string | null = null;
  for (const activity of [...activities].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    speaker = null;
    for (const line of lines(activity.text ?? "")) {
      const match = SPEAKER.exec(line);
      if (match) speaker = match[1] ?? null;
      const said = match?.[2] ?? line;
      if (speaker && REP_SPEAKERS.test(speaker)) continue;
      for (const topic of Object.keys(PATTERNS) as Topic[]) {
        if (PATTERNS[topic].test(said))
          found.push({ topic, quote: said, speaker, at: activity.at });
      }
    }
  }
  return found;
}

/** The most recent mention of each topic heard on the deal. */
export function latestByTopic(mentions: readonly Mention[]): Partial<Record<Topic, Mention>> {
  return Object.fromEntries(mentions.map((m) => [m.topic, m]));
}

/** True when the deal has any logged call or meeting text to read. */
export function hasConversations(activities: readonly Activity[]): boolean {
  return activities.some((a) => (a.type === "call" || a.type === "meeting") && a.text?.trim());
}
