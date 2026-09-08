"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAutocheckUnseen } from "@/lib/hooks";
import { store } from "@/lib/store";
import type { AutocheckCategory } from "@/lib/types";

const TABS: Array<{ href: string; label: string; cat: AutocheckCategory }> = [
  { href: "/stocks", label: "Stocks", cat: "stocks" },
  { href: "/weather", label: "Weather", cat: "weather" },
  { href: "/sportsbook", label: "Sportsbook", cat: "sportsbook" },
  { href: "/custom", label: "Custom", cat: "custom" },
];

/** Highlight fully collapsed to the left — used before we've measured, and on
 *  routes (home, settings) where neither tab is active. */
const HIDDEN_CLIP = "inset(50% 100% 50% 0 round 999px)";

function activeIndex(pathname: string): number {
  return TABS.findIndex(
    (t) => pathname === t.href || pathname.startsWith(t.href + "/"),
  );
}

/** Small green count of unseen autochecked changes for a tab. Rendered in both
 *  the base list and the (aria-hidden) highlight list so their widths match. */
function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-up px-1 text-[0.65rem] font-bold leading-none text-background">
      {n > 9 ? "9+" : n}
    </span>
  );
}

/**
 * Floating section switcher, pinned bottom-center. Two stacked copies of the
 * same list: the base layer is muted text; the highlight layer is drawn as if
 * every tab were active (filled pill, inverted text) and then clipped with an
 * animated `clip-path` to just the current tab. Technique: Stripe's blog header
 * (see css-animations skill, "clip-path: seamless tab highlight").
 */
export function PageSwitcher() {
  const pathname = usePathname();
  const active = activeIndex(pathname);
  const unseen = useAutocheckUnseen();

  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [clip, setClip] = useState(HIDDEN_CLIP);
  const [ready, setReady] = useState(false);

  // Opening a tab clears its "changed while you were away" badge.
  useEffect(() => {
    if (!unseen) return;
    const tab = TABS.find(
      (t) => pathname === t.href || pathname.startsWith(t.href + "/"),
    );
    if (tab && (unseen[tab.cat] ?? 0) > 0) {
      void store.setSetting("autocheckUnseen", { ...unseen, [tab.cat]: 0 });
    }
  }, [pathname, unseen]);

  useEffect(() => {
    function measure() {
      const list = listRef.current;
      const item = itemRefs.current[active];
      if (!list || !item) {
        setClip(HIDDEN_CLIP);
        return;
      }
      const l = list.getBoundingClientRect();
      const r = item.getBoundingClientRect();
      setClip(
        `inset(${r.top - l.top}px ${l.right - r.right}px ${
          l.bottom - r.bottom
        }px ${r.left - l.left}px round 999px)`,
      );
    }

    measure();
    const raf = requestAnimationFrame(() => setReady(true));
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [active, unseen]);

  return (
    <nav
      aria-label="Section"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center"
    >
      <div className="pointer-events-auto relative rounded-full border border-border bg-surface/80 shadow-lg shadow-black/5 backdrop-blur">
        <ul ref={listRef} className="flex items-center gap-1 p-1.5">
          {TABS.map((t, i) => (
            <li
              key={t.href}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
            >
              <Link
                href={t.href}
                aria-current={i === active ? "page" : undefined}
                className="flex items-center rounded-full px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                {t.label}
                <Badge n={unseen?.[t.cat] ?? 0} />
              </Link>
            </li>
          ))}
        </ul>

        <ul
          aria-hidden
          data-ready={ready}
          style={{ "--clip": clip } as CSSProperties}
          className="switch-highlight pointer-events-none absolute inset-0 flex items-center gap-1 p-1.5"
        >
          {TABS.map((t) => (
            <li key={t.href}>
              <span className="flex items-center rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background">
                {t.label}
                <Badge n={unseen?.[t.cat] ?? 0} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
