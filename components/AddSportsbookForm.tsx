"use client";

import { useEffect, useMemo, useState } from "react";
import { listEvents, listSports } from "@/lib/actions/sportsbook";
import { nowForCheck } from "@/lib/devtime";
import { useSportsbookAccess } from "@/lib/hooks";
import { marketLabel, marketsForSport } from "@/lib/sportsbook/markets";
import {
  DEFAULT_REGION,
  formatAmerican,
  formatPoint,
  makeTrackKey,
  REGIONS,
} from "@/lib/sportsbook";
import { chargedEventOdds, getUserOddsKey } from "@/lib/sportsbookCredits";
import { store } from "@/lib/store";
import type {
  OddsApiEvent,
  OddsApiEventOdds,
  OddsApiSport,
  TrackedSportsbook,
} from "@/lib/types";
import { Combobox, type ComboOption } from "./Combobox";
import { Button, Card, SectionTitle } from "./ui";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "Scheduled"
    : d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function eventTitle(e: {
  home_team: string | null;
  away_team: string | null;
  sport_title?: string;
}): string {
  return e.away_team && e.home_team
    ? `${e.away_team} @ ${e.home_team}`
    : (e.sport_title ?? "Futures");
}

function outcomeKey(bmKey: string, name: string, desc?: string): string {
  return `${bmKey}|${name}|${desc ?? ""}`;
}

