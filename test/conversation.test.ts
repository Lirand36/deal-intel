import { describe, expect, test } from "vitest";
import { hasConversations, latestByTopic, mentionsIn } from "@/core/conversation";
import type { Activity } from "@/core/types";
import { daysAgo } from "./fixtures";

const call = (id: string, ago: number, text: string | null): Activity => ({
  id,
  type: "call",
  at: daysAgo(ago),
  text,
});

describe("mentionsIn", () => {
  test("finds buyer topics with the quote and speaker, ignoring the rep", () => {
    const found = mentionsIn([
      call(
        "1",
        10,
        "Rep: Our pricing is simple.\nMaya: Right now we do this by hand. Our CFO wants the ROI first.",
      ),
    ]);
    expect(found.map((m) => [m.topic, m.speaker, m.quote])).toEqual([
      ["pain", "Maya", "Right now we do this by hand."],
      ["economicBuyer", "Maya", "Our CFO wants the ROI first."],
    ]);
  });

  test("reads unlabelled notes and keeps the speaker across lines", () => {
    const found = mentionsIn([
      call("1", 3, "They are also evaluating another vendor."),
      call(
        "2",
        5,
        "Tom: We need this live before the end of the quarter.\nIt feels expensive though.",
      ),
    ]);
    expect(found.map((m) => [m.topic, m.speaker])).toEqual([
      ["timeline", "Tom"],
      ["price", "Tom"],
      ["competitor", null],
    ]);
  });

  test("handles activities without text", () => {
    expect(mentionsIn([call("1", 1, null)])).toEqual([]);
  });
});

describe("latestByTopic and hasConversations", () => {
  test("keeps the newest mention per topic", () => {
    const latest = latestByTopic(
      mentionsIn([call("1", 20, "Ana: It's too expensive."), call("2", 2, "Ana: Any discount?")]),
    );
    expect(latest.price?.quote).toBe("Any discount?");
  });

  test("only calls and meetings with text count as conversations", () => {
    expect(hasConversations([call("1", 1, "  ")])).toBe(false);
    expect(hasConversations([{ id: "n", type: "note", at: daysAgo(1), text: "x" }])).toBe(false);
    expect(hasConversations([call("1", 1, "Ana: hi")])).toBe(true);
  });
});
