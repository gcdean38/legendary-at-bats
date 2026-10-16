import { GENERIC_ARSENAL, generateOpeningSequence, arsenalFromPitches } from "@/lib/arsenal";
import { MAX_PITCHES_PER_AB } from "@/lib/count";
import { playResultLabel } from "@/lib/contact";
import {
  batterIsHome,
  parseInning,
  runnersLabel,
} from "@/lib/situation";
import type {
  AtBatSessionResult,
  BasesState,
  LegendaryAtBat,
  PlayResult,
  ScoreSide,
  SeedPitch,
} from "@/lib/types";

export type AbLogEntry = {
  batterIndex: number;
  batterLabel: string;
  play: PlayResult;
  runsScored: number;
  /** Display line, e.g. "Home run · 2 R" */
  line: string;
};

export type InningState = {
  half: "top" | "bottom";
  inningNumber: number;
  outs: number;
  bases: BasesState;
  away: ScoreSide;
  home: ScoreSide;
  /** True when the batting team is home */
  battingHome: boolean;
  /** Deficit at rally start (0 = tied) */
  startDeficit: number;
  pitcher: { team: string; number: number; throws: "L" | "R" };
  batterIndex: number;
  runsThisInning: number;
  kind: "bot9" | "rewrite";
  /** Pitch templates for arsenal draws (legendary mix on rewrite) */
  arsenalTemplates: SeedPitch[];
  sourceCodename?: string;
  /** Bot 9 flavor — real playoff matchup seeding */
  bot9?: {
    year: number;
    series: string;
    gameLabel: string;
    venue: string;
    homeCity: string;
    awayCity: string;
    difficulty: Bot9Difficulty;
  };
  abLog: AbLogEntry[];
};

const BAT_HANDS: Array<"L" | "R" | "S"> = ["R", "R", "L", "L", "S"];

function emptyBases(): BasesState {
  return { first: false, second: false, third: false };
}

function runnersOn(bases: BasesState): number {
  return (bases.first ? 1 : 0) + (bases.second ? 1 : 0) + (bases.third ? 1 : 0);
}

/** Max runs a HR would score from this base state. */
export function maxHomeRunRuns(bases: BasesState): number {
  return 1 + runnersOn(bases);
}

export function battingDeficit(atBat: LegendaryAtBat): number {
  const home = batterIsHome(atBat);
  const margin = home
    ? atBat.home.runs - atBat.away.runs
    : atBat.away.runs - atBat.home.runs;
  return Math.max(0, -margin);
}

/**
 * Deep-hole legendary AB: trailing by more than a max HR can erase
 * (Philly/Houston, Arizona WS, Houston/WSH, etc.).
 */
export function isDeepHoleAtBat(atBat: LegendaryAtBat): boolean {
  return battingDeficit(atBat) > maxHomeRunRuns(atBat.bases);
}

function battingTeamAhead(state: InningState): boolean {
  return state.battingHome
    ? state.home.runs > state.away.runs
    : state.away.runs > state.home.runs;
}

/** Walk-off / took the lead. */
export function isWalkOff(state: InningState): boolean {
  return battingTeamAhead(state);
}

/** Three outs, or batting side already ahead. */
export function isInningOver(state: InningState): boolean {
  return state.outs >= 3 || battingTeamAhead(state);
}

export function abLogLine(play: PlayResult, runsScored: number): string {
  const base = playResultLabel(play);
  return runsScored > 0 ? `${base} · ${runsScored} R` : base;
}

/**
 * After a legendary AB in a deep hole: offer rewrite continue if they
 * reached / plated and outs remain (rally still alive, not yet ahead).
 */
export function shouldOfferRewriteContinue(
  atBat: LegendaryAtBat,
  session: AtBatSessionResult,
): boolean {
  if (!isDeepHoleAtBat(atBat)) return false;
  if (session.board.outs >= 3) return false;

  const home = batterIsHome(atBat);
  const ahead = home
    ? session.board.home.runs > session.board.away.runs
    : session.board.away.runs > session.board.home.runs;
  if (ahead) return false;

  switch (session.finalPlay) {
    case "single":
    case "double":
    case "home_run":
    case "walk":
    case "sac_fly":
      return true;
    default:
      return false;
  }
}

