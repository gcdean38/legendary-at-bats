import { GENERIC_ARSENAL, generateOpeningSequence } from "@/lib/arsenal";
import { MAX_PITCHES_PER_AB } from "@/lib/count";
import { runnersLabel } from "@/lib/situation";
import type {
  AtBatSessionResult,
  BasesState,
  LegendaryAtBat,
  ScoreSide,
} from "@/lib/types";

export type InningState = {
  /** Always bottom of the 9th in this mode */
  half: "bottom";
  inningNumber: 9;
  outs: number;
  bases: BasesState;
  away: ScoreSide;
  home: ScoreSide;
  /** Runs the home team trailed by at the start (0 = tied … 3) */
  startDeficit: number;
  /** Fixed closer / simulated pitcher for the inning */
  pitcher: { team: string; number: number; throws: "L" | "R" };
  /** Batter number in this half (1 = leadoff) */
  batterIndex: number;
  runsThisInning: number;
};

const BAT_HANDS: Array<"L" | "R" | "S"> = ["R", "R", "L", "L", "S"];

function emptyBases(): BasesState {
  return { first: false, second: false, third: false };
}

/** Home took the lead — walk-off win. */
export function isWalkOff(state: InningState): boolean {
  return state.home.runs > state.away.runs;
}

/** Three outs still behind/tied, or already walked it off. */
export function isInningOver(state: InningState): boolean {
  return state.outs >= 3 || isWalkOff(state);
}

export function runsNeeded(state: InningState): number {
  return Math.max(0, state.away.runs - state.home.runs + 1);
}

/**
 * Bottom of the 9th: home batting, down 0–3 runs (0 = tied),
 * empty bases, 0 outs. Simulated pitcher with a full arsenal.
 */
export function createInning(rng: () => number = Math.random): InningState {
  const startDeficit = Math.floor(rng() * 4); // 0, 1, 2, or 3
  const awayRuns = 2 + Math.floor(rng() * 5); // 2–6
  const homeRuns = awayRuns - startDeficit;
  const throws: "L" | "R" = rng() < 0.28 ? "L" : "R";

  return {
    half: "bottom",
    inningNumber: 9,
    outs: 0,
    bases: emptyBases(),
    away: { abbr: "AWY", runs: awayRuns },
    home: { abbr: "HME", runs: homeRuns },
    startDeficit,
    pitcher: {
      team: "Away",
      number: 1 + Math.floor(rng() * 99),
      throws,
    },
    batterIndex: 1,
    runsThisInning: 0,
  };
}

function deficitCopy(deficit: number): { blurb: string; stakes: string } {
  if (deficit === 0) {
    return {
      blurb: "Bottom of the ninth, tied. One run wins it — walk it off.",
      stakes: "Don’t leave it on the table. End it here.",
    };
  }
  if (deficit === 1) {
    return {
      blurb: "Bottom of the ninth, down one. Tie it or walk it off.",
      stakes: "One swing can rewrite the night.",
    };
  }
  return {
    blurb: `Bottom of the ninth, down ${deficit}. Put a rally together before three outs.`,
    stakes: `You need ${deficit} to tie and ${deficit + 1} to win.`,
  };
}

/** Next plate appearance — every pitch is a fresh arsenal throw (random location). */
export function atBatFromInning(
  state: InningState,
  rng: () => number = Math.random,
): LegendaryAtBat {
  const bats = BAT_HANDS[Math.floor(rng() * BAT_HANDS.length)]!;
  const batterNum = 1 + Math.floor(rng() * 99);
  const runners = runnersLabel(state.bases);
  const deficit = Math.max(0, state.away.runs - state.home.runs);
  const copy =
    state.batterIndex === 1
      ? deficitCopy(state.startDeficit)
      : {
          blurb: `Bottom 9, ${state.outs} out${state.outs === 1 ? "" : "s"}, ${runners.toLowerCase()}. Still ${
            deficit === 0 ? "tied" : `down ${deficit}`
          }.`,
          stakes:
            deficit === 0
              ? "Walk-off territory — one run ends it."
              : `Need ${deficit} to tie, ${deficit + 1} to win.`,
        };

  // Full pre-roll of arsenal pitches so nothing cycles a scripted location
  const pitches = generateOpeningSequence(
    GENERIC_ARSENAL,
    MAX_PITCHES_PER_AB,
    rng,
  );

  return {
    id: `bot9-b${state.batterIndex}-${state.away.runs}-${state.home.runs}`,
    codename: "Bottom of the 9th",
    year: 2026,
    series: "Bottom of the 9th",
    gameLabel: `Batter ${state.batterIndex}`,
    inning: "Bottom 9",
    venue: "Practice Field",
    outs: state.outs,
    away: state.away,
    home: state.home,
    bases: { ...state.bases },
    runners,
    batter: { team: "Home", number: batterNum, bats },
    pitcher: { ...state.pitcher },
    situationBlurb: copy.blurb,
    stakes: copy.stakes,
    pitches,
    historical: {
      outcome: "single",
      batterSucceeded: true,
      summary:
        "Bottom of the 9th mode — come back or walk it off against a full arsenal.",
    },
  };
}

/**
 * Fold a finished AB into inning state.
 * Walk-off (home ahead) ends the inning immediately.
 */
export function advanceInning(
  state: InningState,
  session: AtBatSessionResult,
): InningState {
  const next: InningState = {
    ...state,
    outs: session.board.outs,
    bases:
      session.board.outs >= 3 || session.board.home.runs > session.board.away.runs
        ? emptyBases()
        : { ...session.board.bases },
    away: { ...session.board.away },
    home: { ...session.board.home },
    batterIndex: state.batterIndex + 1,
    runsThisInning: state.runsThisInning + session.runsScored,
  };
  return next;
}

export function inningSummary(state: InningState): string {
  if (isWalkOff(state)) {
    const margin = state.home.runs - state.away.runs;
    return margin === 1
      ? "Walk-off win"
      : `Walk-off · won by ${margin}`;
  }
  if (state.outs >= 3) {
    const stillDown = state.away.runs - state.home.runs;
    if (stillDown > 0) return `Final · still down ${stillDown}`;
    return "Final · tied, extras denied";
  }
  const runs = state.runsThisInning;
  if (runs === 0) return "Bottom 9 · no runs yet";
  if (runs === 1) return "Bottom 9 · 1 run in";
  return `Bottom 9 · ${runs} runs in`;
}
