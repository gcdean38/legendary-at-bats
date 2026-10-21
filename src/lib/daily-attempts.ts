import { easternDateKey } from "@/lib/daily";
import type { PlayResult } from "@/lib/types";

const STORAGE_KEY = "legendary-at-bats:daily-first-attempts:v1";
/** One-shot local migrations (bump when intentionally wiping client state). */
const MIGRATION_KEY = "legendary-at-bats:daily-attempts-migrations:v1";

/** Eastern YYYY-MM-DD — archive / daily score keys only. */
export function isDailyDateKey(dateKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}

/** Was this completion on the Eastern calendar day of the daily? */
export function completedOnReleaseDay(
  dateKey: string,
  completedAt: number,
): boolean {
  return easternDateKey(new Date(completedAt)) === dateKey;
}

/**
 * Stored result for one Eastern calendar day.
 * First-try fields stay locked for share; best* tracks the highest score.
 */
export type DailyFirstAttempt = {
  dateKey: string;
  atBatId: string;
  /** Locked first-try stars (share / Wordle-style) */
  stars: number;
  finalPlay: PlayResult;
  endingTitle: string;
  /** ms since epoch when the first try was locked */
  completedAt: number;
  /** Best stars across all tries (defaults to first try for legacy rows) */
  bestStars: number;
  bestFinalPlay: PlayResult;
  bestEndingTitle: string;
  bestCompletedAt: number;
  /** True when the best score was earned on that Eastern calendar day */
  bestOnReleaseDay: boolean;
};

type AttemptStore = Record<string, DailyFirstAttempt>;

/**
 * One-shot clears of locked Oct 20 attempts (moment / pitch-script swaps).
 */
const CLEAR_OCT20_ATTEMPTS = [
  "clear-2026-10-20-attempt",
  "clear-2026-10-20-attempt-v2-springer-pitches",
] as const;

function normalizeAttempt(raw: DailyFirstAttempt): DailyFirstAttempt {
  const completedAt = raw.completedAt ?? Date.now();
  const bestStars = raw.bestStars ?? raw.stars;
  const bestFinalPlay = raw.bestFinalPlay ?? raw.finalPlay;
  const bestEndingTitle = raw.bestEndingTitle ?? raw.endingTitle;
  const bestCompletedAt = raw.bestCompletedAt ?? completedAt;
  const bestOnReleaseDay =
    raw.bestOnReleaseDay ??
    completedOnReleaseDay(raw.dateKey, bestCompletedAt);
  return {
    ...raw,
    completedAt,
    bestStars,
    bestFinalPlay,
    bestEndingTitle,
    bestCompletedAt,
    bestOnReleaseDay,
  };
}

function runMigrations(store: AttemptStore): AttemptStore {
  if (typeof window === "undefined") return store;
  let done: string[] = [];
  try {
    const raw = window.localStorage.getItem(MIGRATION_KEY);
    if (raw) done = JSON.parse(raw) as string[];
    if (!Array.isArray(done)) done = [];
  } catch {
    done = [];
  }

  let next = store;
  let changed = false;

  for (const key of CLEAR_OCT20_ATTEMPTS) {
    if (done.includes(key)) continue;
    if (next["2026-10-20"]) {
      const { ["2026-10-20"]: _removed, ...rest } = next;
      next = rest;
      changed = true;
    }
    done = [...done, key];
  }

  // Normalize legacy rows missing best* fields.
  for (const [k, v] of Object.entries(next)) {
    const norm = normalizeAttempt(v);
    if (
      norm.bestStars !== v.bestStars ||
      norm.bestOnReleaseDay !== v.bestOnReleaseDay
    ) {
      next = { ...next, [k]: norm };
      changed = true;
    }
  }

  try {
    window.localStorage.setItem(MIGRATION_KEY, JSON.stringify(done));
  } catch {
    /* ignore */
  }

  if (changed) writeStore(next);
  return next;
}

function readStore(): AttemptStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      runMigrations({});
      return {};
    }
    const parsed = JSON.parse(raw) as AttemptStore;
    const store = parsed && typeof parsed === "object" ? parsed : {};
    return runMigrations(store);
  } catch {
    return {};
  }
}

