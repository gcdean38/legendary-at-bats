import { GENERIC_ARSENAL, generateOpeningSequence, arsenalFromPitches } from "@/lib/arsenal";
import { MAX_PITCHES_PER_AB } from "@/lib/count";
import { playResultLabel } from "@/lib/contact";
import {
  BOT9_DEFICIT,
  BOT9_MAX_BATTERS,
  BOT9_SCENARIOS,
  type Bot9Difficulty,
} from "@/data/bot9-scenarios";
import {
  REWRITE_LINEUPS,
  type RewriteBatter,
} from "@/data/rewrite-lineups";
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

export type { Bot9Difficulty };
export { BOT9_DEFICIT, BOT9_MAX_BATTERS, BOT9_SCENARIOS };

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
  pitcher: {
    name?: string;
    team: string;
    number: number;
    throws: "L" | "R";
  };
  /** Batting franchise nickname (or city for Bot 9) */
  battingTeam: string;
  /** Pitching franchise nickname (or city for Bot 9) */
  pitchingTeam: string;
  /** Series context carried into generated follow-up ABs */
  year: number;
  series: string;
  gameLabel: string;
  venue: string;
  batterIndex: number;
  runsThisInning: number;
  kind: "bot9" | "rewrite";
  /** Pitch templates for arsenal draws (legendary mix on rewrite) */
  arsenalTemplates: SeedPitch[];
  /** Legendary moment id that seeded this rewrite rally */
  sourceMomentId?: string;
  sourceCodename?: string;
  /**
   * Queued teammates for rewrite (and future Bot 9 pools).
   * Consumed one PA at a time in atBatFromInning.
   */
  lineupQueue: RewriteBatter[];
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
  /** Cap on named Bot 9 batters (7 / 8 / 9 by deficit) */
  maxBatters?: number;
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

function battingTeamTied(state: InningState): boolean {
  return state.home.runs === state.away.runs;
}

/** Walk-off / took the lead. */
export function isWalkOff(state: InningState): boolean {
  return battingTeamAhead(state);
}

/**
 * Bot 9 / rewrite: half ended with the game still knotted (3 outs, score tied).
 * Mid-inning ties keep the rally going — only the third out locks the partial win
 * (extras from the bottom, or “finish the comeback” from the top).
 */
export function isTiedForExtras(state: InningState): boolean {
  return (
    (state.kind === "bot9" || state.kind === "rewrite") &&
    state.outs >= 3 &&
    battingTeamTied(state)
  );
}

/** @deprecated Use {@link isTiedForExtras} */
export function isBot9TiedForExtras(state: InningState): boolean {
  return isTiedForExtras(state);
}

/** Stars for a finished Bot 9 / rewrite half (walk-off 3 · tie 2 · else last AB). */
export function inningResultStars(
  state: InningState,
  session: AtBatSessionResult,
): number {
  if (battingTeamAhead(state)) return 3;
  if (isTiedForExtras(state)) return 2;
  return session.stars;
}

/** Result blurb when the half ends in a tie. */
export function tiedExtrasBlurb(state: InningState): string {
  if (state.half === "top") {
    return "Hopefully your team can finish the comeback";
  }
  return "Hopefully your team will come through in extras";
}

/** Three outs, or batting side already ahead (walk-off). */
export function isInningOver(state: InningState): boolean {
  return state.outs >= 3 || battingTeamAhead(state);
}

export function abLogLine(play: PlayResult, runsScored: number): string {
  const base = playResultLabel(play);
  return runsScored > 0 ? `${base} · ${runsScored} R` : base;
}

/**
 * After a legendary AB for the side that lost historically: if the player
 * reaches / plates and the rally is still alive (outs remain, not ahead),
 * offer to keep rewriting history with the next batters.
 *
 * Winning-team moments (historical success) never offer rewrite — the
 * legend already flipped. Deep-hole or not doesn't matter (e.g. Martinez
 * down 1 with traffic still qualifies).
 */
