import type { z } from "zod";
import type { Deal, Stage } from "@/core/types";
import {
  ACTIVITY_OBJECTS,
  type ActivityObject,
  accountSchema,
  activityTimes,
  associatedIds,
  batchReadSchema,
  DEAL_PROPERTIES,
  dealPageSchema,
  pipelinesSchema,
  type RawDeal,
  toDeal,
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
    associations: ["contacts", ...Object.keys(ACTIVITY_OBJECTS)].join(","),
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

async function readTimestamps(
  client: HubSpotClient,
  object: ActivityObject,
  ids: readonly string[],
): Promise<Map<string, Date>> {
  const batches = Array.from({ length: Math.ceil(ids.length / BATCH_SIZE) }, (_, i) =>
    ids.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE),
  );
  const results = await Promise.all(
    batches.map((batch) =>
      client.post(
        `/crm/v3/objects/${object}/batch/read`,
        { inputs: batch.map((id) => ({ id })), properties: ["hs_timestamp"] },
        batchReadSchema,
      ),
    ),
  );
  return new Map(results.flatMap((r) => [...activityTimes(r)]));
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
  const objects = Object.keys(ACTIVITY_OBJECTS) as ActivityObject[];
  const times = await Promise.all(
    objects.map((object) =>
      readTimestamps(client, object, [
        ...new Set(rawDeals.flatMap((d) => associatedIds(d, object))),
      ]),
    ),
  );
  const ctx = {
    activityTimes: new Map(times.flatMap((m) => [...m])),
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
