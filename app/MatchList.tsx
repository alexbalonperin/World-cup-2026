"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchView } from "@/lib/join";
import { WATCH_URLS, mergeScores, type LiveScore, type ScoreRecord } from "@/lib/join";
import { toJst } from "@/lib/jst";

const POLL_MS = 45_000;

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

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/scores", { cache: "no-store" });
        const data = (await res.json()) as ScoresResponse;
        if (cancelled) return;
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
        if (!cancelled) setStale(true);
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [matches]);

  // Sort by kickoff, then group by JST day.
  const groups = useMemo(() => {
    const sorted = [...matches].sort((a, b) => {
      const ta = a.kickoffUtc ? Date.parse(a.kickoffUtc) : Infinity;
      const tb = b.kickoffUtc ? Date.parse(b.kickoffUtc) : Infinity;
      return ta - tb;
    });
    const out: { label: string; items: MatchView[] }[] = [];
    let current: { label: string; items: MatchView[] } | null = null;
    for (const m of sorted) {
      const jst = toJst(m.kickoffUtc);
      const label = jst ? jst.date : "Date TBD";
      if (!current || current.label !== label) {
        current = { label, items: [] };
        out.push(current);
      }
      current.items.push(m);
    }
    return out;
  }, [matches]);

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
        <section key={g.label}>
          <div className="day-header">{g.label}</div>
          {g.items.map((m) => {
            const jst = toJst(m.kickoffUtc);
            const cell = cellFor(m, scores[m.id]);
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
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </>
  );
}
