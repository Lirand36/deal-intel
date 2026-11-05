import "server-only";
import { type Action, actionsFor } from "@/core/actions";
import {
  compareWonLost,
  type LossReason,
  lossReasons,
  type Summary,
  summarize,
  type WonLost,
} from "@/core/analysis";
import { forecast, type QuarterForecast } from "@/core/forecast";
import { scoreDeal } from "@/core/score";
import { DEFAULT_STAGES, generateSeed, seedToDeal } from "@/core/seedData";
import type { ScoredDeal, Stage } from "@/core/types";
import { type WinFactor, winFactors } from "@/core/winFactors";
import { requireSession } from "./auth";
import { demoMode, hubspotToken, quarterQuota } from "./env";
import { type CrmSnapshot, createClient, fetchSnapshot, HubSpotError } from "./hubspot";

const CACHE_MS = 5 * 60 * 1000;

export interface Dashboard {
  readonly deals: readonly ScoredDeal[];
  readonly stages: ReadonlyMap<string, Stage>;
  readonly summary: Summary;
  readonly wonLost: WonLost;
  readonly lossReasons: readonly LossReason[];
  readonly quarters: readonly QuarterForecast[];
  /** Open-deal actions, biggest impact first. */
  readonly actions: readonly Action[];
  readonly quota: number | null;
  readonly winFactors: readonly WinFactor[];
  readonly currency: string;
  readonly fetchedAt: Date;
  /** True when showing generated sample deals instead of HubSpot. */
  readonly demo: boolean;
}

export type DashboardResult = { ok: true; data: Dashboard } | { ok: false; error: string };

let cache: { at: number; promise: Promise<Dashboard> } | null = null;

function demoSnapshot(): CrmSnapshot {
  const now = new Date();
  return {
    deals: generateSeed(now).map(seedToDeal),
    stages: DEFAULT_STAGES,
    currency: "USD",
    fetchedAt: now,
  };
}

async function build(token: string | null): Promise<Dashboard> {
  const snapshot = token ? await fetchSnapshot(createClient(token)) : demoSnapshot();
  const now = new Date();
  const deals = snapshot.deals.map((d) => scoreDeal(d, now));
  return {
    deals,
    stages: new Map(snapshot.stages.map((s) => [s.id, s])),
    summary: summarize(deals, snapshot.stages),
    wonLost: compareWonLost(deals),
    lossReasons: lossReasons(deals),
    quarters: forecast(deals, now),
    actions: actionsFor(deals, now),
    quota: quarterQuota(),
    winFactors: winFactors(deals),
    currency: snapshot.currency,
    fetchedAt: snapshot.fetchedAt,
    demo: token === null,
  };
}

function explain(error: unknown): string {
  if (error instanceof HubSpotError && (error.status === 401 || error.status === 403))
    return "HubSpot rejected the token. Check HUBSPOT_TOKEN and that the private app has read access to deals, contacts, notes, calls, meetings and emails.";
  if (error instanceof HubSpotError && error.status === 429)
    return "HubSpot is rate-limiting requests. Wait a minute and refresh.";
  return "Couldn't load deals from HubSpot. Try Refresh; if it keeps failing, check the server logs.";
}

/** HubSpot data, scored. Cached for a few minutes so page changes don't refetch everything. */
export async function loadDashboard(): Promise<DashboardResult> {
  const token = hubspotToken();
  if (!token && !demoMode())
    return { ok: false, error: "HUBSPOT_TOKEN is not set, so there are no deals to show yet." };
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    cache = { at: Date.now(), promise: build(token) };
  }
  try {
    return { ok: true, data: await cache.promise };
  } catch (error) {
    cache = null;
    console.error("[deal-intel] HubSpot load failed", error);
    return { ok: false, error: explain(error) };
  }
}

export function clearDashboardCache(): void {
  cache = null;
}

/** For pages: checks the session, then returns the data (the layout shows any load error). */
export async function pageData(): Promise<Dashboard | null> {
  await requireSession();
  const result = await loadDashboard();
  return result.ok ? result.data : null;
}
