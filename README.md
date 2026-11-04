# Deal Intel

Live deal health and win/loss signals from HubSpot. Every deal is scored 0–100 on six buyer
engagement signals (multi-threading, recent activity, meetings, days since last touch, close date
slips, next step). Closed deals are scored as they stood on their close date, so the Won vs lost
page shows which signals actually separate wins from losses in your pipeline.

## Pages

- **Pipeline health** — open pipeline, weighted value, win rate, stage breakdown and the deals that need attention.
- **Deals** — every deal with its score and risk flags; filter, sort, search, and drill into a deal.
- **Won vs lost** — signal medians for won vs lost deals, win rate when each signal is strong vs weak, loss reasons.
- **Scoring rubric** — exactly how points are given.

## HubSpot token

Create a private app in HubSpot (Settings → Integrations → Private apps) with these read scopes:
`crm.objects.deals.read`, `crm.objects.contacts.read`, `crm.schemas.deals.read`, plus notes, calls,
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

`npm run seed` writes 38 made-up deals (12 won, 10 lost, 16 open) with contacts, meetings, calls and
notes into the portal the token belongs to. Use a test portal. Every deal is tagged, and
`npm run unseed` moves exactly those records to HubSpot's recycle bin.

```bash
HUBSPOT_TOKEN=pat-... npm run seed
HUBSPOT_TOKEN=pat-... npm run unseed
```

## Deploy (Render)

New → Blueprint → pick this repo. Render reads `render.yaml`, generates `SESSION_SECRET` and asks
for `ADMIN_PASSWORD` (12+ characters) and `HUBSPOT_TOKEN`. Pushes to `main` redeploy.

## Develop

```bash
npm run lint && npm run typecheck && npm run test:coverage
```

The scoring engine in `src/core` is pure and fully tested; HubSpot I/O lives in `src/lib/hubspot.ts`,
and `src/lib/normalize.ts` validates and maps API responses.
