import { describe, expect, test } from "vitest";
import {
  bandFor,
  isStrong,
  NEVER_ACTIVE_DAYS,
  RUBRIC,
  tierFor,
  weakestStrongBand,
} from "@/core/rubric";
import { asOfDate, computeSignals, scoreDeal } from "@/core/score";
import { activity, daysAgo, makeDeal, NOW } from "./fixtures";

const rule = (key: string) => {
  const found = RUBRIC.find((r) => r.key === key);
  if (!found) throw new Error(key);
  return found;
};

describe("rubric", () => {
  test("points add up to 100", () => {
    expect(RUBRIC.reduce((s, r) => s + r.max, 0)).toBe(100);
  });

  test("picks the highest band the value reaches, for both directions", () => {
    expect(bandFor(rule("contacts"), 5).points).toBe(20);
    expect(bandFor(rule("contacts"), 2).points).toBe(10);
    expect(bandFor(rule("daysSinceActivity"), 3).points).toBe(20);
    expect(bandFor(rule("daysSinceActivity"), 10).points).toBe(12);
    expect(bandFor(rule("daysSinceActivity"), NEVER_ACTIVE_DAYS).points).toBe(0);
  });

  test("throws when a value is below every band", () => {
    expect(() => bandFor(rule("contacts"), -1)).toThrow();
  });

  test("tiers split at 70 and 40", () => {
    expect(tierFor(70)).toBe("healthy");
    expect(tierFor(69)).toBe("watch");
    expect(tierFor(40)).toBe("watch");
    expect(tierFor(39)).toBe("atRisk");
  });

  test("a signal is strong at half its points or more", () => {
    expect(isStrong(rule("contacts"), 10)).toBe(true);
    expect(isStrong(rule("contacts"), 0)).toBe(false);
  });
});

describe("computeSignals", () => {
  test("counts only activity on or before the as-of date", () => {
    const deal = makeDeal({
      activities: [activity("meeting", 40), activity("call", 5), activity("note", -3)],
    });
    expect(computeSignals(deal, NOW)).toMatchObject({
      recentActivity: 1,
      meetings: 1,
      daysSinceActivity: 5,
    });
  });

  test("a deal with no activity is treated as dark", () => {
    expect(computeSignals(makeDeal(), NOW).daysSinceActivity).toBe(NEVER_ACTIVE_DAYS);
  });

  test("a blank next step does not count", () => {
    expect(computeSignals(makeDeal({ nextStep: "  " }), NOW).nextStep).toBe(0);
    expect(computeSignals(makeDeal({ nextStep: "Send MSA" }), NOW).nextStep).toBe(1);
  });
});

describe("scoreDeal", () => {
  test("judges closed deals as of their close date", () => {
    const closeDate = daysAgo(100);
    const deal = makeDeal({
      outcome: "won",
      closeDate,
      activities: [activity("meeting", 2, closeDate)],
    });
    expect(asOfDate(deal, NOW)).toBe(closeDate);
    const scored = scoreDeal(deal, NOW);
    expect(scored.signals.daysSinceActivity).toBe(2);
    expect(scored.flags).toEqual([]);
  });

  test("a well-worked deal is healthy", () => {
    const deal = makeDeal({
      contactCount: 4,
      nextStep: "Security review Tuesday",
      activities: [
        activity("meeting", 2),
        activity("meeting", 9),
        activity("meeting", 20),
        activity("call", 1),
        activity("email", 3),
        activity("note", 4),
      ],
    });
    const scored = scoreDeal(deal, NOW);
    expect(scored.score).toBe(100);
    expect(scored.tier).toBe("healthy");
    expect(scored.flags).toEqual([]);
  });

  test("a neglected open deal raises every flag", () => {
    const deal = makeDeal({ closeDate: daysAgo(5), closeDateChanges: 3 });
    const scored = scoreDeal(deal, NOW);
    expect(scored.tier).toBe("atRisk");
    expect(scored.flags).toEqual([
      "singleThreaded",
      "goingDark",
      "noMeetings",
      "closeDatePassed",
      "repeatedSlips",
      "noNextStep",
    ]);
  });

  test("an open deal without a close date is not flagged as passed", () => {
    expect(scoreDeal(makeDeal({ closeDate: null }), NOW).flags).not.toContain("closeDatePassed");
  });
});

describe("weakestStrongBand", () => {
  test("names the cut-off band for each signal", () => {
    expect(weakestStrongBand(rule("contacts")).label).toBe("2 contacts");
    expect(weakestStrongBand(rule("daysSinceActivity")).label).toBe("8–14 days");
  });
});
