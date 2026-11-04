export type Outcome = "won" | "lost" | "open";
export type ActivityType = "note" | "call" | "meeting" | "email";

export interface Activity {
  readonly id: string;
  readonly type: ActivityType;
  readonly at: Date;
}

export interface Stage {
  readonly id: string;
  readonly label: string;
  readonly order: number;
  readonly probability: number;
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
  | "noNextStep";

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
