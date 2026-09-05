"use client";

import Link from "next/link";
import { runCustomFetch } from "@/lib/fetchers";
import { formatStamp } from "@/lib/format";
import { useCustomChecks } from "@/lib/hooks";
import { store } from "@/lib/store";
import type { TrackedCustom } from "@/lib/types";
import { FetchBar } from "./FetchBar";
import { Card } from "./ui";

/**
 * Standalone card for one tracked check, own Fetch button + own history
 * table. Used for text-valued checks, which are kept out of the home-page
 * matrix — a long text value in a shared date-column table would distort
 * every other row's column width.
 */
export function CustomCheckCard({ tracked }: { tracked: TrackedCustom }) {
  const checks = useCustomChecks(tracked.name);
  const rows = checks ? [...checks].reverse() : undefined; // newest first

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/custom/${encodeURIComponent(tracked.name)}`}
            className="font-semibold hover:underline"
          >
            {tracked.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted" title={tracked.url}>
            {tracked.url}
          </p>
          <p className="truncate font-mono text-xs text-muted" title={tracked.selector}>
            {tracked.selector}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-3">
          <FetchBar onFetch={() => runCustomFetch(tracked)} label="Fetch" />
          <button
            onClick={() => store.removeTrackedCustom(tracked.name)}
            className="text-xs text-muted hover:text-down"
            title="Stop tracking (keeps history)"
          >
            ×
          </button>
        </div>
      </div>

      {rows === undefined ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">No checks yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 pr-4 font-normal">When</th>
                <th className="py-1 font-normal">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="whitespace-nowrap py-1 pr-4 text-muted">
                    {formatStamp(c.checkedAt)}
                  </td>
                  <td
                    className={`whitespace-nowrap py-1 font-mono ${c.status === "error" ? "text-down" : ""}`}
                    title={c.status === "error" ? c.errorMessage : c.rawText}
                  >
                    {c.status === "error" ? (c.errorMessage ?? "error") : String(c.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
