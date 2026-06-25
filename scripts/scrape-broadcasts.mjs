// Build-time scraper. Fetches the Chilevisión (alairelibre.cl) and BBC
// (live-footballontv.com) schedule pages and writes data/broadcasts.json:
//
//   { "<pairKey>": { "date": "<any source date>", "chv": bool, "bbcIplayer": bool } }
//
// Keyed by team-pair (see lib/normalize.mjs) because the three data sources use
// different local dates. Broadcast assignments are fixed per match, so running
// this at build time (npm run prebuild) is enough; re-run to refresh.
//
// Fail-soft: if a source is unreachable or yields zero matches, its half of the
// previous data/broadcasts.json is preserved and the script exits non-zero so
// the build falls back to the committed file.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { pairKey, isPlaceholderTeam } from "../lib/normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "broadcasts.json");

const CHV_URL =
  "https://www.alairelibre.cl/futbol/mundial/mundial-2026-chile-horarios-canales-partidos/";
const BBC_URL =
  "https://www.live-footballontv.com/live-world-cup-football-on-tv.html";

const UA = "Mozilla/5.0 (compatible; wc2026-tracker/1.0)";

async function getHtml(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

/** Split "Team A vs. Team B" / "Team A v Team B" into [a, b], or null. */
function splitPair(text, re) {
  const parts = text.split(re).map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  if (parts.some((p) => isPlaceholderTeam(p) || /^tbc$/i.test(p))) return null;
  return parts;
}

/** Chilevisión: <li><strong>A vs. B</strong> (Grupo X) ... 📺 CHV ...</li> */
function parseChv(html) {
  const $ = cheerio.load(html);
  const out = new Map();
  let unmatched = 0;
  $("li").each((_, el) => {
    const $el = $(el);
    const teamsText = $el.find("strong").first().text().trim();
    const pair = splitPair(teamsText, /\s+vs\.?\s+/i);
    if (!pair) return; // legend lines / non-match list items
    // CHV badge = a standalone "CHV" token in the item (📺 CHV).
    const onChv = /\bCHV\b/.test($el.text());
    const key = pairKey(pair[0], pair[1]);
    out.set(key, { chv: onChv });
    if (key.split("~").length !== 2) unmatched++;
  });
  if (unmatched) console.error(`[chv] ${unmatched} suspicious keys`);
  return out;
}

/** BBC: .fixture blocks with .fixture__teams ("A v B") + .channel-pill spans. */
function parseBbc(html) {
  const $ = cheerio.load(html);
  const out = new Map();
  $(".fixture").each((_, el) => {
    const $el = $(el);
    const teamsText = $el.find(".fixture__teams").text().trim();
    const pair = splitPair(teamsText, /\s+v\s+/i);
    if (!pair) return; // TBC / knockout placeholders
    const channels = $el
      .find(".channel-pill")
      .map((_, c) => $(c).text().trim())
      .get();
    const onIplayer = channels.some((c) => /bbc iplayer/i.test(c));
    out.set(pairKey(pair[0], pair[1]), { bbcIplayer: onIplayer });
  });
  return out;
}

function readPrevious() {
  try {
    return JSON.parse(fs.readFileSync(OUT, "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  const previous = readPrevious();
  let hadError = false;

  // Chilevisión
  let chv = null;
  try {
    chv = parseChv(await getHtml(CHV_URL));
    if (chv.size === 0) throw new Error("no CHV matches parsed");
    console.error(
      `[chv] parsed ${chv.size} matches, ${[...chv.values()].filter((v) => v.chv).length} on CHV`
    );
  } catch (e) {
    hadError = true;
    console.error(`[chv] FAILED: ${e.message} — keeping previous CHV data`);
  }

  // BBC
  let bbc = null;
  try {
    bbc = parseBbc(await getHtml(BBC_URL));
    if (bbc.size === 0) throw new Error("no BBC matches parsed");
    console.error(
      `[bbc] parsed ${bbc.size} matches, ${[...bbc.values()].filter((v) => v.bbcIplayer).length} on BBC iPlayer`
    );
  } catch (e) {
    hadError = true;
    console.error(`[bbc] FAILED: ${e.message} — keeping previous BBC data`);
  }

  // Merge: start from previous, overwrite only the source(s) that succeeded.
  const merged = {};
  for (const [k, v] of Object.entries(previous)) {
    merged[k] = { chv: !!v.chv, bbcIplayer: !!v.bbcIplayer };
  }
  const ensure = (k) => (merged[k] ??= { chv: false, bbcIplayer: false });

  if (chv) {
    // Fresh CHV data: clear stale flags, then apply.
    for (const k of Object.keys(merged)) merged[k].chv = false;
    for (const [k, v] of chv) ensure(k).chv = v.chv;
  }
  if (bbc) {
    for (const k of Object.keys(merged)) merged[k].bbcIplayer = false;
    for (const [k, v] of bbc) ensure(k).bbcIplayer = v.bbcIplayer;
  }

  const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
  console.error(`[done] wrote ${Object.keys(sorted).length} entries to ${path.relative(ROOT, OUT)}`);

  if (hadError) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
