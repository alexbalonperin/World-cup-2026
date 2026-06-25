import { loadFixtures } from "@/lib/fixtures";
import { attachBroadcasts, type BroadcastMap } from "@/lib/join";
import broadcastsJson from "@/data/broadcasts.json";
import MatchList from "./MatchList";

export default function Page() {
  const fixtures = loadFixtures();
  const matches = attachBroadcasts(fixtures, broadcastsJson as BroadcastMap);

  return (
    <main className="wrap">
      <header>
        <h1>⚽ World Cup 2026 — JST Tracker</h1>
        <p>All kickoff times in Japan Standard Time (JST). Live scores update automatically.</p>
      </header>

      <MatchList matches={matches} />

      <footer>
        Times shown in JST (Asia/Tokyo). Live scores via football-data.org. Broadcast info scraped
        from{" "}
        <a href="https://www.alairelibre.cl/futbol/mundial/mundial-2026-chile-horarios-canales-partidos/">
          alairelibre.cl
        </a>{" "}
        (Chilevisión) and{" "}
        <a href="https://www.live-footballontv.com/live-world-cup-football-on-tv.html">
          live-footballontv.com
        </a>{" "}
        (BBC). Watch links: Chilevisión señal online and BBC iPlayer.
      </footer>
    </main>
  );
}
