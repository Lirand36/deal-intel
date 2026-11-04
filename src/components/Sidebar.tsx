"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/", label: "Pipeline health" },
  { href: "/deals", label: "Deals" },
  { href: "/won-lost", label: "Won vs lost" },
  { href: "/rubric", label: "Scoring rubric" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex shrink-0 flex-col border-side-line bg-side text-side-text md:sticky md:top-0 md:h-screen md:w-56 md:border-r">
      <div className="flex items-center justify-between px-4 py-4 md:block md:px-5 md:py-6">
        <Logo inverted />
        <form action={logoutAction} className="md:hidden">
          <button type="submit" className="text-xs hover:text-white">
            Sign out
          </button>
        </form>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium transition ${
              isActive(pathname, link.href)
                ? "bg-white/10 text-white"
                : "hover:bg-white/5 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <form action={logoutAction} className="hidden border-t border-side-line px-5 py-4 md:block">
        <button type="submit" className="text-xs hover:text-white">
          Sign out
        </button>
      </form>
    </aside>
  );
}
