import { LEGENDARY_AT_BATS } from "@/data/legendary-at-bats";
import { playResultLabel } from "@/lib/contact";
import type { LegendaryAtBat, PlayResult } from "@/lib/types";

/** Public play URL for share text. */
export const SHARE_GAME_URL = "https://gcdean38.github.io/legendary-at-bats/";

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
};

/**
 * Deterministic daily pick so every player gets the same at-bat
 * on the same US Eastern calendar day.
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
  const index = hashString(`legendary-at-bats:${dateKey}`) % list.length;
  return { atBat: list[index]!, dateKey, index };
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
