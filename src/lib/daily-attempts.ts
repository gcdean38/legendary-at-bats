import type { PlayResult } from "@/lib/types";

const STORAGE_KEY = "legendary-at-bats:daily-first-attempts:v1";
/** One-shot local migrations (bump when intentionally wiping client state). */
const MIGRATION_KEY = "legendary-at-bats:daily-attempts-migrations:v1";

/** Locked first-try result for one Eastern calendar day. */
export type DailyFirstAttempt = {
  dateKey: string;
  atBatId: string;
  stars: number;
  finalPlay: PlayResult;
  endingTitle: string;
  /** ms since epoch when the first try was locked */
  completedAt: number;
};

type AttemptStore = Record<string, DailyFirstAttempt>;

/**
 * Oct 20 daily swapped Leyritz → Springer; clear that day’s locked first try
 * so everyone gets a fresh scored attempt on the new moment.
 */
const CLEAR_OCT20_ATTEMPT = "clear-2026-10-20-attempt";

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

  if (!done.includes(CLEAR_OCT20_ATTEMPT)) {
    if (next["2026-10-20"]) {
      const { ["2026-10-20"]: _removed, ...rest } = next;
      next = rest;
      changed = true;
    }
    done = [...done, CLEAR_OCT20_ATTEMPT];
    try {
      window.localStorage.setItem(MIGRATION_KEY, JSON.stringify(done));
    } catch {
      /* ignore */
    }
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
  return readStore()[dateKey] ?? null;
}

export function getAllFirstDailyAttempts(): AttemptStore {
  return readStore();
}

/**
 * Persist the first daily try for this date. No-ops if one already exists.
 * Returns the locked attempt (existing or newly saved).
 */
export function saveFirstDailyAttemptIfEmpty(
  attempt: Omit<DailyFirstAttempt, "completedAt"> & { completedAt?: number },
): DailyFirstAttempt {
  const store = readStore();
  const existing = store[attempt.dateKey];
  if (existing) return existing;
  const locked: DailyFirstAttempt = {
    dateKey: attempt.dateKey,
    atBatId: attempt.atBatId,
    stars: attempt.stars,
    finalPlay: attempt.finalPlay,
    endingTitle: attempt.endingTitle,
    completedAt: attempt.completedAt ?? Date.now(),
  };
  store[attempt.dateKey] = locked;
  writeStore(store);
  return locked;
}
