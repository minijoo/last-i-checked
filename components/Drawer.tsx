"use client";

// Generic bottom sheet: slides up from the edge of the screen, backdrop fades
// in step. See app/globals.css (.drawer-backdrop / .drawer-panel) for the
// actual motion — the panel's entrance uses @starting-style, so it needs no
// "mount closed, then flip" dance; its exit is a plain transition on an
// already-mounted element, driven by [data-state]. This component's only job
// is to keep the panel mounted long enough after closing for that exit
// transition to finish before actually removing it from the DOM.

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Must match the exit transition-duration in app/globals.css.
const CLOSE_MS = 260;

export function Drawer({
  open,
  onOpenChange,
  title,
  size = "default",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** "full" for content that can run long (lengthy dropdowns, result lists):
   *  a fixed near-fullscreen height, so there's room for them right away
   *  rather than only once enough content has piled up to earn it. */
  size?: "default" | "full";
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  // Portals need `document`, which doesn't exist during SSR — defer to after
  // mount, same as any other client-only DOM access.
  const [canPortal, setCanPortal] = useState(false);

  // One-time flag: `document` isn't available during SSR, so the portal
  // target is only safe to touch once we know we're actually in the browser.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCanPortal(true), []);

  // Mounted state is a small lifecycle machine driven by the external `open`
  // signal, not something derivable during render: opening mounts right away,
  // but closing has to *stay* mounted for CLOSE_MS so the exit transition
  // gets to play before the node is actually removed.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const t = setTimeout(() => setMounted(false), CLOSE_MS);
    return () => clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Lock page scroll for as long as the sheet is on screen, including while
  // it's animating closed.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  if (!mounted || !canPortal) return null;

  return createPortal(
    <div
      data-state={open ? "open" : "closed"}
      className="drawer-backdrop fixed inset-0 z-50 bg-black/50"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-state={open ? "open" : "closed"}
        className={`drawer-panel fixed inset-x-0 bottom-0 z-50 flex ${
          // "full" is a fixed near-fullscreen height, not just a cap — content
          // like an open Combobox dropdown needs real room to render into
          // from the start, not only once enough content has piled up to
          // reach a max-height. "default" still hugs short content.
          size === "full" ? "h-[92vh]" : "max-h-[85vh]"
        } flex-col rounded-t-2xl border-t border-border bg-surface shadow-2xl shadow-black/20`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header stays put outside the scroll area — content below can run
         *  long (size="full") without carrying the title/close off screen. */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="text-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto p-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
