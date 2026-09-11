"use client";

import { useState } from "react";
import type { ChangelogEntry } from "@/lib/changelog";
import { formatRelativeDate, formatStamp } from "@/lib/format";

/** True when every line in a paragraph looks like a trailer ("Key: value") —
 *  our commits always end with one (Co-Authored-By, Claude-Session). Those
 *  read better as separate lines than reflowed into a run-on sentence. */
function isTrailerBlock(paragraph: string): boolean {
  const lines = paragraph.split("\n").filter((l) => l.trim());
  return lines.length > 0 && lines.every((l) => /^[A-Za-z][\w-]*:\s/.test(l.trim()));
}

/**
 * One changelog row: relative (→ absolute past 7 days) date linking to the
 * commit, and its message — the first paragraph (the summary) always shown
 * in full, the rest collapsed behind "See details".
 */
export function ChangelogRow({ entry }: { entry: ChangelogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [summary, ...rest] = entry.message.trim().split(/\n\n+/);
  const detailParagraphs = rest;

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-border py-3 first:border-t-0 first:pt-0">
      <a
        href={entry.htmlUrl}
        target="_blank"
        rel="noreferrer"
        title={formatStamp(entry.date)}
        className="whitespace-nowrap text-xs text-muted underline decoration-dotted underline-offset-2 hover:text-foreground"
      >
        {formatRelativeDate(entry.date)}
      </a>
      <div className="min-w-0">
        <p className="text-sm leading-snug">{summary}</p>
        {expanded &&
          detailParagraphs.map((p, i) =>
            isTrailerBlock(p) ? (
              <p key={i} className="mt-2 text-xs text-muted">
                {p
                  .split("\n")
                  .filter((l) => l.trim())
                  .map((line, j) => (
                    <span key={j} className="block">
                      {line.trim()}
                    </span>
                  ))}
              </p>
            ) : (
              // Commit messages hard-wrap at ~72 chars for a terminal; letting
              // this reflow at the container's actual width (rather than
              // preserving those line breaks) reads much better here.
              <p key={i} className="mt-2 text-xs text-muted">
                {p.replace(/\s+/g, " ")}
              </p>
            ),
          )}
        {detailParagraphs.length > 0 && (
          <div className="mt-1 flex justify-end">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-muted underline hover:text-foreground"
            >
              {expanded ? "Hide details" : "See details"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