export function shouldOfferRewriteContinue(
  atBat: LegendaryAtBat,
  session: AtBatSessionResult,
): boolean {
  // Only when batting as the team that ended up losing this moment.
  if (atBat.historical.batterSucceeded) return false;
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

/**
 * Bottom of the 9th: home batting, empty bases, 0 outs.
 * Deficit, closer, arsenal, and sized lineup come from a real playoff seed.
 */
export function createInning(
  difficulty: Bot9Difficulty = "medium",
  rng: () => number = Math.random,
): InningState {
  const startDeficit = BOT9_DEFICIT[difficulty];
  const maxBatters = BOT9_MAX_BATTERS[difficulty];
  const pool = BOT9_SCENARIOS[difficulty];
  const scenario = pool[Math.floor(rng() * pool.length)]!;
  const lineup = scenario.lineup.slice(0, maxBatters);

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
      name: scenario.pitcher.name,
      team: scenario.awayTeam,
      number: scenario.pitcher.number,
      throws: scenario.pitcher.throws,
    },
    battingTeam: scenario.homeTeam,
    pitchingTeam: scenario.awayTeam,
    year: scenario.year,
    series: scenario.series,
    gameLabel: scenario.gameLabel,
    venue: scenario.venue,
    batterIndex: 1,
    runsThisInning: 0,
    kind: "bot9",
    arsenalTemplates: generateOpeningSequence(scenario.pitcher.arsenal, 6, rng),
    lineupQueue: lineup.map((b) => ({ ...b })),
    maxBatters,
    bot9: {
      year: scenario.year,
      series: scenario.series,
      gameLabel: scenario.gameLabel,
      venue: scenario.venue,
      homeCity: scenario.homeTeam,
      awayCity: scenario.awayTeam,
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
    batterLabel: atBat.batter.name
      ? atBat.batter.name
      : `${atBat.batter.team} #${atBat.batter.number}`,
    play: session.finalPlay,
    runsScored: session.runsScored,
    line: abLogLine(session.finalPlay, session.runsScored),
  };

  // Skip anyone who already had the legendary PA.
  const followUps = (REWRITE_LINEUPS[atBat.id] ?? []).filter(
    (b) =>
      b.name !== atBat.batter.name && b.number !== atBat.batter.number,
  );

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
    battingTeam: atBat.batter.team,
    pitchingTeam: atBat.pitcher.team,
    year: atBat.year,
    series: atBat.series,
    gameLabel: atBat.gameLabel,
    venue: atBat.venue,
    batterIndex: 2,
    runsThisInning: session.runsScored,
    kind: "rewrite",
    // Pitcher's mix from the legendary script — each AB re-rolls fresh locations.
    arsenalTemplates: (() => {
      const mix = arsenalFromPitches(atBat.pitches);
      return generateOpeningSequence(mix.length > 0 ? mix : GENERIC_ARSENAL, 6);
    })(),
    sourceMomentId: atBat.id,
    sourceCodename: atBat.codename,
    lineupQueue: followUps.map((b) => ({ ...b })),
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

/**
 * Consume the next scripted teammate (or a franchise placeholder) and
 * return the updated inning state + the plate appearance to play.
 */
export function dealNextAtBat(
  state: InningState,
  rng: () => number = Math.random,
): { state: InningState; atBat: LegendaryAtBat } {
  const queued = state.lineupQueue[0];
  const lineupQueue = queued ? state.lineupQueue.slice(1) : state.lineupQueue;
  const batter = queued
    ? {
        name: queued.name,
        team: state.battingTeam,
        number: queued.number,
        bats: queued.bats,
      }
    : {
        team: state.battingTeam,
        number: 1 + Math.floor(rng() * 99),
        bats: BAT_HANDS[Math.floor(rng() * BAT_HANDS.length)]!,
      };
  const nextState = { ...state, lineupQueue };
  return { state: nextState, atBat: buildAtBatFromInning(nextState, batter, rng) };
}

function buildAtBatFromInning(
  state: InningState,
  batter: {
    name?: string;
    team: string;
    number: number;
    bats: "L" | "R" | "S";
  },
  rng: () => number,
): LegendaryAtBat {
  const runners = runnersLabel(state.bases);
  const deficit = state.battingHome
    ? Math.max(0, state.away.runs - state.home.runs)
    : Math.max(0, state.home.runs - state.away.runs);
  const label =
    state.half === "bottom"
      ? `Bottom ${state.inningNumber}`
      : `Top ${state.inningNumber}`;
  const isLeadOff = state.abLog.length === 0;

  const who = batter.name ?? `${batter.team} #${batter.number}`;
  const copy =
    isLeadOff && state.kind === "bot9"
      ? deficitCopy(state.startDeficit, state.bot9)
      : {
          blurb:
            state.kind === "rewrite"
              ? `${who} steps in. ${label}, ${state.outs} out${state.outs === 1 ? "" : "s"}, ${runners.toLowerCase()}. Still ${
                  deficit === 0 ? "tied" : `down ${deficit}`
                }.`
              : `${label}, ${state.outs} out${state.outs === 1 ? "" : "s"}, ${runners.toLowerCase()}. Still ${
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
    year: state.year,
    series:
      state.kind === "rewrite"
        ? "Rewrite history"
        : state.series,
    gameLabel:
      state.kind === "rewrite"
        ? batter.name ?? `Batter ${state.batterIndex}`
        : state.gameLabel,
    inning: label,
    venue: state.venue,
    outs: state.outs,
    away: state.away,
    home: state.home,
    bases: { ...state.bases },
    runners,
    batter,
    pitcher: {
      name: state.pitcher.name,
      team: state.pitchingTeam,
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
  batter: { name?: string; team: string; number: number },
): InningState {
  const entry: AbLogEntry = {
    batterIndex: state.batterIndex,
    batterLabel: batter.name
      ? batter.name
      : `${batter.team} #${batter.number}`,
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
    if (state.kind === "rewrite") {
      return margin === 1
        ? "You rewrote history · walk-off"
        : `You rewrote history · won by ${margin}`;
    }
    if (state.half === "bottom" && state.battingHome) {
      return margin === 1 ? "Walk-off win" : `Walk-off · won by ${margin}`;
    }
    return margin === 1 ? "Took the lead" : `Took the lead · up ${margin}`;
  }
  if (isTiedForExtras(state)) {
    return state.half === "top"
      ? "Tied · hopefully your team can finish the comeback"
      : "Tied · hopefully your team will come through in extras";
  }
  if (state.outs >= 3) {
    if (state.kind === "rewrite") {
      return "Rally fell short · the original ending stands";
    }
    const stillDown = state.battingHome
      ? state.away.runs - state.home.runs
      : state.home.runs - state.away.runs;
    if (stillDown > 0) return `Final · still down ${stillDown}`;
    return "Final · tied";
  }
  const runs = state.runsThisInning;
  if (runs === 0) return "Rally · no runs yet";
  if (runs === 1) return "Rally · 1 run in";
  return `Rally · ${runs} runs in`;
}
