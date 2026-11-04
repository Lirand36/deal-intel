import { z } from "zod";
import type { Activity, ActivityType, Deal, Outcome, Stage } from "@/core/types";

/** HubSpot association keys on a deal, and the activity type each one holds. */
export const ACTIVITY_OBJECTS = {
  notes: "note",
  calls: "call",
  meetings: "meeting",
  emails: "email",
} as const satisfies Record<string, ActivityType>;
export type ActivityObject = keyof typeof ACTIVITY_OBJECTS;

export const DEAL_PROPERTIES = [
  "dealname",
  "amount",
  "dealstage",
  "pipeline",
  "closedate",
  "createdate",
  "hs_is_closed",
  "hs_is_closed_won",
  "hs_deal_stage_probability",
  "hs_next_step",
  "closed_lost_reason",
] as const;

const props = z.record(z.string(), z.string().nullable().optional());
const assocList = z.object({ results: z.array(z.object({ id: z.string() })) });

export const pipelinesSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      displayOrder: z.number(),
      stages: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          displayOrder: z.number(),
          metadata: z.object({ probability: z.string().optional() }).loose(),
        }),
      ),
    }),
  ),
});

export const dealPageSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      properties: props,
      propertiesWithHistory: z
        .record(
          z.string(),
          z.array(z.object({ value: z.string().nullable().optional(), timestamp: z.string() })),
        )
        .optional(),
      associations: z.record(z.string(), assocList).optional(),
    }),
  ),
  paging: z.object({ next: z.object({ after: z.string() }).optional() }).optional(),
});
export type RawDeal = z.infer<typeof dealPageSchema>["results"][number];

export const batchReadSchema = z.object({
  results: z.array(z.object({ id: z.string(), properties: props })),
});

export const accountSchema = z.object({
  portalId: z.number(),
  uiDomain: z.string(),
  companyCurrency: z.string().optional(),
});

/** Pipelines are ordered first, then stages within them, so stage order is global. */
export function toStages(raw: z.infer<typeof pipelinesSchema>): Stage[] {
  const pipelines = [...raw.results].sort((a, b) => a.displayOrder - b.displayOrder);
  return pipelines.flatMap((pipeline, p) =>
    [...pipeline.stages]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((stage, s) => ({
        id: stage.id,
        label: pipelines.length > 1 ? `${pipeline.label} · ${stage.label}` : stage.label,
        order: p * 1000 + s,
        probability: toNumber(stage.metadata.probability) ?? 0,
      })),
  );
}

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function outcomeOf(p: Record<string, string | null | undefined>): Outcome {
  if (p.hs_is_closed_won === "true") return "won";
  return p.hs_is_closed === "true" ? "lost" : "open";
}

/** Number of times a value was replaced by a different one. History arrives newest first. */
export function countChanges(
  history: ReadonlyArray<{ value?: string | null | undefined }>,
): number {
  const values = history.map((h) => text(h.value)).filter((v): v is string => v !== null);
  return values.slice(1).filter((v, i) => v !== values[i]).length;
}

/** Ids of each associated object, deduplicated (HubSpot lists one row per association label). */
export function associatedIds(deal: RawDeal, key: string): string[] {
  return [...new Set(deal.associations?.[key]?.results.map((r) => r.id) ?? [])];
}

export interface DealContext {
  /** Activity timestamps by HubSpot object id. */
  readonly activityTimes: ReadonlyMap<string, Date>;
  readonly recordUrl: (dealId: string) => string;
}

export function toDeal(raw: RawDeal, ctx: DealContext): Deal {
  const p = raw.properties;
  const activities: Activity[] = (Object.keys(ACTIVITY_OBJECTS) as ActivityObject[]).flatMap(
    (key) =>
      associatedIds(raw, key).flatMap((id) => {
        const at = ctx.activityTimes.get(id);
        return at ? [{ id, type: ACTIVITY_OBJECTS[key], at }] : [];
      }),
  );
  return {
    id: raw.id,
    name: text(p.dealname) ?? `Deal ${raw.id}`,
    amount: toNumber(p.amount),
    stageId: p.dealstage ?? "",
    outcome: outcomeOf(p),
    probability: toNumber(p.hs_deal_stage_probability) ?? 0,
    createdAt: toDate(p.createdate) ?? new Date(0),
    closeDate: toDate(p.closedate),
    closeDateChanges: countChanges(raw.propertiesWithHistory?.closedate ?? []),
    contactCount: associatedIds(raw, "contacts").length,
    activities,
    nextStep: text(p.hs_next_step),
    lostReason: text(p.closed_lost_reason),
    url: ctx.recordUrl(raw.id),
  };
}

export function activityTimes(raw: z.infer<typeof batchReadSchema>): Map<string, Date> {
  return new Map(
    raw.results.flatMap((r) => {
      const at = toDate(r.properties.hs_timestamp);
      return at ? [[r.id, at] as const] : [];
    }),
  );
}