/** Bot 9 difficulty — fixed deficit (no random hole). */
export type Bot9Difficulty = "easy" | "medium" | "hard";

export const BOT9_DEFICIT: Record<Bot9Difficulty, 1 | 2 | 3> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

/**
 * Real playoff Bot 9 seeds (home batting, empty bases for the mode).
 * Three per deficit — createInning picks one at random.
 */
export type Bot9Scenario = {
  year: number;
  series: string;
  gameLabel: string;
  venue: string;
  awayCity: string;
  homeCity: string;
  away: ScoreSide;
  home: ScoreSide;
};

export const BOT9_SCENARIOS: Record<Bot9Difficulty, Bot9Scenario[]> = {
  // Down 1
  easy: [
    {
      year: 1993,
      series: "World Series",
      gameLabel: "Game 6",
      venue: "Toronto Centre",
      awayCity: "Philadelphia",
      homeCity: "Toronto",
      away: { abbr: "PHI", runs: 6 },
      home: { abbr: "TOR", runs: 5 },
    },
    {
      year: 2001,
      series: "World Series",
      gameLabel: "Game 7",
      venue: "Arizona Field",
      awayCity: "New York",
      homeCity: "Arizona",
      away: { abbr: "NYY", runs: 2 },
      home: { abbr: "ARI", runs: 1 },
    },
    {
      year: 1979,
      series: "ALCS",
      gameLabel: "Game 3",
      venue: "Anaheim Park",
      awayCity: "Baltimore",
      homeCity: "Anaheim",
      away: { abbr: "BAL", runs: 3 },
      home: { abbr: "ANA", runs: 2 },
    },
  ],
  // Down 2
  medium: [
    {
      year: 2011,
      series: "World Series",
      gameLabel: "Game 6",
      venue: "St. Louis Park",
      awayCity: "Texas",
      homeCity: "St. Louis",
      away: { abbr: "TEX", runs: 7 },
      home: { abbr: "STL", runs: 5 },
    },
    {
      year: 1992,
      series: "NLCS",
      gameLabel: "Game 7",
      venue: "Atlanta Park",
      awayCity: "Pittsburgh",
      homeCity: "Atlanta",
      away: { abbr: "PIT", runs: 2 },
      home: { abbr: "ATL", runs: 0 },
    },
    {
      year: 2023,
      series: "ALCS",
      gameLabel: "Game 5",
      venue: "Houston Field",
      awayCity: "Texas",
      homeCity: "Houston",
      away: { abbr: "TEX", runs: 4 },
      home: { abbr: "HOU", runs: 2 },
    },
  ],
  // Down 3 — rare Bot 9 holes; seeded from real playoff series pressure
  hard: [
    {
      // 2016 NLDS G4: Cubs climbed out of a 3+ run 9th-inning hole (road that night).
      // Mode puts you in that hole batting last at Chicago Park.
      year: 2016,
      series: "NLDS",
      gameLabel: "Game 4",
      venue: "Chicago Park",
      awayCity: "San Francisco",
      homeCity: "Chicago",
      away: { abbr: "SF", runs: 5 },
      home: { abbr: "CHC", runs: 2 },
    },
    {
      // 2004 ALCS pressure at Fenway — Sox often dug out of late deficits that October.
      year: 2004,
      series: "ALCS",
      gameLabel: "Game 5",
      venue: "Boston Park",
      awayCity: "New York",
      homeCity: "Boston",
      away: { abbr: "NYY", runs: 6 },
      home: { abbr: "BOS", runs: 3 },
    },
    {
      // 2019 World Series — Astros faced heavy late deficits at Houston Field.
      year: 2019,
      series: "World Series",
      gameLabel: "Game 2",
      venue: "Houston Field",
      awayCity: "Washington",
      homeCity: "Houston",
      away: { abbr: "WSH", runs: 7 },
      home: { abbr: "HOU", runs: 4 },
    },
  ],
};

/**
 * Bottom of the 9th: home batting, empty bases, 0 outs.
 * Deficit + teams come from a real playoff seed for that difficulty.
 */
