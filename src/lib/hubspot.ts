import type { z } from "zod";
import type { Deal, Stage } from "@/core/types";
import {
  ACTIVITY_OBJECTS,
  ACTIVITY_TEXT,
  type ActivityObject,
  accountSchema,
  activityDetails,
  associatedIds,
  type BatchRead,
  batchReadSchema,
  COMPANY_PROPERTIES,
  CONTACT_PROPERTIES,
  DEAL_PROPERTIES,
  dealPageSchema,
  ownersSchema,
  pipelinesSchema,
  type RawDeal,
  toCompanies,
  toContacts,
  toDeal,
  toOwners,
  toStages,
} from "./normalize";

const API = "https://api.hubapi.com";
/** HubSpot caps list pages at 50 when property history is requested. */
const PAGE_SIZE = 50;
const BATCH_SIZE = 100;
const MAX_DEALS = 5_000;

export class HubSpotError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface HubSpotClient {
  get<T>(path: string, schema: z.ZodType<T>): Promise<T>;
  post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T>;
}

export function createClient(token: string, fetchImpl: typeof fetch = fetch): HubSpotClient {
  async function call<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
    const res = await fetchImpl(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new HubSpotError(
        `HubSpot ${init.method ?? "GET"} ${path} failed: ${detail}`,
        res.status,
      );
    }
    return schema.parse(await res.json());
  }
  return {
    get: (path, schema) => call(path, { method: "GET" }, schema),
    post: (path, body, schema) =>
      call(path, { method: "POST", body: JSON.stringify(body) }, schema),
  };
}

async function listDeals(client: HubSpotClient): Promise<RawDeal[]> {
  const query = new URLSearchParams({
    limit: String(PAGE_SIZE),
    properties: DEAL_PROPERTIES.join(","),
    propertiesWithHistory: "closedate",
    associations: ["contacts", "companies", ...Object.keys(ACTIVITY_OBJECTS)].join(","),
  });
  const deals: RawDeal[] = [];
  let after: string | undefined;
  do {
    const page = await client.get(
      `/crm/v3/objects/deals?${query}${after ? `&after=${after}` : ""}`,
      dealPageSchema,
    );
    deals.push(...page.results);
    after = page.paging?.next?.after;
  } while (after && deals.length < MAX_DEALS);
  return deals;
}

async function batchRead(
  client: HubSpotClient,
  object: string,
  ids: readonly string[],
  properties: readonly string[],
): Promise<BatchRead> {
  const batches = Array.from({ length: Math.ceil(ids.length / BATCH_SIZE) }, (_, i) =>
    ids.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE),
  );
  const results = await Promise.all(
    batches.map((batch) =>
      client.post(
        `/crm/v3/objects/${object}/batch/read`,
        { inputs: batch.map((id) => ({ id })), properties },
        batchReadSchema,
      ),
    ),
  );
  return { results: results.flatMap((r) => r.results) };
}

/** Owner names need their own scope; without it deals simply show no owner. */
async function readOwners(client: HubSpotClient): Promise<Map<string, string>> {
  try {
    return toOwners(await client.get("/crm/v3/owners?limit=500", ownersSchema));
  } catch (error) {
    if (error instanceof HubSpotError && error.status === 403) {
      console.warn("[deal-intel] Token lacks crm.objects.owners.read; deals will show no owner");
      return new Map();
    }
    throw error;
  }
}

export interface CrmSnapshot {
  readonly deals: readonly Deal[];
  readonly stages: readonly Stage[];
  readonly currency: string;
  readonly fetchedAt: Date;
}

export async function fetchSnapshot(client: HubSpotClient): Promise<CrmSnapshot> {
  const [pipelines, account, rawDeals] = await Promise.all([
    client.get("/crm/v3/pipelines/deals", pipelinesSchema),
    client.get("/account-info/v3/details", accountSchema),
    listDeals(client),
  ]);
  const idsOf = (key: string) => [...new Set(rawDeals.flatMap((d) => associatedIds(d, key)))];
  const objects = Object.keys(ACTIVITY_OBJECTS) as ActivityObject[];
  const [times, companies, contacts, owners] = await Promise.all([
    Promise.all(
      objects.map(async (o) => {
        const text = ACTIVITY_TEXT[o];
        const raw = await batchRead(
          client,
          o,
          idsOf(o),
          text ? ["hs_timestamp", text] : ["hs_timestamp"],
        );
        return activityDetails(raw, text);
      }),
    ),
    batchRead(client, "companies", idsOf("companies"), COMPANY_PROPERTIES),
    batchRead(client, "contacts", idsOf("contacts"), CONTACT_PROPERTIES),
    readOwners(client),
  ]);
  const ctx = {
    activities: new Map(times.flatMap((t) => [...t])),
    companies: toCompanies(companies),
    contacts: toContacts(contacts),
    owners,
    recordUrl: (id: string) =>
      `https://${account.uiDomain}/contacts/${account.portalId}/record/0-3/${id}`,
  };
  return {
    deals: rawDeals.map((d) => toDeal(d, ctx)),
    stages: toStages(pipelines),
    currency: account.companyCurrency ?? "USD",
    fetchedAt: new Date(),
  };
}
