import Link from "next/link";
import { ActionCard } from "@/components/ActionCard";
import { Notice } from "@/components/ui";
import { pageData } from "@/lib/data";

const THEN_LIMIT = 4;

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await pageData();
  if (!data) return null;
  const sp = await searchParams;
  const reps = [...new Set(data.deals.flatMap((d) => (d.deal.owner ? [d.deal.owner] : [])))].sort();
  const rep = typeof sp.rep === "string" && reps.includes(sp.rep) ? sp.rep : null;
  const actions = data.actions.filter((a) => rep === null || a.deal.deal.owner === rep);
  const [first, ...rest] = actions;

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Your one thing today</h1>

      {reps.length > 0 && (
        <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Choose rep">
          {[null, ...reps].map((name) => (
            <Link
              key={name ?? "all"}
              href={name ? `/today?${new URLSearchParams({ rep: name })}` : "/today"}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                name === rep
                  ? "bg-accent text-on-accent"
                  : "bg-surface-alt text-muted hover:text-ink"
              }`}
            >
              {name ?? "Everyone"}
            </Link>
          ))}
        </nav>
      )}

      <div className="mt-6">
        {first ? (
          <ActionCard action={first} currency={data.currency} variant="hero" />
        ) : (
          <Notice>Nothing urgent: every open deal is healthy.</Notice>
        )}
      </div>

      {rest.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">Then</h2>
          <div className="card mt-3 divide-y divide-line overflow-hidden">
            {rest.slice(0, THEN_LIMIT).map((a) => (
              <ActionCard key={a.deal.deal.id} action={a} currency={data.currency} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