export function AddSportsbookForm() {
  const [sports, setSports] = useState<OddsApiSport[] | null>(null);
  const [userKey, setUserKey] = useState<string | undefined>(undefined);
  const [topError, setTopError] = useState<string | null>(null);
  const access = useSportsbookAccess();
  const blocked = access?.blocked ?? false;

  const [sportKey, setSportKey] = useState<string | null>(null);
  const [events, setEvents] = useState<OddsApiEvent[] | null>(null);
  const [eventsBusy, setEventsBusy] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [marketKey, setMarketKey] = useState<string | null>(null);
  const [region, setRegion] = useState<string>(DEFAULT_REGION);

  const [busy, setBusy] = useState(false);
  const [odds, setOdds] = useState<OddsApiEventOdds | null>(null);
  const [oddsError, setOddsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const sport = useMemo(
    () => sports?.find((s) => s.key === sportKey) ?? null,
    [sports, sportKey],
  );
  const isOutright = sport?.has_outrights ?? false;

  useEffect(() => {
    let live = true;
    getUserOddsKey()
      .then((k) => {
        if (!live) return undefined;
        setUserKey(k);
        return listSports(k);
      })
      .then((res) => {
        if (!live || !res) return;
        if (res.ok) setSports(res.sports);
        else setTopError(res.error);
      });
    return () => {
      live = false;
    };
  }, []);

  // Picking a sport clears everything downstream and kicks off the event load.
  function chooseSport(key: string) {
    setSportKey(key);
    setEvents(null);
    setEventId(null);
    setMarketKey(null);
    setOdds(null);
    setOddsError(null);
    setSelected(new Set());
    setSavedMsg(null);
    setEventsBusy(true);
  }

  // The actual event fetch (async state updates only — no synchronous setState).
  useEffect(() => {
    if (!sportKey) return;
    const s = sports?.find((x) => x.key === sportKey);
    if (!s) return;
    let live = true;
    listEvents(s.key, userKey).then((res) => {
      if (!live) return;
      setEventsBusy(false);
      if (!res.ok) {
        setEvents([]);
        setOddsError(res.error);
        return;
      }
      setEvents(res.events);
      if (s.has_outrights) {
        setMarketKey("outrights");
        if (res.events.length <= 1) setEventId(res.events[0]?.id ?? "");
      }
    });
    return () => {
      live = false;
    };
  }, [sportKey, sports, userKey]);

  const sportOptions: ComboOption[] = useMemo(
    () =>
      (sports ?? []).map((s) => ({
        value: s.key,
        label: s.title,
        group: s.group,
        hint: s.has_outrights ? "futures" : undefined,
        search: [s.key, s.description, s.group],
      })),
    [sports],
  );

  const eventOptions: ComboOption[] = useMemo(
    () =>
      (events ?? []).map((e) => ({
        value: e.id,
        label: eventTitle(e),
        group: dayLabel(e.commence_time),
        hint: timeLabel(e.commence_time),
        search: [e.home_team ?? "", e.away_team ?? ""],
      })),
    [events],
  );

  const marketOptions: ComboOption[] = useMemo(
    () =>
      sport
        ? marketsForSport(sport.group, isOutright).map((m) => ({
            value: m.key,
            label: m.label,
            search: [m.key],
          }))
        : [],
    [sport, isOutright],
  );

  const showEventPicker = sport != null && (!isOutright || (events?.length ?? 0) > 1);
  const eventReady = isOutright || Boolean(eventId);
  const canLoad =
    sport != null &&
    marketKey != null &&
    eventReady &&
    !busy &&
    !eventsBusy &&
    !blocked;

  async function loadOutcomes() {
    if (!sport || !marketKey) return;
    setBusy(true);
    setOdds(null);
    setOddsError(null);
    setSelected(new Set());
    setSavedMsg(null);
    const res = await chargedEventOdds(sport.key, eventId ?? "", region, marketKey);
    setBusy(false);
    if (res.ok) {
      setOdds(res.odds);
      return;
    }
    setOddsError(
      res.kind === "invalid_combo" || res.kind === "invalid_market"
        ? `${marketLabel(marketKey)} isn't available for ${sport.title}.`
        : res.kind === "empty"
          ? `No book is posting ${marketLabel(marketKey)} for this event yet.`
          : res.error,
    );
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function trackSelected() {
    if (!odds || !sport || !marketKey || selected.size === 0) return;
    const name =
      odds.away_team && odds.home_team
        ? `${odds.away_team} @ ${odds.home_team}`
        : (events?.find((e) => e.id === eventId)?.sport_title ?? sport.title);
    const commenceTime = Date.parse(odds.commence_time) || Date.now();

    const rows: Array<Omit<TrackedSportsbook, "id" | "addedAt">> = [];
    for (const bm of odds.bookmakers) {
      const mk = bm.markets.find((m) => m.key === marketKey);
      if (!mk) continue;
      for (const o of mk.outcomes) {
        if (!selected.has(outcomeKey(bm.key, o.name, o.description))) continue;
        rows.push({
          sportKey: sport.key,
          sportTitle: sport.title,
          eventId: eventId ?? "",
          eventName: name,
          commenceTime,
          region,
          marketKey,
          marketLabel: marketLabel(marketKey),
          bookmakerKey: bm.key,
          bookmakerTitle: bm.title,
          outcomeName: o.name,
          outcomeDescription: o.description ?? null,
          oddsFormat: "american",
        });
      }
    }

    const added = await store.addTrackedSportsbook(rows);

    // Seed a first check from the response we already have, so a freshly
    // pinned outcome shows a value immediately (no forced Fetch).
    const now = nowForCheck();
    const seeds = added.map((r) => {
      const bm = odds.bookmakers.find((b) => b.key === r.bookmakerKey)!;
      const mk = bm.markets.find((m) => m.key === r.marketKey)!;
      const o = mk.outcomes.find(
        (x) =>
          x.name === r.outcomeName &&
          (x.description ?? null) === r.outcomeDescription,
      )!;
      return {
        checkedAt: now,
        trackKey: makeTrackKey(r),
        price: o.price,
        point: o.point ?? null,
        oddsFormat: "american" as const,
        lastUpdate: Date.parse(bm.last_update ?? mk.last_update ?? "") || now,
        rawOutcome: o,
        status: "ok" as const,
      };
    });
    if (seeds.length > 0) await store.appendSportsbookChecks(seeds);

    setSelected(new Set());
    setSavedMsg(
      added.length === 0
        ? "Those outcomes were already on your tracking list."
        : `Tracking ${added.length} outcome${added.length === 1 ? "" : "s"}.`,
    );
  }

  const marketRows = useMemo(() => {
    if (!odds || !marketKey) return [];
    return odds.bookmakers
      .map((bm) => ({
        bm,
        outcomes: bm.markets.find((m) => m.key === marketKey)?.outcomes ?? [],
      }))
      .filter((x) => x.outcomes.length > 0);
  }, [odds, marketKey]);

  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle>Track a sportsbook number</SectionTitle>
      <p className="text-xs text-muted">
        Saw a line at a sportsbook? Find it here: pick the sport, game, and
        market, then choose which numbers to track.
      </p>

      {topError && <p className="text-xs text-down">{topError}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Sport
          <Combobox
            options={sportOptions}
            value={sportKey}
            onChange={chooseSport}
            placeholder={sports ? "Search sports…" : "Loading sports…"}
            disabled={!sports}
            grouped
          />
        </label>

        {showEventPicker && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Game
            <Combobox
              options={eventOptions}
              value={eventId}
              onChange={(v) => setEventId(v)}
              placeholder={eventsBusy ? "Loading games…" : "Search games…"}
              disabled={eventsBusy || eventOptions.length === 0}
              grouped
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-xs text-muted">
          Market
          <Combobox
            options={marketOptions}
            value={marketKey}
            onChange={(v) => setMarketKey(v)}
            placeholder="Search markets…"
            disabled={!sport || isOutright}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted">
          Region
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Button
        onClick={loadOutcomes}
        disabled={!canLoad}
        variant="outline"
        className="self-start"
      >
        {busy ? "Loading…" : "Load outcomes (1 credit)"}
      </Button>

      {blocked && (
        <p className="text-xs text-down">
          Trial credits used up ({access?.trialUsed}/{access?.trialLimit} this
          month). Add your own Odds API key in Settings to keep going.
        </p>
      )}

      {oddsError && <p className="text-xs text-down">{oddsError}</p>}

      {odds && marketRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3">
            {marketRows.map(({ bm, outcomes }) => (
              <div key={bm.key} className="flex flex-col gap-1">
                <div className="text-xs font-semibold text-muted">{bm.title}</div>
                <div className="flex flex-col gap-1">
                  {outcomes.map((o, i) => {
                    const k = outcomeKey(bm.key, o.name, o.description);
                    return (
                      <label
                        key={`${k}-${i}`}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-background"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(k)}
                          onChange={() => toggle(k)}
                        />
                        <span className="flex-1">
                          {o.description ? `${o.description} · ` : ""}
                          {o.name}
                          {o.point != null && (
                            <span className="ml-1 text-muted tabular-nums">
                              {formatPoint(o.point)}
                            </span>
                          )}
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatAmerican(o.price)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={trackSelected}
            disabled={selected.size === 0}
            className="self-start"
          >
            Track {selected.size > 0 ? `${selected.size} ` : ""}selected
          </Button>
        </div>
      )}

      {savedMsg && <p className="text-xs text-up">{savedMsg}</p>}
    </Card>
  );
}
