import { describe, expect, test } from "vitest";
import { buildBrief, NO_CALL_NOTES, UNCONNECTED_SOURCES } from "@/core/brief";
import { scoreDeal } from "@/core/score";
import type { Deal } from "@/core/types";
import { activity, daysAgo, makeDeal, NOW } from "./fixtures";

const brief = (overrides: Partial<Deal>) => buildBrief(scoreDeal(makeDeal(overrides), NOW), NOW);
const texts = (claims: readonly { text: string }[]) => claims.map((c) => c.text);

const company = {
  name: "Globex",
  domain: "globex.com",
  industry: "Manufacturing",
  employees: 4_000,
  country: "Germany",
  description: null,
};

describe("buildBrief", () => {
  test("a well-worked late-stage deal reads as strengths, tagged as evidence", () => {
    const b = brief({
      probability: 0.9,
      company,
      contactCount: 3,
      contacts: [
        { id: "1", name: "Ana Diaz", title: "CFO" },
        { id: "2", name: "Ben Ito", title: "IT lead" },
        { id: "3", name: "Cy Ng", title: null },
      ],
      nextStep: "Legal review",
      activities: [activity("meeting", 2), activity("meeting", 9)],
    });
    expect(texts(b.swot.strengths)).toEqual([
      "2 meetings held",
      "3 contacts on the deal",
      "Last touch 2 days ago",
      "Next step: Legal review",
    ]);
    expect(b.swot.strengths.every((c) => c.tag === "evidence")).toBe(true);
    expect(texts(b.swot.weaknesses)).toEqual([]);
    expect(texts(b.swot.opportunities)).toEqual([
      "Large organisation: likely room to expand beyond this team",
      "Late stage: a written close plan can lock in the date",
    ]);
    expect(b.swot.opportunities.every((c) => c.tag === "inference")).toBe(true);
    expect(b.gaps).toEqual([NO_CALL_NOTES, ...UNCONNECTED_SOURCES]);
    expect(b.heard).toEqual([]);
    expect(b.action).toBeNull();
  });

  test("a neglected deal names its weaknesses and threats and says what is missing", () => {
    const b = brief({ contactCount: 0, closeDate: daysAgo(3), closeDateChanges: 2 });
    expect(texts(b.swot.weaknesses)).toEqual([
      "No contacts on the deal",
      "No meetings logged",
      "No logged activity at all",
    ]);
    expect(texts(b.swot.threats)).toEqual([
      "Close date moved 2 times",
      "Close date has passed",
      "Engagement looks like the deals we lost (health score below 40)",
    ]);
    expect(texts(b.swot.opportunities)).toContain(
      "No exec-level contact yet: bring in the economic buyer before pricing",
    );
    expect(b.gaps.slice(0, 2)).toEqual([
      "No company record linked to this deal in HubSpot.",
      "No contacts linked to this deal in HubSpot.",
    ]);
    expect(b.action?.play.flag).toBe("closeDatePassed");
  });

  test("distinguishes unreadable contacts from none, and flags long silence", () => {
    const b = brief({ contactCount: 2, activities: [activity("call", 20)] });
    expect(b.gaps).toContain("Contacts are linked, but their names and titles couldn't be read.");
    expect(texts(b.swot.weaknesses)).toContain("No activity for 20 days");
  });

  test("quotes what the buyer said and drops the no-notes gap", () => {
    const b = brief({
      activities: [{ ...activity("call", 3), text: "Ana: The price is too high." }],
    });
    expect(b.heard.map((m) => [m.topic, m.speaker, m.quote])).toEqual([
      ["price", "Ana", "The price is too high."],
    ]);
    expect(b.gaps).not.toContain(NO_CALL_NOTES);
  });
});
