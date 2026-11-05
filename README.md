# Deal Intel

Quarter forecast, deal health and win/loss signals from HubSpot. Every deal is scored 0–100 on six buyer
engagement signals (multi-threading, recent activity, meetings, days since last touch, close date
slips, next step). Closed deals are scored as they stood on their close date, so the Won vs lost
page shows which signals actually separate wins from losses in your pipeline.

## Pages

One question per audience:

- **Quarter** (CRO / VP Sales) — will we hit quota this quarter, and which 3 deals decide it?
- **My day** (AE) — the one action to take today, and on which deal. Each action opens an
  **account brief**: company, buying group, and a SWOT where every line is tagged _evidence_ or
  _our read_, plus what the brief can't see (built on the `account-research-brief` skill).

Supporting pages under "More": all deals, won vs lost, pipeline health, scoring rubric.

Set `QUARTER_QUOTA` (a number, e.g. `900000`) to compare each quarter with its target.

## HubSpot token

Create a private app in HubSpot (Settings → Integrations → Private apps) with these read scopes:
`crm.objects.deals.read`, `crm.objects.contacts.read`, `crm.objects.companies.read`,
`crm.objects.owners.read`, `crm.schemas.deals.read`, plus notes, calls,
meetings and emails read access (`crm.objects.notes.read` etc., or `sales-email-read`). The seed
script also needs the matching **write** scopes for deals, contacts, notes, calls and meetings.

## Run locally

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev
```

Set `DEMO_DATA=1` and leave `HUBSPOT_TOKEN` empty to see the dashboard with generated sample deals.

## Test data

`npm run seed` writes 38 made-up deals (12 won, 10 lost, 16 open) with companies, contacts, meetings,
calls and notes into the portal the token belongs to. Use a test portal. Every deal is tagged, and
`npm run unseed` moves exactly those records to HubSpot's recycle bin.

```bash
HUBSPOT_TOKEN=pat-... npm run seed
HUBSPOT_TOKEN=pat-... npm run unseed
```

## Deploy (Render)

New → Blueprint → pick this repo. Render reads `render.yaml`, generates `SESSION_SECRET` and asks
for `ADMIN_PASSWORD` (12+ characters) and `HUBSPOT_TOKEN`. Leave the token empty to start on demo
data (`DEMO_DATA=1` is preset); add it later under Environment and the app switches to HubSpot.
Pushes to `main` redeploy.

## Develop

```bash
npm run lint && npm run typecheck && npm run test:coverage
```

The scoring engine in `src/core` is pure and fully tested; HubSpot I/O lives in `src/lib/hubspot.ts`,
and `src/lib/normalize.ts` validates and maps API responses.