export function createInning(
  difficulty: Bot9Difficulty = "medium",
  rng: () => number = Math.random,
): InningState {
  const startDeficit = BOT9_DEFICIT[difficulty];
  const pool = BOT9_SCENARIOS[difficulty];
  const scenario = pool[Math.floor(rng() * pool.length)]!;
  const throws: "L" | "R" = rng() < 0.28 ? "L" : "R";

  return {
    half: "bottom",
    inningNumber: 9,
    outs: 0,
    bases: emptyBases(),
    away: { ...scenario.away },
    home: { ...scenario.home },
    battingHome: true,
    startDeficit,
    pitcher: {
      team: scenario.awayCity,
      number: 1 + Math.floor(rng() * 99),
      throws,
    },
    batterIndex: 1,
    runsThisInning: 0,
    kind: "bot9",
    arsenalTemplates: generateOpeningSequence(GENERIC_ARSENAL, 6, rng),
    bot9: {
      year: scenario.year,
      series: scenario.series,
      gameLabel: scenario.gameLabel,
      venue: scenario.venue,
      homeCity: scenario.homeCity,
      awayCity: scenario.awayCity,
      difficulty,
    },
    abLog: [],
  };
}

/** Seed a rewrite rally from a finished deep-hole legendary AB. */
export function createRewriteInning(
  atBat: LegendaryAtBat,
  session: AtBatSessionResult,
): InningState {
  const { half, number } = parseInning(atBat.inning);
  const battingHome = batterIsHome(atBat);
  const first: AbLogEntry = {
    batterIndex: 1,
    batterLabel: `${atBat.batter.team} #${atBat.batter.number}`,
    play: session.finalPlay,
    runsScored: session.runsScored,
    line: abLogLine(session.finalPlay, session.runsScored),
  };

  return {
    half,
    inningNumber: number,
    outs: session.board.outs,
    bases: { ...session.board.bases },
    away: { ...session.board.away },
    home: { ...session.board.home },
    battingHome,
    startDeficit: battingDeficit(atBat),
    pitcher: { ...atBat.pitcher },
    batterIndex: 2,
    runsThisInning: session.runsScored,
    kind: "rewrite",
    // Pitcher's mix from the legendary script — each AB re-rolls fresh locations.
    arsenalTemplates: (() => {
      const mix = arsenalFromPitches(atBat.pitches);
      return generateOpeningSequence(mix.length > 0 ? mix : GENERIC_ARSENAL, 6);
    })(),
    sourceCodename: atBat.codename,
    abLog: [first],
  };
}

function deficitCopy(
  deficit: number,
  bot9?: InningState["bot9"],
): { blurb: string; stakes: string } {
  const setting = bot9
    ? `${bot9.year} ${bot9.series} ${bot9.gameLabel} at ${bot9.venue}. `
    : "";
  if (deficit === 1) {
    return {
      blurb: `${setting}Down one. Tie it or take the lead before three outs.`,
      stakes: "One swing can rewrite the night.",
    };
  }
  return {
    blurb: `${setting}Down ${deficit}. Put a rally together before three outs.`,
    stakes: `You need ${deficit} to tie and ${deficit + 1} to lead.`,
  };
}

