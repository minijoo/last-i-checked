"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/stocks", label: "Stocks" },
  { href: "/weather", label: "Weather" },
  { href: "/settings", label: "Settings" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex w-full max-w-3xl items-center gap-1 px-4">
        <Link
          href="/"
          className="mr-3 py-3 text-sm font-semibold tracking-tight"
        >
          Last I Checked
        </Link>
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`border-b-2 px-3 py-3 text-sm transition-colors ${
                active
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
