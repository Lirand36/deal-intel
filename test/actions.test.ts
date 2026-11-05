import { describe, expect, test } from "vitest";
import { actionsFor, bestAction, LATER_QUARTER_WEIGHT } from "@/core/actions";
import { forecastQuarter, quarterOf, verdictFor } from "@/core/forecast";
import { scoreDeal } from "@/core/score";
import { activity, daysAgo, makeDeal, NOW } from "./fixtures";

const healthy = {
  contactCount: 3,
  nextStep: "Sign",
  activities: [activity("meeting", 1), activity("meeting", 4), activity("call", 2)],
};

describe("bestAction", () => {
  test("picks the strongest play the deal qualifies for", () => {
    const deal = scoreDeal(makeDeal({ amount: 100_000, closeDate: daysAgo(-20) }), NOW);
    expect(bestAction(deal, NOW)).toMatchObject({
      play: { flag: "goingDark" },
      impact: 20_000,
    });
  });

  test("weights deals closing in a later quarter lower", () => {
    const deal = scoreDeal(makeDeal({ amount: 100_000, closeDate: daysAgo(-120) }), NOW);
    expect(bestAction(deal, NOW)?.impact).toBe(20_000 * LATER_QUARTER_WEIGHT);
  });

  test("healthy and closed deals need no action", () => {
    expect(bestAction(scoreDeal(makeDeal(healthy), NOW), NOW)).toBeNull();
    expect(bestAction(scoreDeal(makeDeal({ outcome: "won" }), NOW), NOW)).toBeNull();
  });
});

describe("actionsFor", () => {
  test("ranks one action per deal by impact", () => {
    const deals = [
      makeDeal({ id: "small", amount: 10_000 }),
      makeDeal({ id: "big", amount: 90_000 }),
      makeDeal({ id: "ok", ...healthy }),
      makeDeal({ id: "noamount", amount: null }),
    ].map((d) => scoreDeal(d, NOW));
    expect(actionsFor(deals, NOW).map((a) => a.deal.deal.id)).toEqual(["big", "small", "noamount"]);
  });
});

describe("verdictFor", () => {
  const q = (closedWon: number, commit: number, bestCase: number) =>
    forecastQuarter(
      [
        makeDeal({ id: "w", outcome: "won", amount: closedWon, closeDate: daysAgo(5) }),
        makeDeal({ id: "c", amount: commit, probability: 0.9, closeDate: daysAgo(-10) }),
        makeDeal({ id: "b", amount: bestCase, probability: 0.6, closeDate: daysAgo(-10) }),
      ].map((d) => scoreDeal(d, NOW)),
      quarterOf(NOW),
      NOW,
    );

  test("is on track when the floor covers quota", () => {
    expect(verdictFor(q(60, 40, 0), 100)).toMatchObject({ status: "onTrack", gap: 0 });
  });

  test("needs best case when only upside covers quota", () => {
    expect(verdictFor(q(30, 30, 50), 100)).toMatchObject({ status: "needsBestCase", gap: 40 });
  });

  test("is short when even upside misses quota", () => {
    expect(verdictFor(q(10, 10, 10), 100)).toMatchObject({
      status: "short",
      gap: 80,
      shortEvenWithUpside: 70,
    });
  });
});
