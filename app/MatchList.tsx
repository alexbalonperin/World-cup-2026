"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MatchView } from "@/lib/join";
import {
  WATCH_URLS,
  fifaHighlightsUrl,
  mergeScores,
  type LiveScore,
  type ScoreRecord,
} from "@/lib/join";
import { toJst, todayJstDayKey } from "@/lib/jst";

// Matches the scores route's 30s upstream cache (revalidate = 30), so this adds
// no upstream load — responses are shared and cached server-side.
const POLL_MS = 30_000;

interface ScoresResponse {
  scores: ScoreRecord[];
  stale: boolean;
  reason?: string;
}

type Cell = {
  kind: "scheduled" | "live" | "ft";
  label: string;
  home: number | null;
  away: number | null;
};

function cellFor(m: MatchView, live: LiveScore | undefined): Cell {
  if (live) {
    const s = live.status;
    if (s === "IN_PLAY" || s === "PAUSED") {
      return {
        kind: "live",
        label: live.minute ? `${live.minute}'` : "LIVE",
        home: live.home,
        away: live.away,
      };
    }
    if (s === "FINISHED") {
      return { kind: "ft", label: "FT", home: live.home, away: live.away };
    }
  }
  // Fall back to the committed snapshot's final score, if any.
  if (m.snapshotScore) {
    return { kind: "ft", label: "FT", home: m.snapshotScore[0], away: m.snapshotScore[1] };
  }
  return { kind: "scheduled", label: "—", home: null, away: null };
}

export default function MatchList({ matches }: { matches: MatchView[] }) {
  const [scores, setScores] = useState<Record<string, LiveScore>>({});
  const [stale, setStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // null until mounted, so server and first client render agree (no hydration
  // mismatch); the time-based "is this match past?" check only runs client-side.
  const [now, setNow] = useState<number | null>(null);

  // Single source of truth for fetching scores, shared by the interval, the
  // foreground listeners, and the manual refresh button. A ref guards against
  // overlapping fetches (e.g. a tap while the interval is mid-flight).
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    setNow(Date.now());
    try {
      const res = await fetch("/api/scores", { cache: "no-store" });
      const data = (await res.json()) as ScoresResponse;
      if (data.scores?.length) setScores(mergeScores(matches, data.scores));
      setStale(!!data.stale);
      setLastUpdated(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Tokyo",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date())
      );
    } catch {
      setStale(true);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [matches]);

  // Poll on mount and on a fixed interval while the app is open.
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // The fix for stale data on an installed PWA: timers are frozen while the app
  // is backgrounded, so re-fetch the moment it returns to the foreground.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onPageShow = () => refresh(); // iOS bfcache restore on app resume
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  // Sort by kickoff, then group by JST day.
  const groups = useMemo(() => {
    const sorted = [...matches].sort((a, b) => {
      const ta = a.kickoffUtc ? Date.parse(a.kickoffUtc) : Infinity;
      const tb = b.kickoffUtc ? Date.parse(b.kickoffUtc) : Infinity;
      return ta - tb;
    });
    const out: { label: string; dayKey: string; items: MatchView[] }[] = [];
    let current: { label: string; dayKey: string; items: MatchView[] } | null = null;
    for (const m of sorted) {
      const jst = toJst(m.kickoffUtc);
      const label = jst ? jst.date : "Date TBD";
      const dayKey = jst ? jst.dayKey : "9999-99-99"; // TBD sinks to the end
      if (!current || current.label !== label) {
        current = { label, dayKey, items: [] };
        out.push(current);
      }
      current.items.push(m);
    }
    return out;
  }, [matches]);

  // On first load, jump to today's matches (or the next upcoming day if today
  // has none). Keyed by JST day so it matches the group headers.
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const didScroll = useRef(false);
  useEffect(() => {
    if (didScroll.current || groups.length === 0) return;
    const today = todayJstDayKey();
    const target =
      groups.find((g) => g.dayKey >= today) ?? groups[groups.length - 1];
    const el = sectionRefs.current.get(target.dayKey);
    if (el) {
      // 'auto' (instant) so the user lands on today without a long animated scroll.
      el.scrollIntoView({ block: "start", behavior: "auto" });
      didScroll.current = true;
    }
  }, [groups]);

  return (
    <>
      <div className="status-bar">
        <span className={`dot${stale ? " stale" : ""}`} />
        {stale
          ? "Live scores temporarily unavailable — showing latest known results"
          : lastUpdated
            ? `Live · updated ${lastUpdated} JST`
            : "Loading live scores…"}
      </div>

      {groups.map((g) => (
        <section
          key={g.label}
          ref={(el) => {
            if (el) sectionRefs.current.set(g.dayKey, el);
            else sectionRefs.current.delete(g.dayKey);
          }}
        >
          <div className="day-header">{g.label}</div>
          {g.items.map((m) => {
            const jst = toJst(m.kickoffUtc);
            const cell = cellFor(m, scores[m.id]);
            // "Past" = finished, or kicked off well over a match-length ago and
            // not currently live. Needs real team names for the search query.
            const isPast =
              cell.kind === "ft" ||
              (cell.kind !== "live" &&
                m.kickoffUtc != null &&
                now != null &&
                now - Date.parse(m.kickoffUtc) > 2.5 * 60 * 60 * 1000);
            const showHighlights = m.resolved && isPast;
            return (
              <article className="match" key={m.id}>
                <div className="kickoff">
                  {jst ? jst.time : "TBD"}
                  <small>JST</small>
                </div>

                <div className="teams">
                  <div className="team-row">
                    <span className={`team-name${m.resolved ? "" : " tbd"}`}>{m.team1}</span>
                    <span className="goals">{cell.home ?? ""}</span>
                  </div>
                  <div className="team-row">
                    <span className={`team-name${m.resolved ? "" : " tbd"}`}>{m.team2}</span>
                    <span className="goals">{cell.away ?? ""}</span>
                  </div>
                  <div className="meta">
                    {m.round}
                    {m.group ? ` · ${m.group}` : ""}
                    {m.ground ? ` · ${m.ground}` : ""}
                  </div>
                </div>

                <div className="right">
                  <span className={`badge ${cell.kind}`}>{cell.label}</span>
                  <div className="watch">
                    {m.chv && (
                      <a className="chv" href={WATCH_URLS.chv} target="_blank" rel="noreferrer">
                        📺 CHV
                      </a>
                    )}
                    {m.bbcIplayer && (
                      <a className="bbc" href={WATCH_URLS.bbcIplayer} target="_blank" rel="noreferrer">
                        BBC iPlayer
                      </a>
                    )}
                    {showHighlights && (
                      <a
                        className="highlights"
                        href={fifaHighlightsUrl(m.team1, m.team2)}
                        target="_blank"
                        rel="noreferrer"
                        title="FIFA official highlights"
                      >
                        ▶ Highlights
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ))}

      <button
        type="button"
        className={`refresh-fab${refreshing ? " spinning" : ""}`}
        onClick={refresh}
        disabled={refreshing}
        aria-label="Refresh scores"
        title="Refresh scores"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z"
          />
        </svg>
      </button>
    </>
  );
}
