import Link from "next/link";
import type { Action } from "@/core/actions";
import { day, money } from "@/lib/format";

type Props = {
  action: Action;
  currency: string;
  /** "hero" for the one thing today; "row" for lists. */
  variant?: "hero" | "row";
};

export function ActionCard({ action, currency, variant = "row" }: Props) {
  const { deal } = action.deal;
  const meta = `${money(deal.amount, currency)} · closes ${day(deal.closeDate)}${deal.owner ? ` · ${deal.owner}` : ""}`;
  if (variant === "hero") {
    return (
      <Link
        href={`/deals/${deal.id}`}
        className="card group block border-highlight p-6 transition hover:shadow-[0_6px_24px_rgba(64,50,52,0.10)] md:p-8"
      >
        <div className="text-sm text-muted">{deal.name}</div>
        <div className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
          {action.play.title}
        </div>
        <p className="mt-2 text-base text-muted">{action.play.how}</p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted">{meta}</span>
          <span className="font-semibold group-hover:underline">Open brief →</span>
        </div>
      </Link>
    );
  }
  return (
    <Link
      href={`/deals/${deal.id}`}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5 transition hover:bg-surface-alt"
    >
      <div className="min-w-0">
        <div className="font-semibold">{action.play.title}</div>
        <div className="truncate text-sm text-muted">{deal.name}</div>
      </div>
      <div className="text-sm text-muted">{meta}</div>
    </Link>
  );
}
