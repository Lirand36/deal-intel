/**
 * Writes made-up deals, contacts, meetings, calls and notes into a test HubSpot portal.
 * Every deal is tagged so `npm run unseed` can remove exactly what this created.
 *
 *   HUBSPOT_TOKEN=pat-... npm run seed
 */

import { generateSeed, SEED_TAG, type SeedActivity, type SeedDeal } from "../src/core/seedData";
import { type Api, batchCreate, createApi, findSeededDealIds, requireToken } from "./api";

// HubSpot-defined association type ids.
const ASSOC = {
  dealToContact: 3,
  dealToCompany: 5,
  noteToDeal: 214,
  noteToContact: 202,
  callToDeal: 206,
  callToContact: 194,
  meetingToDeal: 212,
  meetingToContact: 200,
} as const;

const MEETING_MINUTES = 45;
const CALL_MS = 15 * 60 * 1000;

const to = (id: string, typeId: number) => ({
  to: { id },
  types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: typeId }],
});

function activityInput(a: SeedActivity, dealId: string, contactId: string | undefined) {
  const at = a.at.toISOString();
  const [toDeal, toContact, properties] =
    a.type === "meeting"
      ? [
          ASSOC.meetingToDeal,
          ASSOC.meetingToContact,
          {
            hs_meeting_title: a.title,
            hs_meeting_body: a.body,
            hs_meeting_start_time: at,
            hs_meeting_end_time: new Date(a.at.getTime() + MEETING_MINUTES * 60_000).toISOString(),
            hs_meeting_outcome: "COMPLETED",
          },
        ]
      : a.type === "call"
        ? [
            ASSOC.callToDeal,
            ASSOC.callToContact,
            {
              hs_call_title: a.title,
              hs_call_body: a.body,
              hs_call_status: "COMPLETED",
              hs_call_direction: "OUTBOUND",
              hs_call_duration: String(CALL_MS),
            },
          ]
        : [ASSOC.noteToDeal, ASSOC.noteToContact, { hs_note_body: a.body }];
  return {
    properties: { hs_timestamp: at, ...properties },
    associations: [to(dealId, toDeal), ...(contactId ? [to(contactId, toContact)] : [])],
  };
}

const OBJECT_FOR = { meeting: "meetings", call: "calls", note: "notes" } as const;

async function seed(api: Api, deals: SeedDeal[]): Promise<void> {
  const uniqueCompanies = [...new Map(deals.map((d) => [d.company, d])).values()];
  const companies = await batchCreate(
    api,
    "companies",
    uniqueCompanies.map((d) => ({
      properties: {
        name: d.company,
        // Industry is a fixed HubSpot enum, so it stays out; the description names it instead.
        domain: d.firmographics.domain ?? "",
        numberofemployees: String(d.firmographics.employees ?? ""),
        country: d.firmographics.country ?? "",
        description: d.firmographics.description ?? "",
      },
    })),
  );
  const companyId = new Map(companies.map((c) => [c.properties.name ?? "", c.id]));
  console.log(`Created ${companies.length} companies`);

  const contacts = await batchCreate(
    api,
    "contacts",
    deals.flatMap((d) => d.contacts.map((c) => ({ properties: { ...c, company: d.company } }))),
  );
  const contactId = new Map(contacts.map((c) => [c.properties.email ?? "", c.id]));
  console.log(`Created ${contacts.length} contacts`);

  const created = await batchCreate(
    api,
    "deals",
    deals.map((d) => ({
      properties: {
        dealname: d.dealname,
        amount: String(d.amount),
        pipeline: "default",
        dealstage: d.stage,
        createdate: d.createdAt.toISOString(),
        closedate: (d.closeDates[0] as Date).toISOString(),
        description: `Test data (${SEED_TAG})`,
        ...(d.nextStep ? { hs_next_step: d.nextStep } : {}),
        ...(d.lostReason ? { closed_lost_reason: d.lostReason } : {}),
      },
      associations: [
        ...d.contacts.flatMap((c) => {
          const id = contactId.get(c.email);
          return id ? [to(id, ASSOC.dealToContact)] : [];
        }),
        ...(companyId.has(d.company)
          ? [to(companyId.get(d.company) as string, ASSOC.dealToCompany)]
          : []),
      ],
    })),
  );
  const dealId = new Map(created.map((d) => [d.properties.dealname ?? "", d.id]));
  console.log(`Created ${created.length} deals`);

  // Each later close date is a slip; writing them in order leaves that trail in property history.
  const maxSlips = Math.max(...deals.map((d) => d.closeDates.length - 1));
  for (let round = 1; round <= maxSlips; round++) {
    const inputs = deals.flatMap((d) => {
      const date = d.closeDates[round];
      const id = dealId.get(d.dealname);
      return date && id ? [{ id, properties: { closedate: date.toISOString() } }] : [];
    });
    await api("POST", "/crm/v3/objects/deals/batch/update", { inputs });
  }
  console.log(`Recorded close date slips (${maxSlips} rounds)`);

  for (const type of ["meeting", "call", "note"] as const) {
    const inputs = deals.flatMap((d) => {
      const id = dealId.get(d.dealname);
      const firstContact = d.contacts[0] && contactId.get(d.contacts[0].email);
      return id
        ? d.activities.filter((a) => a.type === type).map((a) => activityInput(a, id, firstContact))
        : [];
    });
    const made = await batchCreate(api, OBJECT_FOR[type], inputs);
    console.log(`Created ${made.length} ${OBJECT_FOR[type]}`);
  }
}

async function main(): Promise<void> {
  const api = createApi(requireToken());
  const existing = await findSeededDealIds(api, SEED_TAG);
  if (existing.length > 0) {
    console.error(`${existing.length} seeded deals already exist. Run \`npm run unseed\` first.`);
    process.exit(1);
  }
  await seed(api, generateSeed(new Date()));
  console.log("Done. Open the dashboard and press Refresh.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
