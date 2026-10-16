import type { PlayResult } from "@/lib/types";

const STORAGE_KEY = "legendary-at-bats:daily-first-attempts:v1";

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

function readStore(): AttemptStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AttemptStore;
    return parsed && typeof parsed === "object" ? parsed : {};
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
