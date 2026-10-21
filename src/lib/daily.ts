import { HISTORIC_DATES } from "@/data/historic-dates";
import { LEGENDARY_AT_BATS } from "@/data/legendary-at-bats";
import { playResultLabel } from "@/lib/contact";
import type { LegendaryAtBat, PlayResult } from "@/lib/types";

/** Public play URL for share text. */
export const SHARE_GAME_URL = "https://gcdean38.github.io/legendary-at-bats/";

/** Official X / Twitter account. */
export const SOCIAL_X_URL = "https://x.com/legendaryatbats";

/**
 * Inclusive Eastern window: prefer moments that historically fell on
 * this calendar day (month–day). Outside the window, use hash rotation.
 */
export const SAME_DAY_DAILY_START = "2026-10-21";
export const SAME_DAY_DAILY_END = "2026-11-01";

/**
 * US Eastern calendar date as YYYY-MM-DD.
 * Daily challenge uses America/New_York so every player gets the same
 * Eastern day regardless of UTC or local browser timezone.
 */
export function easternDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) {
    throw new Error("Could not format Eastern calendar date.");
  }
  return `${y}-${m}-${d}`;
}

/** @deprecated Use easternDateKey — kept as an alias for call sites. */
export function utcDateKey(date: Date): string {
  return easternDateKey(date);
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Optional pinned dailies by Eastern YYYY-MM-DD.
 * Unlisted days fall through to the hash rotation.
 */
const DAILY_OVERRIDES: Record<string, string> = {
  "2026-10-16": "2001-ws7-arizona-20", // Luis Gonzalez walk-off single
  // Hash had rotated Springer here; swap to Leyritz so archive isn’t Springer twice.
  "2026-10-18": "1996-ws4-leyritz",
  // One year ago today: Springer ALCS G7 HR. Leyritz is a same-day bonus tile only.
  "2026-10-20": "2025-alcs-toronto-4",
  // On this day 1975: Fisk waves it fair. (Skip Judge ALCS G7 K — already daily’d.)
  "2026-10-21": "1975-ws6-boston-27",
  // Rewrite-friendly WS G7 K — schedule only; not the live daily until Oct 22 ET.
  "2026-10-22": "2019-ws7-houston-4",
};

/**
 * One-day home bonus (2026-10-20 only): extra “Play the Leyritz at bat” tile.
 * Not the scored daily — practice/archive style.
 */
export const OCT20_BONUS_LEYRITZ_ID = "1996-ws4-leyritz";

export function getOct20BonusAtBat(
  asOf: Date = new Date(),
): LegendaryAtBat | null {
  if (easternDateKey(asOf) !== "2026-10-20") return null;
  return LEGENDARY_AT_BATS.find((ab) => ab.id === OCT20_BONUS_LEYRITZ_ID) ?? null;
}

/**
 * First Eastern day shown in “Previous days”. Days on/after this and
 * before today accumulate in history as new dailies appear.
 */
export const DAILY_HISTORY_START = "2026-10-14";

/** Parse YYYY-MM-DD as a Date anchored near US Eastern midday. */
export function dateFromEasternKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid Eastern date key: ${dateKey}`);
  }
  return new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
}

/** Shift an Eastern YYYY-MM-DD by whole calendar days. */
export function shiftEasternDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + deltaDays, 17, 0, 0));
  return easternDateKey(dt);
}

function monthDay(isoDate: string): string {
  // YYYY-MM-DD → MM-DD
  return isoDate.slice(5);
}

/** Catalog moments whose real game date shares this Eastern month–day. */
export function momentsOnCalendarDay(dateKey: string): LegendaryAtBat[] {
  const md = monthDay(dateKey);
  return LEGENDARY_AT_BATS.filter((ab) => {
    const historic = HISTORIC_DATES[ab.id];
    return historic != null && monthDay(historic) === md;
  });
}

function inSameDayWindow(dateKey: string): boolean {
  return dateKey >= SAME_DAY_DAILY_START && dateKey <= SAME_DAY_DAILY_END;
}

/**
 * Deterministic daily pick so every player gets the same at-bat
 * on the same US Eastern calendar day.
 *
 * Through {@link SAME_DAY_DAILY_END}, prefer a moment that historically
 * happened on this calendar day (month–day). Otherwise hash-rotate.
 */
export function getDailyAtBat(date: Date): {
  atBat: LegendaryAtBat;
  dateKey: string;
  index: number;
} {
  const list = LEGENDARY_AT_BATS;
  if (list.length === 0) {
    throw new Error("No legendary at-bats seeded.");
  }
  const dateKey = easternDateKey(date);
  const overrideId = DAILY_OVERRIDES[dateKey];
  if (overrideId) {
    const index = list.findIndex((ab) => ab.id === overrideId);
    if (index >= 0) {
      return { atBat: list[index]!, dateKey, index };
    }
  }

  if (inSameDayWindow(dateKey)) {
    const sameDay = momentsOnCalendarDay(dateKey);
    if (sameDay.length > 0) {
      const pick =
        sameDay[
          hashString(`legendary-at-bats:same-day:${dateKey}`) % sameDay.length
        ]!;
      const index = list.findIndex((ab) => ab.id === pick.id);
      return { atBat: pick, dateKey, index: index >= 0 ? index : 0 };
    }
  }

  const index = hashString(`legendary-at-bats:${dateKey}`) % list.length;
  return { atBat: list[index]!, dateKey, index };
}

export type DailyHistoryEntry = {
  dateKey: string;
  atBat: LegendaryAtBat;
};

/**
 * Past dailies from {@link DAILY_HISTORY_START} through yesterday (ET),
 * newest first — the stash players can replay without browsing all 64.
 */
export function listDailyHistory(asOf: Date = new Date()): DailyHistoryEntry[] {
  const today = easternDateKey(asOf);
  if (DAILY_HISTORY_START >= today) return [];

  const out: DailyHistoryEntry[] = [];
  let key = DAILY_HISTORY_START;
  while (key < today) {
    const pick = getDailyAtBat(dateFromEasternKey(key));
    out.push({ dateKey: pick.dateKey, atBat: pick.atBat });
    key = shiftEasternDateKey(key, 1);
  }
  return out.reverse();
}

export function formatShareSummary(opts: {
  dateKey: string;
  /** Matchup title, e.g. "Houston vs Atlanta" */
  codename: string;
  year: number;
  series: string;
  gameLabel: string;
  stars: number;
  finalPlay: PlayResult;
  isDaily?: boolean;
  url?: string;
}): string {
  const starLine = "★".repeat(opts.stars) + "☆".repeat(3 - opts.stars);
  const roundLine = `${opts.year} ${opts.series} ${opts.gameLabel}`;
  const lines = [
    "Legendary At Bats ⚾",
    ...(opts.isDaily ? [opts.dateKey] : []),
    opts.codename,
    roundLine,
    starLine,
    playResultLabel(opts.finalPlay),
    opts.url ?? SHARE_GAME_URL,
  ];
  return lines.join("\n");
}
