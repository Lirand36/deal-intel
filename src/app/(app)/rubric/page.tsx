import { PageHeader } from "@/components/ui";
import { type Band, RUBRIC, type SignalRule, TIER_THRESHOLDS } from "@/core/rubric";
import { requireSession } from "@/lib/auth";

type Tone = "good" | "neutral" | "bad";

const TONE_STYLE: Record<Tone, string> = {
  good: "bg-good-soft text-good",
  neutral: "bg-surface-alt text-muted",
  bad: "bg-bad-soft text-bad",
};

function toneOf(rule: SignalRule, band: Band): Tone {
  if (band.points === rule.max) return "good";
  return band.points === 0 ? "bad" : "neutral";
}

const FROM_CALLS: ReadonlyArray<readonly [Tone, string]> = [
  ["good", "The buyer describes a clear pain"],
  ["good", "Someone offers to push it internally"],
  ["good", "The budget owner is involved"],
  ["bad", "A competitor comes up"],
  ["bad", "The buyer pushes back on price"],
];

export default async function RubricPage() {
  await requireSession();
  return (
    <>
      <PageHeader
        title="How health is judged"
        intro="Every open deal is checked against the same few questions. Green helps, red hurts."
      />

      <ul className="card divide-y divide-line overflow-hidden">
        {RUBRIC.map((rule) => (
          <li key={rule.key} className="px-5 py-4">
            <div className="font-semibold">{rule.name}</div>
            <p className="mt-0.5 text-sm text-muted">{rule.why}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rule.bands.map((band) => (
                <span
                  key={band.label}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_STYLE[toneOf(rule, band)]}`}
                >
                  {band.label}
                </span>
              ))}
            </div>
          </li>
        ))}
        <li className="px-5 py-4">
          <div className="font-semibold">What the buyer says on calls</div>
          <p className="mt-0.5 text-sm text-muted">Read from call and meeting notes.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FROM_CALLS.map(([tone, text]) => (
              <span
                key={text}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_STYLE[tone]}`}
              >
                {text}
              </span>
            ))}
          </div>
        </li>
      </ul>

      <p className="mt-6 text-xs text-muted">
        Behind the scenes each check adds points out of 100: {TIER_THRESHOLDS.healthy}+ is healthy,{" "}
        {TIER_THRESHOLDS.watch}–{TIER_THRESHOLDS.healthy - 1} needs attention, below{" "}
        {TIER_THRESHOLDS.watch} is at risk. Competitor and price mentions in the last 30 days turn
        into actions rather than points. Closed deals aren't given a health label; they're only used
        to learn what wins.
      </p>
    </>
  );
}
