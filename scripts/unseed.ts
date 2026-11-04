/**
 * Moves everything `npm run seed` created to HubSpot's recycle bin (restorable for 90 days):
 * the tagged deals, their meetings, calls and notes, and their @*.example.com contacts.
 *
 *   HUBSPOT_TOKEN=pat-... npm run unseed
 */

import { SEED_EMAIL_DOMAIN, SEED_TAG } from "../src/core/seedData";
import { type Api, chunks, createApi, findSeededDealIds, requireToken } from "./api";

async function associated(api: Api, toObject: string, dealIds: string[]): Promise<string[]> {
  const ids = new Set<string>();
  for (const batch of chunks(dealIds)) {
    const res = await api<{ results: { to: { toObjectId: number }[] }[] }>(
      "POST",
      `/crm/v4/associations/deals/${toObject}/batch/read`,
      { inputs: batch.map((id) => ({ id })) },
    );
    for (const r of res.results) for (const t of r.to) ids.add(String(t.toObjectId));
  }
  return [...ids];
}

async function seededContacts(api: Api, ids: string[]): Promise<string[]> {
  const keep: string[] = [];
  for (const batch of chunks(ids)) {
    const res = await api<{ results: { id: string; properties: { email?: string | null } }[] }>(
      "POST",
      "/crm/v3/objects/contacts/batch/read",
      { inputs: batch.map((id) => ({ id })), properties: ["email"] },
    );
    keep.push(
      ...res.results
        .filter((c) => c.properties.email?.endsWith(`.${SEED_EMAIL_DOMAIN}`))
        .map((c) => c.id),
    );
  }
  return keep;
}

async function archive(api: Api, object: string, ids: string[]): Promise<void> {
  for (const batch of chunks(ids)) {
    await api("POST", `/crm/v3/objects/${object}/batch/archive`, {
      inputs: batch.map((id) => ({ id })),
    });
  }
  console.log(`Archived ${ids.length} ${object}`);
}

async function main(): Promise<void> {
  const api = createApi(requireToken());
  const dealIds = await findSeededDealIds(api, SEED_TAG);
  if (dealIds.length === 0) {
    console.log("No seeded deals found.");
    return;
  }
  for (const object of ["meetings", "calls", "notes"]) {
    await archive(api, object, await associated(api, object, dealIds));
  }
  await archive(
    api,
    "contacts",
    await seededContacts(api, await associated(api, "contacts", dealIds)),
  );
  await archive(api, "deals", dealIds);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
