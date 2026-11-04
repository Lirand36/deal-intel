import { describe, expect, test } from "vitest";
import {
  activityTimes,
  countChanges,
  dealPageSchema,
  pipelinesSchema,
  type RawDeal,
  toDeal,
  toStages,
} from "@/lib/normalize";

const ctx = {
  activityTimes: new Map([
    ["n1", new Date("2026-10-01T00:00:00Z")],
    ["m1", new Date("2026-10-05T00:00:00Z")],
  ]),
  recordUrl: (id: string) => `https://app.hubspot.com/contacts/9/record/0-3/${id}`,
};

const rawDeal = (overrides: Partial<RawDeal> = {}): RawDeal =>
  dealPageSchema.parse({
    results: [
      {
        id: "77",
        properties: {
          dealname: " Globex - ERP ",
          amount: "95000",
          dealstage: "contractsent",
          createdate: "2026-07-30T13:05:47.080Z",
          closedate: "2026-12-01T00:00:00Z",
          hs_is_closed: "false",
          hs_is_closed_won: "false",
          hs_deal_stage_probability: "0.9",
          hs_next_step: "",
          closed_lost_reason: null,
        },
        propertiesWithHistory: {
          closedate: [
            { value: "2026-12-01", timestamp: "3" },
            { value: "2026-11-15", timestamp: "2" },
            { value: "2026-11-01", timestamp: "1" },
          ],
        },
        associations: {
          contacts: { results: [{ id: "c1" }, { id: "c1" }, { id: "c2" }] },
          notes: { results: [{ id: "n1" }, { id: "missing" }] },
          meetings: { results: [{ id: "m1" }] },
        },
        ...overrides,
      },
    ],
  }).results[0] as RawDeal;

describe("toDeal", () => {
  test("maps HubSpot fields into a deal", () => {
    const deal = toDeal(rawDeal(), ctx);
    expect(deal).toMatchObject({
      id: "77",
      name: "Globex - ERP",
      amount: 95_000,
      outcome: "open",
      probability: 0.9,
      closeDateChanges: 2,
      contactCount: 2,
      nextStep: null,
      lostReason: null,
      url: "https://app.hubspot.com/contacts/9/record/0-3/77",
    });
    expect(deal.activities.map((a) => a.type).sort()).toEqual(["meeting", "note"]);
  });

  test("reads won and lost from HubSpot's closed flags", () => {
    const won = rawDeal({ properties: { hs_is_closed: "true", hs_is_closed_won: "true" } });
    const lost = rawDeal({ properties: { hs_is_closed: "true", hs_is_closed_won: "false" } });
    expect(toDeal(won, ctx).outcome).toBe("won");
    expect(toDeal(lost, ctx).outcome).toBe("lost");
  });

  test("tolerates missing and malformed values", () => {
    const deal = toDeal(
      rawDeal({ properties: { amount: "n/a", createdate: "garbage" }, associations: {} }),
      ctx,
    );
    expect(deal).toMatchObject({
      name: "Deal 77",
      amount: null,
      createdAt: new Date(0),
      closeDate: null,
      contactCount: 0,
      activities: [],
      stageId: "",
    });
  });
});

describe("countChanges", () => {
  test("counts only real changes and skips blanks", () => {
    expect(countChanges([])).toBe(0);
    expect(countChanges([{ value: "a" }, { value: "a" }, { value: "" }, { value: "b" }])).toBe(1);
  });
});

describe("toStages", () => {
  test("orders stages globally and prefixes pipeline names when there are several", () => {
    const raw = pipelinesSchema.parse({
      results: [
        {
          id: "p2",
          label: "Renewals",
          displayOrder: 1,
          stages: [{ id: "r1", label: "Open", displayOrder: 0, metadata: { probability: "0.5" } }],
        },
        {
          id: "default",
          label: "Sales",
          displayOrder: 0,
          stages: [
            { id: "b", label: "Proposal", displayOrder: 1, metadata: { probability: "0.6" } },
            { id: "a", label: "Discovery", displayOrder: 0, metadata: {} },
          ],
        },
      ],
    });
    expect(toStages(raw)).toEqual([
      { id: "a", label: "Sales · Discovery", order: 0, probability: 0 },
      { id: "b", label: "Sales · Proposal", order: 1, probability: 0.6 },
      { id: "r1", label: "Renewals · Open", order: 1000, probability: 0.5 },
    ]);
  });
});

describe("activityTimes", () => {
  test("keeps only activities with a valid timestamp", () => {
    const times = activityTimes({
      results: [
        { id: "1", properties: { hs_timestamp: "2026-10-01T00:00:00Z" } },
        { id: "2", properties: { hs_timestamp: null } },
      ],
    });
    expect([...times.keys()]).toEqual(["1"]);
  });
});
