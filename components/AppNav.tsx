"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNav() {
  const pathname = usePathname();
  const onSettings = pathname === "/settings" || pathname.startsWith("/settings/");
  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Last I Checked
        </Link>
        <Link
          href="/settings"
          aria-current={onSettings ? "page" : undefined}
          className={`text-sm transition-colors ${
            onSettings
              ? "font-medium text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          Settings
        </Link>
      </nav>
    </header>
  );
}
