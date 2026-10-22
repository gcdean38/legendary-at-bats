/**
 * Frozen Eastern YYYY-MM-DD → at-bat id for every day that has already shipped
 * (or is deliberately pinned ahead).
 *
 * This is the durable “catalog of past/present dailies.” Archive history is
 * rebuilt from this map — not from hashing the live LEGENDARY_AT_BATS array.
 *
 * Rules:
 * - Once a calendar day has been a daily (or shown in the archive), pin it here.
 * - Do not remove or reshuffle entries. Swap only with an intentional migration
 *   (and a clear-* attempt wipe in daily-attempts when the moment changes).
 * - New catalog moments belong in legendary-at-bats.ts; they must not change
 *   which id a past dateKey resolves to.
 */
export const DAILY_SCHEDULE: Record<string, string> = {
  // Restored after hash drift from catalog inserts (Yaz / Bagwell / expansions).
  "2026-10-14": "2023-ws1-texas-53", // Adolis Garcia WS G1 walk-off
  "2026-10-15": "2022-ws6-philadelphia-3", // Bryce Harper WS G6 K
  "2026-10-16": "2001-ws7-arizona-20", // Luis Gonzalez walk-off single
  "2026-10-17": "1988-ws1-gibson", // Kirk Gibson WS G1 (played scores exist)
  "2026-10-18": "1996-ws4-leyritz", // Leyritz (was Sandoval via hash; pinned to avoid Springer dup)
  "2026-10-19": "2012-ws1-sandoval", // Pablo Sandoval Giants — was 10-18 before Leyritz pin
  "2026-10-20": "2025-alcs-toronto-4", // George Springer ALCS G7
  "2026-10-21": "1975-ws6-boston-27", // Fisk
  "2026-10-22": "2005-ws1-houston-5", // Bagwell WS G1 K
};
