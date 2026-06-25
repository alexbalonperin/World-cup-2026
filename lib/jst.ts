// JST (Asia/Tokyo) formatting helpers. Uses Intl — no date library needed.

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tokyo",
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// "2026-06-11" style key in Asia/Tokyo, for grouping matches by JST day.
const DAY_KEY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export interface JstParts {
  date: string; // e.g. "Thu, 11 Jun 2026"
  time: string; // e.g. "04:00"
  dayKey: string; // e.g. "2026-06-11" (in JST)
}

export function toJst(isoUtc: string | null): JstParts | null {
  if (!isoUtc) return null;
  const d = new Date(isoUtc);
  if (isNaN(d.getTime())) return null;
  return {
    date: DATE_FMT.format(d),
    time: TIME_FMT.format(d),
    dayKey: DAY_KEY_FMT.format(d),
  };
}
