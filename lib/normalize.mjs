// Shared team-name normalization + match-key logic.
//
// This is plain ESM JS (not TS) on purpose: it is imported by both the
// TypeScript app (browser + server, via the bundler) AND the plain-Node
// build-time scraper (scripts/scrape-broadcasts.mjs). Keeping it in one file
// guarantees fixtures (English), Chilevisión (Spanish) and BBC (English) all
// produce identical canonical keys, so the three sources join correctly.

// Spanish (and a few alternate English) spellings -> canonical English token,
// measured AFTER normalizeName()'s accent/punctuation stripping. ~48 nations,
// so this map only needs entries where the languages actually differ.
export const TEAM_ALIASES = {
  // Spanish -> English
  sudafrica: "south africa",
  "corea del sur": "south korea",
  "estados unidos": "united states",
  "arabia saudita": "saudi arabia",
  marruecos: "morocco",
  alemania: "germany",
  belgica: "belgium",
  brasil: "brazil",
  croacia: "croatia",
  dinamarca: "denmark",
  escocia: "scotland",
  espana: "spain",
  francia: "france",
  inglaterra: "england",
  italia: "italy",
  japon: "japan",
  noruega: "norway",
  "paises bajos": "netherlands",
  holanda: "netherlands",
  catar: "qatar",
  "republica checa": "czech republic",
  "checa": "czech republic",
  "costa de marfil": "ivory coast",
  "cote divoire": "ivory coast",
  suiza: "switzerland",
  suecia: "sweden",
  turquia: "turkey",
  grecia: "greece",
  egipto: "egypt",
  argelia: "algeria",
  tunez: "tunisia",
  senegal: "senegal",
  "nueva zelanda": "new zealand",
  "nueva zelandia": "new zealand",
  panama: "panama",
  jordania: "jordan",
  uzbekistan: "uzbekistan",
  "bosnia y herzegovina": "bosnia and herzegovina",
  "cabo verde": "cape verde",
  curazao: "curacao",
  irak: "iraq",
  "paises bajo": "netherlands",
  "rd congo": "dr congo",
  austrlia: "australia", // source typo on alairelibre.cl
  // English variants -> canonical
  usa: "united states",
  "united states of america": "united states",
  korea: "south korea",
  "korea republic": "south korea",
  "republic of korea": "south korea",
  czechia: "czech republic",
  "cote d ivoire": "ivory coast",
  "ivory coast ci": "ivory coast",
};

/**
 * Lowercase, strip accents, drop punctuation and common "vs" separators.
 * "México" -> "mexico"; then alias-mapped, e.g. "Sudáfrica" -> "south africa".
 * @param {string} raw
 * @returns {string}
 */
export function normalizeName(raw) {
  let s = (raw || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accent marks
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['`’.]/g, "") // drop apostrophes / dots
    .replace(/[^a-z0-9 ]/g, " ") // any other punctuation -> space
    .replace(/\b(vs|v)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (TEAM_ALIASES[s]) s = TEAM_ALIASES[s];
  return s;
}

/**
 * True for openfootball knockout placeholders: anything starting with a digit
 * ("1A", "2B", "3A/B/C/D/F") or a winner/loser slot ("W74", "L101"). No real
 * nation name starts with a digit, and "USA"/"DR Congo" are safe.
 * @param {string} raw
 * @returns {boolean}
 */
export function isPlaceholderTeam(raw) {
  const t = (raw || "").trim();
  return /^\d/.test(t) || /^[wl]\d+$/i.test(t);
}

/**
 * Order-independent normalized team-pair key, e.g. "mexico~south africa".
 * Date is intentionally excluded: each pairing occurs at most once in the group
 * stage, and the three sources disagree on the calendar date (fixtures use US
 * local, CHV Chilean local, BBC UK local), so the pair alone joins reliably.
 * @param {string} teamA
 * @param {string} teamB
 * @returns {string}
 */
export function pairKey(teamA, teamB) {
  return [normalizeName(teamA), normalizeName(teamB)].sort().join("~");
}
