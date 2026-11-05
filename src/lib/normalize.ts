import { z } from "zod";
import type { Activity, ActivityType, Company, Contact, Deal, Outcome, Stage } from "@/core/types";

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
  "hubspot_owner_id",
] as const;

export const COMPANY_PROPERTIES = [
  "name",
  "domain",
  "industry",
  "numberofemployees",
  "country",
  "description",
] as const;
export const CONTACT_PROPERTIES = ["firstname", "lastname", "jobtitle"] as const;

export const ownersSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      firstName: z.string().nullable().optional(),
      lastName: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
    }),
  ),
});

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
  readonly contacts: ReadonlyMap<string, Contact>;
  readonly companies: ReadonlyMap<string, Company>;
  /** Owner display names by HubSpot owner id. */
  readonly owners: ReadonlyMap<string, string>;
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
    contacts: associatedIds(raw, "contacts").flatMap((id) => {
      const contact = ctx.contacts.get(id);
      return contact ? [contact] : [];
    }),
    company:
      associatedIds(raw, "companies")
        .map((id) => ctx.companies.get(id))
        .find((c) => c !== undefined) ?? null,
    owner: (p.hubspot_owner_id && ctx.owners.get(p.hubspot_owner_id)) || null,
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

export type BatchRead = z.infer<typeof batchReadSchema>;

export function toCompanies(raw: BatchRead): Map<string, Company> {
  return new Map(
    raw.results.map((r) => [
      r.id,
      {
        name: text(r.properties.name) ?? `Company ${r.id}`,
        domain: text(r.properties.domain),
        industry: text(r.properties.industry),
        employees: toNumber(r.properties.numberofemployees),
        country: text(r.properties.country),
        description: text(r.properties.description),
      },
    ]),
  );
}

export function toContacts(raw: BatchRead): Map<string, Contact> {
  return new Map(
    raw.results.map((r) => {
      const name = [text(r.properties.firstname), text(r.properties.lastname)]
        .filter(Boolean)
        .join(" ");
      return [
        r.id,
        { id: r.id, name: name || `Contact ${r.id}`, title: text(r.properties.jobtitle) },
      ];
    }),
  );
}

export function toOwners(raw: z.infer<typeof ownersSchema>): Map<string, string> {
  return new Map(
    raw.results.map((o) => {
      const name = [text(o.firstName), text(o.lastName)].filter(Boolean).join(" ");
      return [o.id, name || text(o.email) || `Owner ${o.id}`];
    }),
  );
}
