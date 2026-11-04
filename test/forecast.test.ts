import { describe, expect, test } from "vitest";
import {
  categoryOf,
  forecast,
  forecastQuarter,
  quarterOf,
  upcomingQuarters,
} from "@/core/forecast";
import { scoreDeal } from "@/core/score";
import type { Deal } from "@/core/types";
import { activity, makeDeal, NOW } from "./fixtures";

// NOW is 2026-11-01, inside Q4 2026.
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const score = (deals: Deal[]) => deals.map((x) => scoreDeal(x, NOW));

describe("quarters", () => {
  test("maps dates to calendar quarters", () => {
    expect(quarterOf(d("2026-11-01"))).toMatchObject({ key: "2026-Q4", label: "Q4 2026" });
    expect(quarterOf(d("2026-01-01")).key).toBe("2026-Q1");
    expect(quarterOf(d("2026-09-30")).end).toEqual(d("2026-10-01"));
  });

  test("lists the current quarter and the next two, across the year boundary", () => {
    expect(upcomingQuarters(NOW).map((q) => q.key)).toEqual(["2026-Q4", "2027-Q1", "2027-Q2"]);
  });

  test("buckets open deals by stage probability", () => {
    expect(categoryOf(0.9)).toBe("commit");
    expect(categoryOf(0.8)).toBe("commit");
    expect(categoryOf(0.6)).toBe("bestCase");
    expect(categoryOf(0.4)).toBe("pipeline");
  });
});

describe("forecastQuarter", () => {
  const healthy: Partial<Deal> = {
    contactCount: 3,
    nextStep: "Sign",
    activities: [activity("meeting", 1), activity("meeting", 3), activity("meeting", 5)],
  };
  const deals = score([
    makeDeal({ id: "won", outcome: "won", amount: 50_000, closeDate: d("2026-10-10") }),
    makeDeal({ id: "lost", outcome: "lost", amount: 20_000, closeDate: d("2026-10-12") }),
    makeDeal({
      id: "c1",
      amount: 40_000,
      probability: 0.9,
      closeDate: d("2026-12-01"),
      ...healthy,
    }),
    makeDeal({ id: "c2", amount: 10_000, probability: 0.8, closeDate: d("2026-12-15") }),
    makeDeal({ id: "bc", amount: 30_000, probability: 0.6, closeDate: d("2026-11-20") }),
    makeDeal({ id: "pl", amount: 25_000, probability: 0.2, closeDate: d("2026-12-20") }),
    makeDeal({ id: "late", amount: 5_000, probability: 0.4, closeDate: d("2026-10-20") }),
    makeDeal({ id: "stale", amount: 7_000, probability: 0.4, closeDate: d("2026-08-01") }),
    makeDeal({ id: "next", amount: 99_000, probability: 0.6, closeDate: d("2027-02-01") }),
    makeDeal({ id: "nodate", amount: 1_000, closeDate: null }),
  ]);
  const q4 = forecastQuarter(deals, quarterOf(NOW), NOW);

  test("adds up closed, commit, best case and pipeline for the quarter", () => {
    expect(q4).toMatchObject({
      isCurrent: true,
      closedWon: 50_000,
      closedLost: 20_000,
      commit: 50_000,
      bestCase: 30_000,
      pipeline: 37_000,
      floor: 100_000,
      upside: 130_000,
      openCount: 6,
    });
  });

  test("pulls deals that slipped from earlier quarters into the current one as overdue", () => {
    expect(q4.overdue).toEqual({ count: 2, amount: 12_000 });
  });

  test("shows how much of commit is at risk", () => {
    expect(q4.commitAtRisk).toBe(10_000);
  });

  test("ranks movers by category, then amount", () => {
    expect(q4.movers.map((m) => m.deal.id)).toEqual(["c1", "c2", "bc", "pl", "stale", "late"]);
  });

  test("future quarters only count deals closing in them", () => {
    const [, q1] = forecast(deals, NOW);
    expect(q1).toMatchObject({ isCurrent: false, bestCase: 99_000, overdue: { count: 0 } });
    expect(q1?.weighted).toBeCloseTo(59_400);
  });
});
