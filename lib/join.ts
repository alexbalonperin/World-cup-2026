// Merges the three data sources into the shape the UI renders:
//   fixtures (schedule + JST time)  +  broadcasts (where to watch)  +  live scores.

import type { Fixture } from "@/lib/fixtures";
import { pairKey } from "@/lib/normalize.mjs";

// Where each broadcaster sends you to actually watch.
export const WATCH_URLS = {
  chv: "https://www.chilevision.cl/senal-online",
  bbcIplayer: "https://www.bbc.co.uk/iplayer",
} as const;

// Official FIFA YouTube channel handle. FIFA posts per-match reels titled
// "Highlights | <A> <score> <B> | FIFA World Cup 2026" on this channel.
const FIFA_YT_CHANNEL = "@fifa";

/**
 * Link to the official FIFA YouTube channel's highlights for a finished match.
 * We scope the search to FIFA's own channel rather than all of YouTube, so the
 * results can only ever be official FIFA-channel videos. A whole-site search
 * (the previous behavior) always returns *some* unrelated video even when no
 * real highlights exist; a channel-scoped search instead shows "no results"
 * when FIFA hasn't posted that match yet.
 */
export function fifaHighlightsUrl(team1: string, team2: string): string {
  const q = `${team1} ${team2} highlights`;
  return `https://www.youtube.com/${FIFA_YT_CHANNEL}/search?query=${encodeURIComponent(q)}`;
}

/** One entry per match in data/broadcasts.json, keyed by team-pair key. */
export interface BroadcastRecord {
  chv: boolean;
  bbcIplayer: boolean;
}

export type BroadcastMap = Record<string, BroadcastRecord>;

/** Trimmed live-score record returned by /api/scores. */
export interface ScoreRecord {
  utcDate: string;
  homeTeam: string;
  awayTeam: string;
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | ...
  home: number | null;
  away: number | null;
  minute: number | null;
}

export interface LiveScore {
  home: number | null;
  away: number | null;
  status: ScoreRecord["status"];
  minute: number | null;
}

export interface MatchView extends Fixture {
  chv: boolean;
  bbcIplayer: boolean;
}

/** Attach broadcast availability to each fixture (server-side). */
export function attachBroadcasts(
  fixtures: Fixture[],
  broadcasts: BroadcastMap
): MatchView[] {
  return fixtures.map((f) => {
    const b = f.key ? broadcasts[f.key] : undefined;
    return { ...f, chv: b?.chv ?? false, bbcIplayer: b?.bbcIplayer ?? false };
  });
}

/**
 * Build a map of fixture.id -> LiveScore from the API payload.
 *
 * Scores are aligned by normalized team pair. Two teams can in principle meet
 * more than once across a tournament, so when several fixtures share a pair we
 * pick the one whose kickoff is closest to the live match's UTC date. This
 * sidesteps the date-basis mismatch between fixtures (US local date) and the
 * scores feed (UTC instant).
 */
export function mergeScores(
  fixtures: Fixture[],
  scores: ScoreRecord[]
): Record<string, LiveScore> {
  const byPair = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    if (!f.resolved) continue;
    const k = pairKey(f.team1, f.team2);
    const list = byPair.get(k);
    if (list) list.push(f);
    else byPair.set(k, [f]);
  }

  const out: Record<string, LiveScore> = {};
  for (const s of scores) {
    const candidates = byPair.get(pairKey(s.homeTeam, s.awayTeam));
    if (!candidates || candidates.length === 0) continue;

    let best = candidates[0];
    if (candidates.length > 1) {
      const target = new Date(s.utcDate).getTime();
      let bestDelta = Infinity;
      for (const c of candidates) {
        const t = c.kickoffUtc ? new Date(c.kickoffUtc).getTime() : NaN;
        const delta = isNaN(t) ? Infinity : Math.abs(t - target);
        if (delta < bestDelta) {
          bestDelta = delta;
          best = c;
        }
      }
    }

    out[best.id] = {
      home: s.home,
      away: s.away,
      status: s.status,
      minute: s.minute,
    };
  }
  return out;
}
