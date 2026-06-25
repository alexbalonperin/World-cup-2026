// Loads the committed openfootball fixtures snapshot and turns each match into a
// view-ready Fixture, including a true UTC kickoff instant parsed from the
// source's "HH:MM UTC-X" local time.

import raw from "@/data/fixtures.json";
import { pairKey, isPlaceholderTeam } from "@/lib/normalize.mjs";

interface RawMatch {
  round: string;
  date: string;
  time: string;
  team1: string;
  team2: string;
  score?: { ft?: [number, number]; ht?: [number, number] };
  group?: string;
  ground?: string;
}

export interface Fixture {
  /** Stable id for React keys + score merging: source date + match index. */
  id: string;
  round: string;
  group: string | null;
  ground: string | null;
  /** Source ISO date, e.g. "2026-06-11" (this is the LOCAL match date). */
  date: string;
  team1: string;
  team2: string;
  /** ISO UTC instant of kickoff, or null if the time could not be parsed. */
  kickoffUtc: string | null;
  /** False for knockout placeholders ("W74", "1A") whose teams aren't known yet. */
  resolved: boolean;
  /** Team-pair key for joining to broadcasts; null when teams are placeholders. */
  key: string | null;
  /** Final score from the committed snapshot, used until live data arrives. */
  snapshotScore: [number, number] | null;
}

/**
 * Parse "13:00 UTC-6" into an ISO UTC instant for the given local date.
 * Returns null if the format is unexpected.
 */
export function parseKickoffUtc(date: string, time: string): string | null {
  const m = time.match(/(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})/i);
  const d = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || !d) return null;

  const [, hh, mm, off] = m;
  const [, y, mo, day] = d;
  const offsetMinutes = parseInt(off, 10) * 60;
  // UTC = localWallClock - offset.  Build the wall clock as if UTC, then subtract.
  const asIfUtc = Date.UTC(+y, +mo - 1, +day, +hh, +mm);
  return new Date(asIfUtc - offsetMinutes * 60_000).toISOString();
}

export function loadFixtures(): Fixture[] {
  const matches = (raw as { matches: RawMatch[] }).matches;
  return matches.map((m, i) => {
    const resolved =
      !isPlaceholderTeam(m.team1) && !isPlaceholderTeam(m.team2);
    return {
      id: `${m.date}#${i}`,
      round: m.round,
      group: m.group ?? null,
      ground: m.ground ?? null,
      date: m.date,
      team1: m.team1,
      team2: m.team2,
      kickoffUtc: parseKickoffUtc(m.date, m.time),
      resolved,
      key: resolved ? pairKey(m.team1, m.team2) : null,
      snapshotScore: m.score?.ft ?? null,
    };
  });
}
