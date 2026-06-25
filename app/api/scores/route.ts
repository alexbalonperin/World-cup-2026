// Serverless proxy for live World Cup scores from football-data.org.
//
// The API key lives only here (server-side env), never reaching the client.
// The upstream response is cached for 30s and shared by all viewers, so the
// free tier's 10 req/min limit is never approached regardless of traffic.

import { NextResponse } from "next/server";
import type { ScoreRecord } from "@/lib/join";

export const revalidate = 30;

interface FdTeam {
  name: string | null;
  shortName: string | null;
}
interface FdMatch {
  utcDate: string;
  status: string;
  minute: number | null;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: { fullTime: { home: number | null; away: number | null } };
}

export async function GET() {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) {
    return NextResponse.json(
      { scores: [], stale: true, reason: "missing FOOTBALL_DATA_API_KEY" },
      { status: 200 }
    );
  }

  try {
    const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
      headers: { "X-Auth-Token": key },
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { scores: [], stale: true, reason: `upstream ${res.status}` },
        { status: 200 }
      );
    }

    const data = (await res.json()) as { matches?: FdMatch[] };
    const scores: ScoreRecord[] = (data.matches ?? []).map((m) => ({
      utcDate: m.utcDate,
      homeTeam: m.homeTeam.name ?? m.homeTeam.shortName ?? "",
      awayTeam: m.awayTeam.name ?? m.awayTeam.shortName ?? "",
      status: m.status,
      home: m.score.fullTime.home,
      away: m.score.fullTime.away,
      minute: m.minute ?? null,
    }));

    return NextResponse.json({ scores, stale: false });
  } catch (e) {
    return NextResponse.json(
      { scores: [], stale: true, reason: e instanceof Error ? e.message : "fetch failed" },
      { status: 200 }
    );
  }
}
