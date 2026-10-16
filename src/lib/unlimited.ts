import {
  GENERIC_ARSENAL,
  generateOpeningSequence,
} from "@/lib/arsenal";
import type { BasesState, LegendaryAtBat } from "@/lib/types";

type SituationSeed = {
  inning: string;
  outs: number;
  bases: BasesState;
  runners: string;
  awayRuns: number;
  homeRuns: number;
  blurb: string;
  stakes: string;
};

const SITUATIONS: SituationSeed[] = [
  {
    inning: "Top 7",
    outs: 0,
    bases: { first: false, second: false, third: false },
    runners: "Bases empty",
    awayRuns: 2,
    homeRuns: 2,
    blurb: "Tied late. You’re the visiting batter against a generic arm — work a quality AB.",
    stakes: "Start a rally or keep the line moving.",
  },
  {
    inning: "Bottom 8",
    outs: 1,
    bases: { first: true, second: false, third: false },
    runners: "Runner on first",
    awayRuns: 3,
    homeRuns: 2,
    blurb: "Down one, runner on. Protect the plate and look for something to drive.",
    stakes: "A knock here puts the tying run in scoring position.",
  },
  {
    inning: "Top 9",
    outs: 0,
    bases: { first: false, second: true, third: false },
    runners: "Runner on second",
    awayRuns: 4,
    homeRuns: 4,
    blurb: "Extra-inning feel, runner in scoring position. Don’t expand early.",
    stakes: "A productive AB can decide the frame.",
  },
  {
    inning: "Bottom 6",
    outs: 2,
    bases: { first: true, second: false, third: true },
    runners: "Runners on the corners",
    awayRuns: 1,
    homeRuns: 1,
    blurb: "Two outs, corners. The pitcher wants soft contact — stay on top of the ball.",
    stakes: "One good swing changes everything.",
  },
  {
    inning: "Top 3",
    outs: 0,
    bases: { first: false, second: false, third: false },
    runners: "Bases empty",
    awayRuns: 0,
    homeRuns: 0,
    blurb: "Clean inning opener. See pitches, hunt a mistake.",
    stakes: "Set the tone for the rest of the game.",
  },
  {
    inning: "Bottom 9",
    outs: 1,
    bases: { first: false, second: true, third: true },
    runners: "Runners on second and third",
    awayRuns: 5,
    homeRuns: 4,
    blurb: "Walk-off territory. Down one with two in scoring position.",
    stakes: "Do your job — fly ball or hard contact wins it.",
  },
];

const BAT_HANDS: Array<"L" | "R" | "S"> = ["R", "R", "L", "L", "S"];
const THROW_HANDS: Array<"L" | "R"> = ["R", "R", "R", "L"];

/**
 * Procedural at-bat for Unlimited mode — generic pitcher, fresh arsenal
 * sequence, no historical script to match.
 */
export function generateUnlimitedAtBat(
  abNumber: number,
  rng: () => number = Math.random,
): LegendaryAtBat {
  const sit = SITUATIONS[Math.floor(rng() * SITUATIONS.length)]!;
  const bats = BAT_HANDS[Math.floor(rng() * BAT_HANDS.length)]!;
  const throws = THROW_HANDS[Math.floor(rng() * THROW_HANDS.length)]!;
  const batterNum = 1 + Math.floor(rng() * 99);
  const pitcherNum = 1 + Math.floor(rng() * 99);
  const opening = generateOpeningSequence(GENERIC_ARSENAL, 4, rng);

  return {
    id: `unlimited-${abNumber}`,
    codename: `Unlimited · AB ${abNumber}`,
    year: 2026,
    series: "Unlimited",
    gameLabel: `At-bat ${abNumber}`,
    inning: sit.inning,
    venue: "Practice Field",
    outs: sit.outs,
    away: { abbr: "AWY", runs: sit.awayRuns },
    home: { abbr: "HME", runs: sit.homeRuns },
    bases: sit.bases,
    runners: sit.runners,
    batter: { team: "Home", number: batterNum, bats },
    pitcher: { team: "Away", number: pitcherNum, throws },
    situationBlurb: sit.blurb,
    stakes: sit.stakes,
    pitches: opening,
    historical: {
      outcome: "single",
      batterSucceeded: true,
      summary:
        "Unlimited mode — no historical outcome. Keep working ABs against the arsenal.",
    },
  };
}
