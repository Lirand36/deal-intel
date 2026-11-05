"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions";
import { Logo } from "./Logo";

const SECTIONS = [
  {
    title: "Focus",
    links: [
      { href: "/", label: "Quarter" },
      { href: "/today", label: "My day" },
    ],
  },
  {
    title: "More",
    links: [
      { href: "/deals", label: "All deals" },
      { href: "/won-lost", label: "Won vs lost" },
      { href: "/pipeline", label: "Pipeline health" },
      { href: "/rubric", label: "Scoring rubric" },
    ],
  },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex shrink-0 flex-col border-side-line bg-side text-side-text md:sticky md:top-0 md:h-screen md:w-60 md:border-r">
      <div className="flex items-center justify-between px-4 py-4 md:block md:px-6 md:py-7">
        <Logo />
        <form action={logoutAction} className="md:hidden">
          <button type="submit" className="text-xs hover:text-ink">
            Sign out
          </button>
        </form>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:gap-5 md:overflow-visible md:px-4 md:pb-0">
        {SECTIONS.map((section) => (
          <div key={section.title} className="flex gap-1 md:flex-col md:gap-0.5">
            <div className="hidden px-3 pb-1 text-xs font-medium opacity-70 md:block">
              {section.title}
            </div>
            {section.links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm transition ${
                    active
                      ? "bg-surface font-semibold text-ink shadow-[0_1px_3px_rgba(64,50,52,0.08)]"
                      : "hover:bg-surface/60 hover:text-ink"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${active ? "bg-highlight" : "bg-transparent"}`}
                    aria-hidden="true"
                  />
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <form action={logoutAction} className="hidden border-t border-side-line px-6 py-4 md:block">
        <button type="submit" className="text-xs hover:text-ink">
          Sign out
        </button>
      </form>
    </aside>
  );
}
