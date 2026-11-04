import { describe, expect, test } from "vitest";
import { compareWonLost } from "@/core/analysis";
import { scoreDeal } from "@/core/score";
import {
  createRandom,
  DEFAULT_STAGES,
  generateSeed,
  SEED_EMAIL_DOMAIN,
  seedToDeal,
} from "@/core/seedData";

const NOW = new Date("2026-11-04T12:00:00Z");

describe("generateSeed", () => {
  const seed = generateSeed(NOW);

  test("is deterministic", () => {
    expect(generateSeed(NOW)).toEqual(seed);
    expect(createRandom(1)()).toBe(createRandom(1)());
  });

  test("has the planned outcome mix with unique names and emails", () => {
    expect(seed).toHaveLength(38);
    expect(seed.filter((d) => d.outcome === "won")).toHaveLength(12);
    expect(seed.filter((d) => d.outcome === "lost")).toHaveLength(10);
    expect(new Set(seed.map((d) => d.dealname)).size).toBe(seed.length);
    const emails = seed.flatMap((d) => d.contacts.map((c) => c.email));
    expect(new Set(emails).size).toBe(emails.length);
    expect(emails.every((e) => e.endsWith(`.${SEED_EMAIL_DOMAIN}`))).toBe(true);
  });

  test("never puts activity in the future and every deal has a contact", () => {
    for (const d of seed) {
      expect(d.contacts.length).toBeGreaterThan(0);
      for (const a of d.activities) expect(a.at.getTime()).toBeLessThanOrEqual(NOW.getTime());
    }
  });

  test("only lost deals carry a lost reason, and closed deals closed in the past", () => {
    for (const d of seed) {
      expect(d.lostReason !== null).toBe(d.outcome === "lost");
      if (d.outcome !== "open")
        expect((d.closeDates.at(-1) as Date).getTime()).toBeLessThan(NOW.getTime());
    }
  });

  test("gives the dashboard a clear but imperfect won/lost split", () => {
    const result = compareWonLost(seed.map((s, i) => scoreDeal(seedToDeal(s, i), NOW)));
    expect(result.wonAvgScore).toBeGreaterThan((result.lostAvgScore ?? 0) + 20);
    expect(result.signals.every((s) => !s.lowSample)).toBe(true);
    // Every signal should have some wins on its weak side: real data is never this clean.
    const perfect = result.signals.filter((s) => s.weak.n > 0 && s.weak.winRate === 0);
    expect(perfect.map((s) => s.rule.key)).toEqual([]);
  });

  test("seed stages match HubSpot's default pipeline ids", () => {
    const ids = new Set(DEFAULT_STAGES.map((s) => s.id));
    expect(seed.every((d) => ids.has(d.stage))).toBe(true);
    expect(seedToDeal(seed[0] as (typeof seed)[number], 0).id).toBe("1");
  });
});
