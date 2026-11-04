import type { Activity, Deal } from "@/core/types";

export const NOW = new Date("2026-11-01T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAgo(days: number, from: Date = NOW): Date {
  return new Date(from.getTime() - days * DAY_MS);
}

let nextActivityId = 0;

export function activity(type: Activity["type"], ago: number, from: Date = NOW): Activity {
  nextActivityId += 1;
  return { id: String(nextActivityId), type, at: daysAgo(ago, from) };
}

export function makeDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "1",
    name: "Acme - New Business",
    amount: 10_000,
    stageId: "qualifiedtobuy",
    outcome: "open",
    probability: 0.4,
    createdAt: daysAgo(60),
    closeDate: daysAgo(-30),
    closeDateChanges: 0,
    contactCount: 1,
    activities: [],
    nextStep: null,
    lostReason: null,
    url: "https://app.hubspot.com/contacts/1/record/0-3/1",
    ...overrides,
  };
}
