/**
 * Builds a realistic, made-up sales history for a test HubSpot portal. Pure: the same seed and
 * date always give the same data. Won deals tend to be multi-threaded and busy right up to close,
 * lost deals tend to go quiet and slip, with enough exceptions that the signals aren't perfect.
 */

export const SEED_TAG = "dealintelseed";
export const SEED_EMAIL_DOMAIN = "example.com";

import type { Topic } from "./conversation";
import type { Company, Deal, Stage } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const SLIP_DAYS = 14;

export type SeedOutcome = "won" | "lost" | "open";
export type SeedActivityType = "note" | "call" | "meeting";
type OpenHealth = "healthy" | "watch" | "atRisk";

export interface SeedContact {
  readonly firstname: string;
  readonly lastname: string;
  readonly email: string;
  readonly jobtitle: string;
}

export interface SeedActivity {
  readonly type: SeedActivityType;
  readonly at: Date;
  readonly title: string;
  readonly body: string;
}

export interface SeedDeal {
  readonly dealname: string;
  readonly company: string;
  readonly amount: number;
  readonly stage: string;
  readonly outcome: SeedOutcome;
  readonly createdAt: Date;
  /** Close dates in order: the first is set on create, each later one is a slip. */
  readonly closeDates: readonly Date[];
  readonly nextStep: string | null;
  readonly lostReason: string | null;
  readonly contacts: readonly SeedContact[];
  readonly activities: readonly SeedActivity[];
  readonly firmographics: Omit<Company, "name">;
  /** Made-up rep name. Not written to HubSpot, which can't create owners. */
  readonly owner: string;
}

const INDUSTRIES = [
  "Financial services",
  "Healthcare",
  "Logistics",
  "Retail",
  "Manufacturing",
  "Software",
  "Energy",
  "Media",
];
const COUNTRIES = ["United States", "United Kingdom", "Germany", "Canada", "Netherlands", "Israel"];
const SIZES = [80, 240, 650, 1_400, 3_200, 8_500];
export const DEMO_REPS = ["Avery Cole", "Jordan Reyes", "Sam Whitfield", "Noa Levin"] as const;

/** Stable small hash so a company always gets the same made-up profile. */
function hashOf(text: string): number {
  return [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
}

export function firmographicsFor(company: string): Omit<Company, "name"> {
  const h = hashOf(company);
  const industry = INDUSTRIES[h % INDUSTRIES.length] as string;
  const slug = company.toLowerCase().replace(/[^a-z]+/g, "");
  return {
    domain: `${slug}.${SEED_EMAIL_DOMAIN}`,
    industry,
    employees: SIZES[(h >>> 3) % SIZES.length] as number,
    country: COUNTRIES[(h >>> 6) % COUNTRIES.length] as string,
    description: `${company} is a fictional ${industry.toLowerCase()} company used as test data.`,
  };
}

const COMPANIES = [
  "Brightwater Analytics",
  "Cobalt Ridge Logistics",
  "Halcyon Biotech",
  "Ironleaf Foods",
  "Juniper Freight",
  "Kestrel Robotics",
  "Lumen Harbor Bank",
  "Maplestone Insurance",
  "Northgate Medical",
  "Oakline Retail",
  "Pinecrest Energy",
  "Quarry Lane Media",
  "Redfern Mobility",
  "Silverpine Hotels",
  "Tidewater Utilities",
  "Umberfield Education",
  "Valemont Pharma",
  "Westbrook Telecom",
  "Yarrow Agritech",
  "Zephyr Aerospace",
  "Amberly Legal",
  "Bluecairn Software",
  "Copperfield Mining",
  "Driftwood Apparel",
  "Emberline Gaming",
  "Foxglove Health",
  "Granite Peak Capital",
  "Hollowell Construction",
  "Indigo Bay Travel",
  "Jasperwood Studios",
] as const;
const PRODUCTS = ["Platform", "Annual Contract", "Expansion", "Pilot", "Data Migration", "Renewal"];
const FIRST = [
  "Maya",
  "Daniel",
  "Priya",
  "Tom",
  "Lena",
  "Omar",
  "Grace",
  "Leo",
  "Nadia",
  "Sam",
  "Ivy",
  "Marco",
  "Hana",
  "Ben",
  "Zoe",
  "Arjun",
  "Clara",
  "Felix",
  "Ruth",
  "Kai",
];
const LAST = [
  "Okafor",
  "Lindqvist",
  "Ramos",
  "Chen",
  "Novak",
  "Haddad",
  "Brennan",
  "Sato",
  "Moreau",
  "Kowalski",
  "Adeyemi",
  "Fischer",
  "Patel",
  "Ortega",
  "Byrne",
  "Larsen",
];
const TITLES = [
  "VP Operations",
  "Head of IT",
  "CFO",
  "Procurement Lead",
  "Director of Engineering",
  "Security Manager",
  "COO",
  "Program Manager",
];
const LOST_REASONS = [
  "Chose a competitor",
  "Price too high",
  "No budget this year",
  "Went quiet / no decision",
  "Timing — revisit next year",
  "Missing integration",
];
const NEXT_STEPS = [
  "Security review with IT",
  "Send revised proposal",
  "Exec sponsor call",
  "Legal redlines on MSA",
  "Technical deep-dive",
  "Pricing approval from CFO",
];
const OPEN_STAGES = [
  "appointmentscheduled",
  "qualifiedtobuy",
  "presentationscheduled",
  "decisionmakerboughtin",
  "contractsent",
];
const NOTES = [
  "Discussed current process and pain points.",
  "Champion is pushing internally.",
  "Asked for references in their industry.",
  "Budget confirmed for this quarter.",
  "Concerns about rollout timeline.",
  "Shared ROI model with finance.",
];

export type Random = () => number;

/** Small deterministic PRNG (mulberry32). */
export function createRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function int(rand: Random, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function pick<T>(rand: Random, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)] as T;
}