function writeStore(store: AttemptStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* private mode / quota — ignore */
  }
}

export function getFirstDailyAttempt(
  dateKey: string,
): DailyFirstAttempt | null {
  const row = readStore()[dateKey];
  return row ? normalizeAttempt(row) : null;
}

export function getAllFirstDailyAttempts(): AttemptStore {
  const store = readStore();
  const out: AttemptStore = {};
  for (const [k, v] of Object.entries(store)) {
    out[k] = normalizeAttempt(v);
  }
  return out;
}

/**
 * Persist the first daily try for this date. No-ops if one already exists.
 * Seeds best* from the first try. Returns the locked attempt.
 */
export function saveFirstDailyAttemptIfEmpty(
  attempt: Omit<
    DailyFirstAttempt,
    | "completedAt"
    | "bestStars"
    | "bestFinalPlay"
    | "bestEndingTitle"
    | "bestCompletedAt"
    | "bestOnReleaseDay"
  > & { completedAt?: number },
): DailyFirstAttempt {
  const store = readStore();
  const existing = store[attempt.dateKey];
  if (existing) return normalizeAttempt(existing);
  const completedAt = attempt.completedAt ?? Date.now();
  const locked: DailyFirstAttempt = {
    dateKey: attempt.dateKey,
    atBatId: attempt.atBatId,
    stars: attempt.stars,
    finalPlay: attempt.finalPlay,
    endingTitle: attempt.endingTitle,
    completedAt,
    bestStars: attempt.stars,
    bestFinalPlay: attempt.finalPlay,
    bestEndingTitle: attempt.endingTitle,
    bestCompletedAt: completedAt,
    bestOnReleaseDay: completedOnReleaseDay(attempt.dateKey, completedAt),
  };
  store[attempt.dateKey] = locked;
  writeStore(store);
  return locked;
}

/**
 * Update the best score for a daily/archive date when this try is better.
 * Creates a first-try row if none exists (archive play before a locked try).
 */
export function recordBestDailyAttempt(attempt: {
  dateKey: string;
  atBatId: string;
  stars: number;
  finalPlay: PlayResult;
  endingTitle: string;
  completedAt?: number;
}): DailyFirstAttempt | null {
  if (!isDailyDateKey(attempt.dateKey)) return null;
  const store = readStore();
  const completedAt = attempt.completedAt ?? Date.now();
  const onDay = completedOnReleaseDay(attempt.dateKey, completedAt);
  const existing = store[attempt.dateKey]
    ? normalizeAttempt(store[attempt.dateKey]!)
    : null;

  if (!existing) {
    const row: DailyFirstAttempt = {
      dateKey: attempt.dateKey,
      atBatId: attempt.atBatId,
      stars: attempt.stars,
      finalPlay: attempt.finalPlay,
      endingTitle: attempt.endingTitle,
      completedAt,
      bestStars: attempt.stars,
      bestFinalPlay: attempt.finalPlay,
      bestEndingTitle: attempt.endingTitle,
      bestCompletedAt: completedAt,
      bestOnReleaseDay: onDay,
    };
    store[attempt.dateKey] = row;
    writeStore(store);
    return row;
  }

  if (attempt.stars <= existing.bestStars) {
    return existing;
  }

  const next: DailyFirstAttempt = {
    ...existing,
    atBatId: attempt.atBatId,
    bestStars: attempt.stars,
    bestFinalPlay: attempt.finalPlay,
    bestEndingTitle: attempt.endingTitle,
    bestCompletedAt: completedAt,
    bestOnReleaseDay: onDay,
  };
  store[attempt.dateKey] = next;
  writeStore(store);
  return next;
}

/** True when the displayed best is still the locked first try. */
export function isBestStillFirstTry(attempt: DailyFirstAttempt): boolean {
  const row = normalizeAttempt(attempt);
  return (
    row.bestStars === row.stars && row.bestCompletedAt === row.completedAt
  );
}
