import { LEGENDARY_AT_BATS } from "@/data/legendary-at-bats";
import type { HistoryVerdict, LegendaryAtBat } from "@/lib/types";

/** UTC calendar date as YYYY-MM-DD */
export function utcDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
 * Deterministic daily pick so every player gets the same at-bat in UTC.
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
  const dateKey = utcDateKey(date);
  const index = hashString(`legendary-at-bats:${dateKey}`) % list.length;
  return { atBat: list[index], dateKey, index };
}

const VERDICT_SHARE: Record<HistoryVerdict, string> = {
  changed_history: "Changed history",
  matched_legend: "Matched the legend",
  history_held: "History held",
  fell_short: "Fell short",
};

export function formatShareSummary(opts: {
  dateKey: string;
  codename: string;
  stars: number;
  verdict: HistoryVerdict;
  endingTitle?: string;
}): string {
  const starLine = "★".repeat(opts.stars) + "☆".repeat(3 - opts.stars);
  return [
    `Legendary At Bats — ${opts.dateKey}`,
    `${opts.codename}`,
    starLine,
    opts.endingTitle ?? VERDICT_SHARE[opts.verdict],
    VERDICT_SHARE[opts.verdict],
    "Play today’s at-bat.",
  ].join("\n");
}