function shift(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

interface Profile {
  contacts: [number, number];
  meetings: [number, number];
  others: [number, number];
  /** Days of silence before the as-of date (close date, or now for open deals). */
  quietDays: [number, number];
  slips: [number, number];
  nextStepChance: number;
}

const PROFILES: Record<"won" | "lost" | OpenHealth, Profile> = {
  won: {
    contacts: [2, 5],
    meetings: [2, 4],
    others: [3, 7],
    quietDays: [0, 6],
    slips: [0, 2],
    nextStepChance: 0.8,
  },
  lost: {
    contacts: [1, 2],
    meetings: [0, 1],
    others: [1, 4],
    quietDays: [12, 45],
    slips: [1, 3],
    nextStepChance: 0.3,
  },
  healthy: {
    contacts: [3, 5],
    meetings: [2, 4],
    others: [4, 8],
    quietDays: [0, 5],
    slips: [0, 0],
    nextStepChance: 1,
  },
  watch: {
    contacts: [1, 3],
    meetings: [1, 2],
    others: [1, 3],
    quietDays: [3, 21],
    slips: [0, 1],
    nextStepChance: 0.5,
  },
  atRisk: {
    contacts: [1, 1],
    meetings: [0, 1],
    others: [0, 2],
    quietDays: [18, 50],
    slips: [1, 3],
    nextStepChance: 0.1,
  },
};

type ProfileKey = keyof typeof PROFILES;

/**
 * Outcome mix for the default 38 deals. A few closed deals use the "watch" profile so that some
 * wins look shaky and some losses looked fine, the way real pipelines do.
 */
const PLAN: ReadonlyArray<readonly [SeedOutcome, ProfileKey, number]> = [
  ["won", "won", 10],
  ["won", "watch", 2],
  ["lost", "lost", 8],
  ["lost", "watch", 2],
  ["open", "healthy", 6],
  ["open", "watch", 5],
  ["open", "atRisk", 5],
];

/** `usedEmails` is shared across deals: HubSpot rejects two contacts with one email. */
function makeContacts(
  rand: Random,
  company: string,
  count: number,
  usedEmails: Set<string>,
): SeedContact[] {
  const slug = company.toLowerCase().replace(/[^a-z]+/g, "");
  return Array.from({ length: count }, () => {
    let first: string;
    let last: string;
    let email: string;
    do {
      first = pick(rand, FIRST);
      last = pick(rand, LAST);
      email = `${first}.${last}@${slug}.${SEED_EMAIL_DOMAIN}`.toLowerCase();
    } while (usedEmails.has(email));
    usedEmails.add(email);
    return { firstname: first, lastname: last, email, jobtitle: pick(rand, TITLES) };
  });
}

/** Buyer lines per topic. Fictional, but phrased the way buyers talk on real calls. */
const LINES: Readonly<Record<Topic, readonly string[]>> = {
  pain: [
    "Right now reconciling this by hand takes my team two days every month.",
    "We keep missing renewals because nothing flags them in time.",
    "Reporting is all spreadsheets and nobody trusts the numbers.",
  ],
  champion: [
    "I'll take this to our leadership meeting on Thursday.",
    "I'm happy to push this internally, I just need a one-pager.",
  ],
  economicBuyer: [
    "Our CFO wants to see the ROI before she signs off.",
    "I've looped in our VP, who owns the budget.",
  ],
  timeline: [
    "We need this live before the end of the quarter.",
    "Our contract with the current tool ends in March, so timing matters.",
  ],
  competitor: [
    "We're also looking at another vendor that came in lower.",
    "Honestly, the other tool we're evaluating has a nicer dashboard.",
  ],
  price: [
    "The price is higher than we budgeted for this year.",
    "Is there any flexibility on price? It feels expensive.",
  ],
};
const OPENERS = ["Thanks for making time today.", "Quick check-in on where things stand."];

/** Which topics each profile's buyers raise, and how likely each is. */
const TOPIC_ODDS: Readonly<Record<ProfileKey, Partial<Record<Topic, number>>>> = {
  won: { pain: 0.9, champion: 0.8, economicBuyer: 0.75, timeline: 0.7, competitor: 0.3 },
  lost: { pain: 0.5, champion: 0.25, economicBuyer: 0.2, price: 0.7, competitor: 0.6 },
  healthy: { pain: 1, champion: 1, timeline: 0.8, economicBuyer: 0.6 },
  watch: { pain: 0.7, competitor: 0.4, price: 0.4 },
  atRisk: { pain: 0.3, price: 0.5, competitor: 0.5 },
};
/** Objections go on the latest conversation, the rest from the first one on. */
const OBJECTIONS: ReadonlySet<Topic> = new Set(["price", "competitor"]);

/**
 * Turns call and meeting activities into short transcripts. Uses its own random stream (from the
 * deal name) so adding transcripts doesn't change any other generated value.
 */
function withTranscripts(
  dealname: string,
  profileKey: ProfileKey,
  contacts: readonly SeedContact[],
  activities: readonly SeedActivity[],
): SeedActivity[] {
  const rand = createRandom(hashOf(dealname));
  const talks = activities.flatMap((a, i) => (a.type === "note" ? [] : [i]));
  if (talks.length === 0) return [...activities];
  const topics = (Object.entries(TOPIC_ODDS[profileKey]) as [Topic, number][])
    .filter(([, odds]) => rand() < odds)
    .map(([topic]) => topic);
  const lineFor = new Map<number, string[]>();
  topics.forEach((topic, n) => {
    const slot = OBJECTIONS.has(topic)
      ? (talks.at(-1) as number)
      : (talks[n % talks.length] as number);
    const speaker = (contacts[n % contacts.length] as SeedContact).firstname;
    lineFor.set(slot, [...(lineFor.get(slot) ?? []), `${speaker}: ${pick(rand, LINES[topic])}`]);
  });
  return activities.map((a, i) =>
    talks.includes(i)
      ? { ...a, body: [`Rep: ${pick(rand, OPENERS)}`, ...(lineFor.get(i) ?? [])].join("\n") }
      : a,
  );
}

function makeActivities(rand: Random, profile: Profile, start: Date, asOf: Date): SeedActivity[] {
  const lastTouch = shift(asOf, -int(rand, ...profile.quietDays));
  const span = Math.max(1, Math.floor((lastTouch.getTime() - start.getTime()) / DAY_MS));
  const types: SeedActivityType[] = [
    ...Array<SeedActivityType>(int(rand, ...profile.meetings)).fill("meeting"),
    ...Array.from({ length: int(rand, ...profile.others) }, () =>
      rand() < 0.5 ? ("call" as const) : ("note" as const),
    ),
  ];
  return types
    .map((type, i) => {
      // The first activity sits on the last touch so the quiet period is exact.
      const at = i === 0 ? lastTouch : shift(lastTouch, -int(rand, 1, span));
      const note = pick(rand, NOTES);
      const title =
        type === "meeting"
          ? "Discovery / demo meeting"
          : type === "call"
            ? "Follow-up call"
            : "Deal note";
      return { type, at, title, body: note };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

function closeDatesFor(rand: Random, finalClose: Date, profile: Profile): Date[] {
  const slips = int(rand, ...profile.slips);
  return Array.from({ length: slips + 1 }, (_, i) => shift(finalClose, -(slips - i) * SLIP_DAYS));
}

function makeDeal(
  rand: Random,
  now: Date,
  company: string,
  outcome: SeedOutcome,
  profileKey: ProfileKey,
  usedEmails: Set<string>,
  owner: string,
): SeedDeal {
  const profile = PROFILES[profileKey];
  const amount = Math.round(int(rand, 8_000, 150_000) / 500) * 500;
  const cycle = int(rand, 30, 120);
  let createdAt: Date;
  let finalClose: Date;
  let stage: string;
  if (outcome === "open") {
    createdAt = shift(now, -int(rand, 20, 110));
    // At-risk deals often have a close date that has already passed.
    finalClose =
      profileKey === "atRisk" && rand() < 0.6
        ? shift(now, -int(rand, 3, 20))
        : shift(now, int(rand, 10, 200));
    stage = pick(rand, OPEN_STAGES);
  } else {
    finalClose = shift(now, -int(rand, 5, 150));
    createdAt = shift(finalClose, -cycle);
    stage = outcome === "won" ? "closedwon" : "closedlost";
  }
  const asOf = outcome === "open" ? now : finalClose;
  const contacts = makeContacts(rand, company, int(rand, ...profile.contacts), usedEmails);
  const dealname = `${company} - ${pick(rand, PRODUCTS)}`;
  return {
    dealname,
    company,
    firmographics: firmographicsFor(company),
    owner,
    amount,
    stage,
    outcome,
    createdAt,
    closeDates: closeDatesFor(rand, finalClose, profile),
    nextStep: rand() < profile.nextStepChance ? pick(rand, NEXT_STEPS) : null,
    lostReason: outcome === "lost" ? pick(rand, LOST_REASONS) : null,
    contacts,
    activities: withTranscripts(
      dealname,
      profileKey,
      contacts,
      makeActivities(rand, profile, createdAt, asOf),
    ),
  };
}

export function generateSeed(now: Date, seed = 42): SeedDeal[] {
  const rand = createRandom(seed);
  const companies = [...COMPANIES].sort(() => rand() - 0.5);
  const slots = PLAN.flatMap(([outcome, profileKey, count]) =>
    Array.from({ length: count }, () => [outcome, profileKey] as const),
  );
  const usedEmails = new Set<string>();
  return slots
    .map(([outcome, profileKey], i) =>
      makeDeal(
        rand,
        now,
        companies[i % companies.length] as string,
        outcome,
        profileKey,
        usedEmails,
        DEMO_REPS[i % DEMO_REPS.length] as string,
      ),
    )
    .map((deal, i, all) => {
      // A company with two deals may draw the same product twice. Deal names must stay unique so
      // the seed script can match created records, so switch to a product that company lacks.
      const earlier = new Set(all.slice(0, i).map((d) => d.dealname));
      if (!earlier.has(deal.dealname)) return deal;
      const product = PRODUCTS.find((p) => !earlier.has(`${deal.company} - ${p}`));
      return { ...deal, dealname: `${deal.company} - ${product ?? `Deal ${i + 1}`}` };
    });
}

/** HubSpot's default sales pipeline, used when showing seed data without a portal. */
export const DEFAULT_STAGES: readonly Stage[] = [
  { id: "appointmentscheduled", label: "Appointment scheduled", order: 0, probability: 0.2 },
  { id: "qualifiedtobuy", label: "Qualified to buy", order: 1, probability: 0.4 },
  { id: "presentationscheduled", label: "Presentation scheduled", order: 2, probability: 0.6 },
  { id: "decisionmakerboughtin", label: "Decision maker bought-in", order: 3, probability: 0.8 },
  { id: "contractsent", label: "Contract sent", order: 4, probability: 0.9 },
  { id: "closedwon", label: "Closed won", order: 5, probability: 1 },
  { id: "closedlost", label: "Closed lost", order: 6, probability: 0 },
];

/** The deal the dashboard would read back from HubSpot after this seed is written. */
export function seedToDeal(seed: SeedDeal, index: number): Deal {
  const id = String(index + 1);
  return {
    id,
    name: seed.dealname,
    amount: seed.amount,
    stageId: seed.stage,
    outcome: seed.outcome,
    probability: DEFAULT_STAGES.find((s) => s.id === seed.stage)?.probability ?? 0,
    createdAt: seed.createdAt,
    closeDate: seed.closeDates.at(-1) ?? null,
    closeDateChanges: seed.closeDates.length - 1,
    contactCount: seed.contacts.length,
    contacts: seed.contacts.map((c, j) => ({
      id: `${id}-c${j}`,
      name: `${c.firstname} ${c.lastname}`,
      title: c.jobtitle,
    })),
    company: { name: seed.company, ...seed.firmographics },
    owner: seed.owner,
    activities: seed.activities.map((a, j) => ({
      id: `${id}-${j}`,
      type: a.type,
      at: a.at,
      text: a.body,
    })),
    nextStep: seed.nextStep,
    lostReason: seed.lostReason,
    url: "#",
  };
}
