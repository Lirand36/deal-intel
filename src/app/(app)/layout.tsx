import { RefreshButton } from "@/components/RefreshButton";
import { Sidebar } from "@/components/Sidebar";
import { Notice } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { loadDashboard } from "@/lib/data";
import { ago } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const result = await loadDashboard();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-end gap-3 border-b border-line px-4 py-2.5 md:px-8">
          {result.ok && result.data.demo && (
            <span className="mr-auto rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn">
              Demo data
              <span className="hidden sm:inline"> — set HUBSPOT_TOKEN to use your pipeline</span>
            </span>
          )}
          {result.ok && (
            <span className="hidden text-xs text-muted sm:inline">
              {result.data.deals.length} deals · updated {ago(result.data.fetchedAt)}
            </span>
          )}
          <RefreshButton />
        </div>
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
          {result.ok ? children : <Notice tone="bad">{result.error}</Notice>}
        </main>
      </div>
    </div>
  );
}
