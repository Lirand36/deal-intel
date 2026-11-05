export type Outcome = "won" | "lost" | "open";
export type ActivityType = "note" | "call" | "meeting" | "email";

export interface Activity {
  readonly id: string;
  readonly type: ActivityType;
  readonly at: Date;
  /** Logged notes or transcript, when the source has any. */
  readonly text: string | null;
}

export interface Stage {
  readonly id: string;
  readonly label: string;
  readonly order: number;
  readonly probability: number;
}

export interface Company {
  readonly name: string;
  readonly domain: string | null;
  readonly industry: string | null;
  readonly employees: number | null;
  readonly country: string | null;
  readonly description: string | null;
}

export interface Contact {
  readonly id: string;
  readonly name: string;
  readonly title: string | null;
}

/** A deal as the engine sees it: already mapped from HubSpot, no API shapes. */
export interface Deal {
  readonly id: string;
  readonly name: string;
  readonly amount: number | null;
  readonly stageId: string;
  readonly outcome: Outcome;
  readonly probability: number;
  readonly createdAt: Date;
  readonly closeDate: Date | null;
  readonly closeDateChanges: number;
  readonly contactCount: number;
  readonly contacts: readonly Contact[];
  readonly company: Company | null;
  readonly owner: string | null;
  readonly activities: readonly Activity[];
  readonly nextStep: string | null;
  readonly lostReason: string | null;
  readonly url: string;
}

export type SignalKey =
  | "contacts"
  | "recentActivity"
  | "meetings"
  | "daysSinceActivity"
  | "closeDateSlips"
  | "nextStep";

export type SignalValues = Readonly<Record<SignalKey, number>>;

export type Tier = "healthy" | "watch" | "atRisk";

export type RiskFlag =
  | "singleThreaded"
  | "goingDark"
  | "noMeetings"
  | "closeDatePassed"
  | "repeatedSlips"
  | "noNextStep"
  | "competitor"
  | "priceObjection";

export interface ScoredDeal {
  readonly deal: Deal;
  readonly asOf: Date;
  readonly ageDays: number;
  readonly signals: SignalValues;
  readonly points: SignalValues;
  readonly score: number;
  readonly tier: Tier;
  readonly flags: readonly RiskFlag[];
}
