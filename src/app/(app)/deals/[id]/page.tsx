import Link from "next/link";
import { notFound } from "next/navigation";
import { OutcomeBadge } from "@/components/ui";
import { buildBrief, type Claim, type Swot } from "@/core/brief";
import { TOPIC_LABELS } from "@/core/conversation";
import { storyFor, type Tone } from "@/core/story";
import { pageData } from "@/lib/data";
import { day, money } from "@/lib/format";

/** Strengths and weaknesses are the health story above; only these two add new information. */
const QUADRANTS: ReadonlyArray<readonly [keyof Swot, string]> = [
  ["opportunities", "Opportunities"],
  ["threats", "Threats"],
];

function TagChip({ tag }: { tag: Claim["tag"] }) {
  return tag === "evidence" ? (
    <span className="shrink-0 whitespace-nowrap rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-medium text-good">
      evidence
    </span>
  ) : (
    <span className="shrink-0 whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-ink">
      our read
    </span>
  );
}

const TONE_ICON: Record<Tone, { mark: string; className: string; label: string }> = {
  good: { mark: "✓", className: "bg-good-soft text-good", label: "Good" },
  neutral: { mark: "•", className: "bg-surface-alt text-muted", label: "Okay" },
  bad: { mark: "!", className: "bg-bad-soft text-bad", label: "Problem" },
};

function ToneIcon({ tone }: { tone: Tone }) {
  const icon = TONE_ICON[tone];
  return (
    <span
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${icon.className}`}
      role="img"
      aria-label={icon.label}
    >
      {icon.mark}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-all font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export default async function DealBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await pageData();
  if (!data) return null;
  const { id } = await params;
  const scored = data.deals.find((d) => d.deal.id === id);
  if (!scored) notFound();
  const { deal } = scored;
  const brief = buildBrief(scored, data.fetchedAt);
  const story = storyFor(scored);
  const source = data.demo ? "Demo data" : "HubSpot";

  return (
    <>
      <Link href="/today" className="text-sm text-muted hover:text-ink">
        ← My day
      </Link>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{deal.company?.name ?? deal.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <OutcomeBadge outcome={deal.outcome} />
            <span>{deal.name}</span>
            <span>·</span>
            <span className="tabular-nums">{money(deal.amount, data.currency)}</span>
            <span>·</span>
            <span>closes {day(deal.closeDate)}</span>
          </div>
        </div>
        {!data.demo && (
          <a
            href={deal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs"
          >
            Open in HubSpot ↗
          </a>
        )}
      </header>

      {brief.action && (
        <section className="mt-6 rounded-2xl bg-highlight/35 p-5">
          <div className="text-xs font-medium text-muted">Do this next</div>
          <div className="mt-1 text-xl font-bold">{brief.action.play.title}</div>
          <p className="mt-1 text-muted">{brief.action.play.how}</p>
        </section>
      )}

      <section className="card mt-6 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">{story.headline}</h2>
          <Link href="/rubric" className="text-xs text-muted hover:text-ink">
            How health is judged
          </Link>
        </div>
        <ul className="mt-4 space-y-2">
          {story.lines.map((l) => (
            <li key={l.text} className="flex items-start gap-2.5">
              <ToneIcon tone={l.tone} />
              <span>{l.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {brief.heard.length > 0 && (
        <section className="card mt-6 p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">What they said</h2>
            <span className="text-xs text-muted">From call notes · {source}</span>
          </div>
          <ul className="mt-4 space-y-3">
            {brief.heard.map((m) => (
              <li key={m.topic}>
                <div className="text-xs font-medium text-muted">{TOPIC_LABELS[m.topic]}</div>
                <blockquote className="mt-0.5">
                  “{m.quote}”
                  <span className="text-sm text-muted">
                    {" "}
                    · {m.speaker ?? "Buyer"}, {day(m.at)}
                  </span>
                </blockquote>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mt-6 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">Company</h2>
          <span className="text-xs text-muted">Source: {source}</span>
        </div>
        {brief.company ? (
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <Fact label="Industry" value={brief.company.industry} />
            <Fact
              label="Employees"
              value={brief.company.employees?.toLocaleString("en-US") ?? null}
            />
            <Fact label="Country" value={brief.company.country} />
            <Fact label="Website" value={brief.company.domain} />
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted">No company record linked to this deal.</p>
        )}
        <h3 className="mt-6 text-sm font-bold">Buying group</h3>
        {brief.buyingGroup.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {brief.buyingGroup.map((c) => (
              <li key={c.id} className="rounded-full bg-surface-alt px-3 py-1">
                {c.name}
                {c.title && <span className="text-muted"> · {c.title}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No contacts we can name.</p>
        )}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {QUADRANTS.map(([key, label]) => (
          <div key={key} className="card p-5">
            <h2 className="font-bold">{label}</h2>
            {brief.swot[key].length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nothing found.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {brief.swot[key].map((claim) => (
                  <li key={claim.text} className="flex items-start justify-between gap-3">
                    <span>{claim.text}</span>
                    <TagChip tag={claim.tag} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      <section className="mt-6 text-sm text-muted">
        <h2 className="font-bold text-ink">What this brief can't see</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {brief.gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
