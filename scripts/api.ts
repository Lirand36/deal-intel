/** Minimal HubSpot write client for the seed scripts. Reads HUBSPOT_TOKEN from the environment. */

const API = "https://api.hubapi.com";
export const BATCH_SIZE = 100;

export function requireToken(): string {
  const token = process.env.HUBSPOT_TOKEN?.trim();
  if (!token) {
    console.error("Set HUBSPOT_TOKEN to a HubSpot private app token first (see README).");
    process.exit(1);
  }
  return token;
}

export type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

export function createApi(token: string): Api {
  return async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
    return (res.status === 204 ? undefined : await res.json()) as T;
  };
}

export function chunks<T>(list: readonly T[], size = BATCH_SIZE): T[][] {
  return Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, (i + 1) * size),
  );
}

export interface Created {
  id: string;
  properties: Record<string, string | null>;
}

/** Batch-creates objects, 100 at a time, and returns them (in no guaranteed order). */
export async function batchCreate(
  api: Api,
  object: string,
  inputs: readonly unknown[],
): Promise<Created[]> {
  const out: Created[] = [];
  for (const batch of chunks(inputs)) {
    const res = await api<{ results: Created[] }>(
      "POST",
      `/crm/v3/objects/${object}/batch/create`,
      {
        inputs: batch,
      },
    );
    out.push(...res.results);
  }
  return out;
}

export async function findSeededDealIds(api: Api, tag: string): Promise<string[]> {
  const ids: string[] = [];
  let after: string | undefined;
  do {
    const res = await api<{ results: { id: string }[]; paging?: { next?: { after: string } } }>(
      "POST",
      "/crm/v3/objects/deals/search",
      {
        filterGroups: [
          { filters: [{ propertyName: "description", operator: "CONTAINS_TOKEN", value: tag }] },
        ],
        properties: ["dealname"],
        limit: 100,
        ...(after ? { after } : {}),
      },
    );
    ids.push(...res.results.map((r) => r.id));
    after = res.paging?.next?.after;
  } while (after);
  return ids;
}
