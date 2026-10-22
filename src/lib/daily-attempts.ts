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
  /** Locked first-try stars (share / Wordle-style). 0 = no first try locked. */
  stars: number;
  finalPlay: PlayResult;
  endingTitle: string;
  /** ms since epoch when the first try was locked (0 if none) */
  completedAt: number;
  /** True when a same-day first try was locked via daily play */
  firstTryLocked: boolean;
  /** Best stars across all tries */
  bestStars: number;
  bestFinalPlay: PlayResult;
  bestEndingTitle: string;
  bestCompletedAt: number;
  /** True when the best score was earned on that Eastern calendar day */
  bestOnReleaseDay: boolean;
};

type AttemptStore = Record<string, DailyFirstAttempt>;

/**
 * One-shot clears of locked daily attempts when the moment swaps.
 */
const CLEAR_ATTEMPT_MIGRATIONS: { id: string; dateKey: string }[] = [
  { id: "clear-2026-10-20-attempt", dateKey: "2026-10-20" },
  { id: "clear-2026-10-20-attempt-v2-springer-pitches", dateKey: "2026-10-20" },
  // Oct 22 daily swapped Brantley → Yaz WS G7 last out
  { id: "clear-2026-10-22-attempt-yaz", dateKey: "2026-10-22" },
];

/** Repair + fill defaults. Best can never be below a locked first try. */
export function normalizeAttempt(
  raw: Partial<DailyFirstAttempt> &
    Pick<DailyFirstAttempt, "dateKey" | "atBatId">,
): DailyFirstAttempt {
  const stars = Math.max(0, Number(raw.stars) || 0);
  const completedAt =
    typeof raw.completedAt === "number" && raw.completedAt > 0
      ? raw.completedAt
      : 0;
  // Legacy rows (and any row with a real completedAt + stars) are first tries.
  // Archive-only rows use completedAt: 0 and firstTryLocked: false.
  const firstTryLocked =
    raw.firstTryLocked ?? (completedAt > 0 && stars > 0);
  const rawBest = Number(raw.bestStars);
  // Never let a corrupt/missing best sit below the locked first try.
  const bestStars = Math.max(
    Number.isFinite(rawBest) ? rawBest : 0,
    firstTryLocked ? stars : 0,
  );
  const finalPlay = raw.finalPlay ?? "strikeout";
  const endingTitle = raw.endingTitle ?? "";
  // If best was corrupt/below first try, restore best metadata from first try.
  const repairedFromFirst =
    firstTryLocked &&
    completedAt > 0 &&
    (!Number.isFinite(rawBest) || rawBest < stars);
  const bestFinalPlay = repairedFromFirst
    ? finalPlay
    : (raw.bestFinalPlay ?? finalPlay);
  const bestEndingTitle = repairedFromFirst
    ? endingTitle
    : (raw.bestEndingTitle ?? endingTitle);
  const bestCompletedAt = repairedFromFirst
    ? completedAt
    : typeof raw.bestCompletedAt === "number" && raw.bestCompletedAt > 0
      ? raw.bestCompletedAt
      : completedAt || Date.now();
  const bestOnReleaseDay = repairedFromFirst
    ? completedOnReleaseDay(raw.dateKey, completedAt)
    : (raw.bestOnReleaseDay ??
      completedOnReleaseDay(raw.dateKey, bestCompletedAt));

  return {
    dateKey: raw.dateKey,
    atBatId: raw.atBatId,
    stars,
    finalPlay,
    endingTitle,
    completedAt,
    firstTryLocked,
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

  for (const { id, dateKey } of CLEAR_ATTEMPT_MIGRATIONS) {
    if (done.includes(id)) continue;
    if (next[dateKey]) {
      const { [dateKey]: _removed, ...rest } = next;
      next = rest;
      changed = true;
    }
    done = [...done, id];
  }

  // Normalize / repair every row (best >= first try, fill best* fields).
  for (const [k, v] of Object.entries(next)) {
    const norm = normalizeAttempt(v);
    if (
      norm.bestStars !== v.bestStars ||
      norm.bestOnReleaseDay !== v.bestOnReleaseDay ||
      norm.firstTryLocked !== v.firstTryLocked ||
      norm.stars !== v.stars
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
  attempt: {
    dateKey: string;
    atBatId: string;
    stars: number;
    finalPlay: PlayResult;
    endingTitle: string;
    completedAt?: number;
  },
): DailyFirstAttempt {
  const store = readStore();
  const existing = store[attempt.dateKey];
  if (existing?.firstTryLocked || (existing && existing.completedAt > 0)) {
    return normalizeAttempt(existing);
  }
  const completedAt = attempt.completedAt ?? Date.now();
  const stars = Math.max(0, attempt.stars);
  const prior = existing ? normalizeAttempt(existing) : null;
  const bestStars = Math.max(prior?.bestStars ?? 0, stars);
  const locked: DailyFirstAttempt = {
    dateKey: attempt.dateKey,
    atBatId: attempt.atBatId,
    stars,
    finalPlay: attempt.finalPlay,
    endingTitle: attempt.endingTitle,
    completedAt,
    firstTryLocked: true,
    bestStars,
    bestFinalPlay:
      bestStars > (prior?.bestStars ?? -1)
        ? attempt.finalPlay
        : (prior?.bestFinalPlay ?? attempt.finalPlay),
    bestEndingTitle:
      bestStars > (prior?.bestStars ?? -1)
        ? attempt.endingTitle
        : (prior?.bestEndingTitle ?? attempt.endingTitle),
    bestCompletedAt:
      bestStars > (prior?.bestStars ?? -1)
        ? completedAt
        : (prior?.bestCompletedAt ?? completedAt),
    bestOnReleaseDay:
      bestStars > (prior?.bestStars ?? -1)
        ? completedOnReleaseDay(attempt.dateKey, completedAt)
        : (prior?.bestOnReleaseDay ??
          completedOnReleaseDay(attempt.dateKey, completedAt)),
  };
  store[attempt.dateKey] = locked;
  writeStore(store);
  return locked;
}

/**
 * Update the best score for a daily/archive date when this try is better.
 * Does not invent a locked first try — archive replays only touch best*.
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
  const stars = Math.max(0, Number(attempt.stars) || 0);
  if (stars <= 0) return getFirstDailyAttempt(attempt.dateKey);

  const store = readStore();
  const completedAt = attempt.completedAt ?? Date.now();
  const onDay = completedOnReleaseDay(attempt.dateKey, completedAt);
  const existing = store[attempt.dateKey]
    ? normalizeAttempt(store[attempt.dateKey]!)
    : null;

  if (!existing) {
    // Archive-only row — no locked first try.
    const row: DailyFirstAttempt = {
      dateKey: attempt.dateKey,
      atBatId: attempt.atBatId,
      stars: 0,
      finalPlay: attempt.finalPlay,
      endingTitle: attempt.endingTitle,
      completedAt: 0,
      firstTryLocked: false,
      bestStars: stars,
      bestFinalPlay: attempt.finalPlay,
      bestEndingTitle: attempt.endingTitle,
      bestCompletedAt: completedAt,
      bestOnReleaseDay: onDay,
    };
    store[attempt.dateKey] = row;
    writeStore(store);
    return row;
  }

  if (stars <= existing.bestStars) {
    return existing;
  }

  const next: DailyFirstAttempt = {
    ...existing,
    atBatId: attempt.atBatId,
    bestStars: stars,
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
    row.firstTryLocked &&
    row.bestStars === row.stars &&
    row.bestCompletedAt === row.completedAt
  );
}
