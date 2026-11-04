# Deal Intel

Next.js dashboard that scores HubSpot deals. Read README.md first.

- `src/core` must stay pure (no I/O, no Next imports). Scoring rules live only in `src/core/rubric.ts`; pages read them from there.
- HubSpot responses are validated with zod in `src/lib/normalize.ts`; never use raw API shapes in pages or core.
- Every protected page and action calls `requireSession()` (pages via `pageData()`).
- Seed data must stay clearly fake (`*.example.com` contacts, tagged deals) so `unseed` can find it.
- Test first (vitest). Keep coverage >= 80%. Run: npm run lint && npm run typecheck && npm run test:coverage