/** Next plate appearance — fresh arsenal throws (random locations). */
export function atBatFromInning(
  state: InningState,
  rng: () => number = Math.random,
): LegendaryAtBat {
  const bats = BAT_HANDS[Math.floor(rng() * BAT_HANDS.length)]!;
  const batterNum = 1 + Math.floor(rng() * 99);
  const runners = runnersLabel(state.bases);
  const deficit = state.battingHome
    ? Math.max(0, state.away.runs - state.home.runs)
    : Math.max(0, state.home.runs - state.away.runs);
  const label =
    state.half === "bottom"
      ? `Bottom ${state.inningNumber}`
      : `Top ${state.inningNumber}`;
  const batterTeam = state.battingHome
    ? (state.bot9?.homeCity ?? "Home")
    : (state.bot9?.awayCity ?? "Away");
  const pitcherTeam = state.bot9?.awayCity ?? state.pitcher.team;
  const isLeadOff = state.abLog.length === 0;

  const copy =
    isLeadOff && state.kind === "bot9"
      ? deficitCopy(state.startDeficit, state.bot9)
      : {
          blurb: `${label}, ${state.outs} out${state.outs === 1 ? "" : "s"}, ${runners.toLowerCase()}. Still ${
            deficit === 0 ? "tied" : `down ${deficit}`
          }.`,
          stakes:
            deficit === 0
              ? "One run takes the lead."
              : `Need ${deficit} to tie, ${deficit + 1} to lead.`,
        };

  const arsenal = arsenalFromPitches(state.arsenalTemplates);
  const pitches = generateOpeningSequence(
    arsenal.length > 0 ? arsenal : GENERIC_ARSENAL,
    MAX_PITCHES_PER_AB,
    rng,
  );

  const codename =
    state.kind === "rewrite"
      ? `Rewrite · ${state.sourceCodename ?? "History"}`
      : state.bot9
        ? `${state.bot9.homeCity} vs ${state.bot9.awayCity}`
        : "Bottom of the 9th";

  return {
    id: `${state.kind}-${state.inningNumber}-${state.half}-b${state.batterIndex}`,
    codename,
    year: state.bot9?.year ?? 2026,
    series:
      state.kind === "rewrite"
        ? "Rewrite history"
        : (state.bot9?.series ?? "Bottom of the 9th"),
    gameLabel: state.bot9?.gameLabel ?? `Batter ${state.batterIndex}`,
    inning: label,
    venue: state.bot9?.venue ?? "Practice Field",
    outs: state.outs,
    away: state.away,
    home: state.home,
    bases: { ...state.bases },
    runners,
    batter: { team: batterTeam, number: batterNum, bats },
    pitcher: {
      team: pitcherTeam,
      number: state.pitcher.number,
      throws: state.pitcher.throws,
    },
    situationBlurb:
      state.kind === "rewrite" && state.batterIndex === 2
        ? `You’re on the verge of rewriting history. ${copy.blurb}`
        : copy.blurb,
    stakes: copy.stakes,
    pitches,
    historical: {
      outcome: "single",
      batterSucceeded: true,
      summary:
        state.kind === "rewrite"
          ? "Rewrite rally — keep going until you take the lead or make the third out."
          : "Bottom of the 9th mode — come back or walk it off against a full arsenal.",
    },
  };
}

/**
 * Fold a finished AB into inning state and append the at-bat log.
 */
export function advanceInning(
  state: InningState,
  session: AtBatSessionResult,
  batter: { team: string; number: number },
): InningState {
  const entry: AbLogEntry = {
    batterIndex: state.batterIndex,
    batterLabel: `${batter.team} #${batter.number}`,
    play: session.finalPlay,
    runsScored: session.runsScored,
    line: abLogLine(session.finalPlay, session.runsScored),
  };
  const ahead =
    (state.battingHome &&
      session.board.home.runs > session.board.away.runs) ||
    (!state.battingHome &&
      session.board.away.runs > session.board.home.runs);

  return {
    ...state,
    outs: session.board.outs,
    bases:
      session.board.outs >= 3 || ahead
        ? emptyBases()
        : { ...session.board.bases },
    away: { ...session.board.away },
    home: { ...session.board.home },
    batterIndex: state.batterIndex + 1,
    runsThisInning: state.runsThisInning + session.runsScored,
    abLog: [...state.abLog, entry],
  };
}

export function inningSummary(state: InningState): string {
  if (battingTeamAhead(state)) {
    const margin = state.battingHome
      ? state.home.runs - state.away.runs
      : state.away.runs - state.home.runs;
    if (state.half === "bottom" && state.battingHome) {
      return margin === 1 ? "Walk-off win" : `Walk-off · won by ${margin}`;
    }
    return margin === 1 ? "Took the lead" : `Took the lead · up ${margin}`;
  }
  if (state.outs >= 3) {
    const stillDown = state.battingHome
      ? state.away.runs - state.home.runs
      : state.home.runs - state.away.runs;
    if (stillDown > 0) return `Final · still down ${stillDown}`;
    return "Final · tied, extras denied";
  }
  const runs = state.runsThisInning;
  if (runs === 0) return "Rally · no runs yet";
  if (runs === 1) return "Rally · 1 run in";
  return `Rally · ${runs} runs in`;
}
