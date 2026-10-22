/**
 * Frozen Eastern YYYY-MM-DD → at-bat id for every published daily.
 *
 * Through 2026-11-02: curated on-this-day picks (real game month–day), with a
 * few intentional rewrite / change-history moments mixed in. Oct 14–19 also
 * keep early-archive pins that are not all on-this-day.
 *
 * After 2026-11-02: do not add rows here for “random” days — `getDailyAtBat`
 * hashes among catalog ids not already used in this schedule.
 *
 * Rules:
 * - Once a calendar day has shipped (or is pre-pinned here), leave it alone.
 * - Swap only with an intentional migration + clear-* attempt wipe.
 */
export const DAILY_SCHEDULE: Record<string, string> = {
  // ——— Early archive (mostly pre on-this-day window) ———
  "2026-10-14": "2023-ws1-texas-53", // Adolis Garcia WS G1 walk-off
  "2026-10-15": "2022-ws6-philadelphia-3", // Bryce Harper WS G6 K (rewrite)
  "2026-10-16": "2001-ws7-arizona-20", // Luis Gonzalez walk-off single
  "2026-10-17": "1988-ws1-gibson", // Kirk Gibson WS G1
  "2026-10-18": "1996-ws4-leyritz", // Jim Leyritz WS G4
  // True Oct 19: Altuve ALCS walk-off (Sandoval moved to 10-24, his real date)
  "2026-10-19": "2019-alcs-houston-27", // Jose Altuve ALCS G6 walk-off
  "2026-10-20": "2025-alcs-toronto-4", // George Springer ALCS G7 (on-this-day)

  // ——— On-this-day window through Nov 2 ———
  "2026-10-21": "1975-ws6-boston-27", // Fisk WS G6
  "2026-10-22": "2005-ws1-houston-5", // Bagwell WS G1 K (rewrite)
  "2026-10-23": "2010-nlcs6-howard", // Ryan Howard NLCS G6 K looking (rewrite; Carter stays in catalog)
  "2026-10-24": "2012-ws1-sandoval", // Pablo Sandoval WS G1 (Giants)
  "2026-10-25": "1986-ws6-wilson", // Mookie Wilson WS G6 (change-history)
  "2026-10-26": "1991-ws6-puckett", // Kirby Puckett WS G6 walk-off
  "2026-10-27": "2011-ws6-stlouis-23", // David Freese WS G6
  "2026-10-28": "1995-ws6-justice", // David Justice WS G6 clinching HR
  "2026-10-29": "2017-ws5-houston-2", // Alex Bregman WS G5
  "2026-10-30": "2024-ws5-newyork-99", // Aaron Judge WS G5 K (rewrite)
  "2026-10-31": "2001-ws4-newyork-2", // Derek Jeter WS G4 Mr. November
  "2026-11-01": "2025-ws7-toronto-30", // Alejandro Kirk WS G7 GIDP (rewrite)
  "2026-11-02": "2016-ws7-cleveland-1", // Michael Martinez WS G7 — Cubs/Indians rewrite
};

/** Last Eastern day that is fully pre-scheduled above. */
export const DAILY_SCHEDULE_END = "2026-11-02";
