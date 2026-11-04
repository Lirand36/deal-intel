import { describe, expect, test } from "vitest";
import {
  compareWonLost,
  lossReasons,
  median,
  summarize,
  UNKNOWN_REASON,
  winRate,
} from "@/core/analysis";
import { scoreDeal } from "@/core/score";
import type { Deal, Stage } from "@/core/types";
import { activity, daysAgo, makeDeal, NOW } from "./fixtures";

const STAGES: Stage[] = [
  { id: "closedwon", label: "Closed won", order: 5, probability: 1 },
  { id: "qualifiedtobuy", label: "Qualified", order: 1, probability: 0.4 },
  { id: "contractsent", label: "Contract sent", order: 4, probability: 0.9 },
  { id: "closedlost", label: "Closed lost", order: 6, probability: 0 },
];

const score = (deals: Deal[]) => deals.map((d) => scoreDeal(d, NOW));

const won = (id: string, extra: Partial<Deal> = {}) =>
  makeDeal({
    id,
    outcome: "won",
    stageId: "closedwon",
    probability: 1,
    createdAt: daysAgo(90),
    closeDate: daysAgo(30),
    contactCount: 3,
    ...extra,
  });
const lost = (id: string, extra: Partial<Deal> = {}) =>
  makeDeal({
    id,
    outcome: "lost",
    stageId: "closedlost",
    probability: 0,
    closeDate: daysAgo(20),
    ...extra,
  });

describe("median and winRate", () => {
  test("median handles empty, odd and even lists", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  test("win rate ignores open deals and is null with nothing closed", () => {
    expect(winRate(score([makeDeal()]))).toBeNull();
    expect(winRate(score([won("a"), lost("b"), makeDeal({ id: "c" })]))).toBe(0.5);
  });
});

describe("summarize", () => {
  test("totals open pipeline by stage in pipeline order, weighted by probability", () => {
    const deals = score([
      makeDeal({ id: "1", amount: 10_000 }),
      makeDeal({ id: "2", amount: null }),
      makeDeal({ id: "3", amount: 20_000, stageId: "contractsent", probability: 0.9 }),
      won("4", { amount: 8_000 }),
      won("5", { amount: 12_000 }),
      lost("6"),
    ]);
    const summary = summarize(deals, STAGES);
    expect(summary).toMatchObject({
      openCount: 3,
      openAmount: 30_000,
      weightedAmount: 22_000,
      wonCount: 2,
      lostCount: 1,
      avgWonAmount: 10_000,
      medianWonCycleDays: 60,
    });
    expect(summary.stages.map((s) => [s.stage.id, s.count])).toEqual([
      ["qualifiedtobuy", 2],
      ["contractsent", 1],
    ]);
    expect(summary.tiers.atRisk).toBe(3);
  });

  test("has no won averages before anything is won", () => {
    const summary = summarize(score([makeDeal()]), STAGES);
    expect(summary.avgWonAmount).toBeNull();
    expect(summary.medianWonCycleDays).toBeNull();
  });
});

describe("compareWonLost", () => {
  test("splits win rate by whether each signal was strong", () => {
    const deals = score([
      won("1"),
      won("2"),
      won("3", { contactCount: 1 }),
      lost("4"),
      lost("5", { contactCount: 3 }),
    ]);
    const result = compareWonLost(deals);
    const contacts = result.signals.find((s) => s.rule.key === "contacts");
    expect(contacts).toMatchObject({
      wonMedian: 3,
      lostMedian: 2,
      strong: { n: 3, winRate: 2 / 3 },
      weak: { n: 2, winRate: 0.5 },
      lowSample: true,
    });
  });

  test("average score shows whether the rubric separates winners", () => {
    const deals = score([
      won("1", { activities: [activity("meeting", 31), activity("meeting", 32)] }),
      lost("2"),
    ]);
    const result = compareWonLost(deals);
    expect(result.wonAvgScore).toBeGreaterThan(result.lostAvgScore ?? 0);
  });

  test("is empty but safe with no closed deals", () => {
    const result = compareWonLost(score([makeDeal()]));
    expect(result.wonAvgScore).toBeNull();
    expect(result.signals.every((s) => s.strong.winRate === null)).toBe(true);
  });
});

describe("lossReasons", () => {
  test("groups by reason, most common first, with blanks as unknown", () => {
    const deals = score([
      lost("1", { lostReason: "Price", amount: 5_000 }),
      lost("2", { lostReason: " Price ", amount: 7_000 }),
      lost("3", { lostReason: null }),
      lost("4", { lostReason: "Timing", amount: 50_000 }),
      won("5", { lostReason: "ignored" }),
    ]);
    expect(lossReasons(deals)).toEqual([
      { reason: "Price", count: 2, amount: 12_000 },
      { reason: "Timing", count: 1, amount: 50_000 },
      { reason: UNKNOWN_REASON, count: 1, amount: 10_000 },
    ]);
  });
});
