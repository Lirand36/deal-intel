import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-sm text-muted">
        That deal isn't in HubSpot any more, or the link is wrong.
      </p>
      <Link href="/deals" className="btn-ghost text-xs">
        Back to deals
      </Link>
    </main>
  );
}
