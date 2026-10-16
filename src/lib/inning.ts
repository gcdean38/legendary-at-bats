import {
  GENERIC_ARSENAL,
  generateOpeningSequence,
} from "@/lib/arsenal";
import { runnersLabel } from "@/lib/situation";
import type {
  AtBatSessionResult,
  BasesState,
  LegendaryAtBat,
  ScoreSide,
} from "@/lib/types";

export type InningState = {
  half: "top" | "bottom";
  inningNumber: number;
  outs: number;
  bases: BasesState;
  away: ScoreSide;
  home: ScoreSide;
  /** Fixed pitcher for the half-inning */
  pitcher: { team: string; number: number; throws: "L" | "R" };
  /** Batter number in this half (1 = leadoff) */
  batterIndex: number;
  runsThisInning: number;
};

const BAT_HANDS: Array<"L" | "R" | "S"> = ["R", "R", "L", "L", "S"];

function emptyBases(): BasesState {
  return { first: false, second: false, third: false };
}

function inningLabel(half: "top" | "bottom", n: number): string {
  const word = half === "top" ? "Top" : "Bottom";
  return `${word} ${n}`;
}

/** Start a fresh half-inning (0 outs, empty bases). */
export function createInning(rng: () => number = Math.random): InningState {
  const half: "top" | "bottom" = rng() < 0.5 ? "top" : "bottom";
  const inningNumber = 1 + Math.floor(rng() * 9);
  const tied = rng() < 0.55;
  const homeRuns = tied ? Math.floor(rng() * 5) : Math.floor(rng() * 6);
  const awayRuns = tied
    ? homeRuns
    : Math.max(0, homeRuns + (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 2)));
  const throws: "L" | "R" = rng() < 0.25 ? "L" : "R";
  const pitchingTeam = half === "bottom" ? "Away" : "Home";

  return {
    half,
    inningNumber,
    outs: 0,
    bases: emptyBases(),
    away: { abbr: "AWY", runs: awayRuns },
    home: { abbr: "HME", runs: homeRuns },
    pitcher: {
      team: pitchingTeam,
      number: 1 + Math.floor(rng() * 99),
      throws,
    },
    batterIndex: 1,
    runsThisInning: 0,
  };
}

export function isInningOver(state: InningState): boolean {
  return state.outs >= 3;
}

/** Build the next plate appearance from current inning state. */
export function atBatFromInning(
  state: InningState,
  rng: () => number = Math.random,
): LegendaryAtBat {
  const battingHome = state.half === "bottom";
  const batterTeam = battingHome ? "Home" : "Away";
  const bats = BAT_HANDS[Math.floor(rng() * BAT_HANDS.length)]!;
  const batterNum = 1 + Math.floor(rng() * 99);
  const label = inningLabel(state.half, state.inningNumber);
  const runners = runnersLabel(state.bases);
  const opening = generateOpeningSequence(GENERIC_ARSENAL, 4, rng);

  return {
    id: `inning-${state.inningNumber}-${state.half}-b${state.batterIndex}`,
    codename: `Inning · ${label}`,
    year: 2026,
    series: "Inning",
    gameLabel: `Batter ${state.batterIndex}`,
    inning: label,
    venue: "Practice Field",
    outs: state.outs,
    away: state.away,
    home: state.home,
    bases: { ...state.bases },
    runners,
    batter: { team: batterTeam, number: batterNum, bats },
    pitcher: { ...state.pitcher },
    situationBlurb:
      state.batterIndex === 1
        ? `${label}. You’re the leadoff batter — work the count and set the table.`
        : `${label}, ${state.outs} out${state.outs === 1 ? "" : "s"}, ${runners.toLowerCase()}. Keep the line moving.`,
    stakes:
      state.outs >= 2
        ? "Two outs — something hard to drive in a run."
        : "Put the ball in play and push the inning forward.",
    pitches: opening,
    historical: {
      outcome: "single",
      batterSucceeded: true,
      summary: "Inning mode — no historical script. String batters until three outs.",
    },
  };
}

/**
 * Fold a finished AB into inning state.
 * Uses the session board (already baserunner-applied).
 */
export function advanceInning(
  state: InningState,
  session: AtBatSessionResult,
): InningState {
  return {
    ...state,
    outs: session.board.outs,
    bases:
      session.board.outs >= 3 ? emptyBases() : { ...session.board.bases },
    away: { ...session.board.away },
    home: { ...session.board.home },
    batterIndex: state.batterIndex + 1,
    runsThisInning: state.runsThisInning + session.runsScored,
  };
}

export function inningSummary(state: InningState): string {
  const label = inningLabel(state.half, state.inningNumber);
  const runs = state.runsThisInning;
  if (runs === 0) return `${label} · scoreless`;
  if (runs === 1) return `${label} · 1 run`;
  return `${label} · ${runs} runs`;
}
