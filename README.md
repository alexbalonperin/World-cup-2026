# World Cup 2026 — JST Tracker

A small Next.js app that tracks every FIFA World Cup 2026 match with:

- **Kickoff time in JST** (Asia/Tokyo) for all 104 matches
- **Live scores** that update automatically during matches
- **Where to watch** — a link to **Chilevisión** (only for matches actually on CHV) and **BBC iPlayer**

## How it works

| Concern | Source | Strategy |
| --- | --- | --- |
| Fixtures (schedule, teams, final scores) | [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) | Committed snapshot in `data/fixtures.json` |
| Live scores | [football-data.org](https://www.football-data.org/) | Runtime, via a serverless route that hides the API key and caches 30s |
| Chilevisión availability | [alairelibre.cl](https://www.alairelibre.cl/futbol/mundial/mundial-2026-chile-horarios-canales-partidos/) | Scraped at build time → `data/broadcasts.json` |
| BBC iPlayer availability | [live-footballontv.com](https://www.live-footballontv.com/live-world-cup-football-on-tv.html) | Scraped at build time → `data/broadcasts.json` |

The three sources use different team-name languages and local dates, so they are
joined on a normalized, order-independent **team-pair key** (see `lib/normalize.mjs`).
Broadcast assignments are fixed per match, so they are scraped once at build time;
only scores are fetched live.

## Setup

```bash
npm install
cp .env.example .env.local        # add your free football-data.org key
npm run scrape:broadcasts         # refresh data/broadcasts.json (optional; runs on build too)
npm run dev                       # http://localhost:3000
```

Get a free API key at <https://www.football-data.org/client/register> and put it in
`.env.local` as `FOOTBALL_DATA_API_KEY`. Without a key the app still works — it shows
fixtures, JST times, watch links, and final scores from the committed snapshot, with a
"scores temporarily unavailable" notice instead of live updates.

## Install as a mobile app (PWA)

The app is an installable Progressive Web App. On a deployed (HTTPS) URL:

- **iOS (Safari):** Share → **Add to Home Screen**. Launches full-screen with the
  app icon and no browser chrome.
- **Android / desktop Chrome:** tap the **Install** icon in the address bar (or
  ⋮ → *Install app*).

It also works offline: fixtures, JST times, and watch links render from a cached
app shell, and live scores fall back to the last fetched values.

Icons live in `public/` and are generated (no dependencies) by
`scripts/gen-icons.mjs`. To regenerate them after a design tweak:

```bash
npm run gen:icons
```

## Deploy (Vercel)

1. Import the repo into Vercel.
2. Set the env var `FOOTBALL_DATA_API_KEY` in the project settings.
3. Deploy. The `prebuild` step re-runs the broadcast scraper on every build.

To refresh broadcast assignments mid-tournament without code changes, re-run
`npm run scrape:broadcasts`, commit `data/broadcasts.json`, and redeploy.

## Project layout

```
app/
  page.tsx              server: loads fixtures + broadcasts, renders shell
  MatchList.tsx         client: polls /api/scores, merges, renders rows in JST
  api/scores/route.ts   serverless: football-data.org proxy (key hidden, cached)
lib/
  normalize.mjs         shared name normalization + team-pair key (app + scraper)
  fixtures.ts           load snapshot; parse "HH:MM UTC-X" -> UTC instant
  jst.ts                Intl-based Asia/Tokyo formatting
  join.ts               merge fixtures + broadcasts + live scores
scripts/
  scrape-broadcasts.mjs build-time scraper for CHV + BBC pages
data/
  fixtures.json         committed openfootball snapshot
  broadcasts.json       committed scraper output
```
