import { describe, expect, test } from "vitest";
import { scoreDeal } from "@/core/score";
import { storyFor, tierWord } from "@/core/story";
import type { Activity, Deal } from "@/core/types";
import { GRADE_LABELS, winFactors } from "@/core/winFactors";
import { activity, daysAgo, makeDeal, NOW } from "./fixtures";

const story = (overrides: Partial<Deal>) => storyFor(scoreDeal(makeDeal(overrides), NOW));
const said = (ago: number, text: string): Activity => ({ ...activity("call", ago), text });

describe("storyFor", () => {
  test("a neglected deal reads as a short, plain warning", () => {
    const s = story({ activities: [activity("call", 42)], closeDateChanges: 2 });
    expect(s.headline).toBe("At risk: only one person involved and quiet for 42 days");
    expect(s.lines.map((l) => [l.tone, l.text])).toEqual([
      ["bad", "Only one person involved"],
      ["bad", "Quiet for 42 days"],
      ["bad", "No meetings yet"],
      ["bad", "Close date moved 2 times"],
      ["bad", "No next step"],
    ]);
  });

  test("a healthy deal leads with its strengths and quotes the buyer", () => {
    const s = story({
      contactCount: 3,
      nextStep: "Legal review",
      activities: [
        activity("meeting", 3),
        activity("meeting", 8),
        said(0, "Ana: We do this by hand today."),
        activity("note", 2),
        activity("note", 4),
        activity("note", 5),
      ],
    });
    expect(s.headline).toBe("Healthy: 3 people involved and touched today");
    expect(s.lines.map((l) => l.text)).toEqual([
      "3 people involved",
      "Touched today",
      "2 meetings held",
      "Close date has held",
      "Next step: Legal review",
      "The buyer has a clear pain",
    ]);
  });

  test("covers the in-between and buyer-risk lines", () => {
    const s = story({
      contactCount: 0,
      closeDateChanges: 1,
      activities: [
        activity("meeting", 10),
        said(
          10,
          "Tom: I'll take this to our leadership. Our CFO signs off. We're also looking at another vendor. It feels expensive.",
        ),
      ],
    });
    expect(s.lines.map((l) => l.text)).toEqual([
      "Nobody on the buyer side is linked",
      "Last touch 10 days ago",
      "One meeting so far",
      "Close date moved once",
      "No next step",
      "Has a champion pushing internally",
      "Budget owner is involved",
      "A competitor is in play",
      "Price pushback",
    ]);
    expect(story({}).lines[1]?.text).toBe("No activity logged yet");
    expect(story({ activities: [activity("call", 1)] }).lines[1]?.text).toBe(
      "Last touch a day ago",
    );
    expect(story({ activities: [activity("call", 3)] }).lines[1]?.text).toBe(
      "Last touch 3 days ago",
    );
    expect(story({ closeDate: daysAgo(2) }).lines[3]?.text).toBe("Close date has passed");
  });

  test("closed deals say how they ended", () => {
    expect(story({ outcome: "won", closeDate: daysAgo(5) }).headline).toBe("Won");
    expect(story({ outcome: "lost", closeDate: daysAgo(5), lostReason: "Price" }).headline).toBe(
      "Lost: Price",
    );
    expect(story({ outcome: "lost", closeDate: daysAgo(5) }).headline).toBe("Lost");
    expect(tierWord("watch")).toBe("Needs attention");
  });

  test("a middling deal with no clear reasons just names its tier", () => {
    const s = story({
      contactCount: 2,
      nextStep: "Demo",
      activities: [activity("meeting", 9), activity("meeting", 12)],
    });
    expect(s.headline.startsWith("Needs attention")).toBe(true);
  });
});

describe("winFactors", () => {
  const won = (id: string, extra: Partial<Deal> = {}) =>
    makeDeal({ id, outcome: "won", closeDate: daysAgo(10), ...extra });
  const lost = (id: string, extra: Partial<Deal> = {}) =>
    makeDeal({ id, outcome: "lost", closeDate: daysAgo(10), ...extra });

  test("grades each factor by the win-rate gap, biggest first", () => {
    const deals = [
      won("1", { contactCount: 3 }),
      won("2", { contactCount: 3 }),
      won("3", { contactCount: 1 }),
      lost("4", { contactCount: 1 }),
      lost("5", { contactCount: 1 }),
      lost("6", { contactCount: 1 }),
      makeDeal({ id: "open", contactCount: 5 }),
    ].map((d) => scoreDeal(d, NOW));
    const factors = winFactors(deals);
    const people = factors.find((f) => f.key === "contacts");
    expect(people).toMatchObject({
      withIt: { phrase: "had 2+ people involved", n: 2, winRate: 1 },
      without: { n: 4, winRate: 0.25 },
      grade: "big",
    });
    const gaps = factors.flatMap((f) => (f.difference === null ? [] : [Math.abs(f.difference)]));
    expect(gaps).toEqual([...gaps].sort((a, b) => b - a));
    expect(factors.find((f) => f.key === "pain")?.grade).toBe("unknown");
    expect(factors.at(-1)?.difference).toBeNull();
    expect(GRADE_LABELS.big).toBe("Big difference");
  });

  test("small gaps grade small, clear or none", () => {
    const mk = (wonWith: number, lostWith: number, wonWithout: number, lostWithout: number) =>
      winFactors(
        [
          ...Array.from({ length: wonWith }, (_, i) => won(`a${i}`, { contactCount: 3 })),
          ...Array.from({ length: lostWith }, (_, i) => lost(`b${i}`, { contactCount: 3 })),
          ...Array.from({ length: wonWithout }, (_, i) => won(`c${i}`)),
          ...Array.from({ length: lostWithout }, (_, i) => lost(`d${i}`)),
        ].map((d) => scoreDeal(d, NOW)),
      ).find((f) => f.key === "contacts")?.grade;
    expect(mk(3, 2, 2, 3)).toBe("clear");
    expect(mk(6, 4, 5, 5)).toBe("small");
    expect(mk(1, 1, 1, 1)).toBe("none");
  });
});
