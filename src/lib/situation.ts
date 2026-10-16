import type {
  AtBatEndReason,
  BasesState,
  EndingTone,
  LegendaryAtBat,
  PlayResult,
  ScoreSide,
} from "@/lib/types";

export function runnersLabel(bases: BasesState): string {
  const n =
    (bases.first ? 1 : 0) + (bases.second ? 1 : 0) + (bases.third ? 1 : 0);
  if (n === 0) return "Bases empty";
  if (bases.first && bases.second && bases.third) return "Bases loaded";
  if (bases.first && bases.third) return "Runners on the corners";
  if (bases.second && bases.third) return "Runners on second and third";
  if (bases.first && bases.second) return "Runners on first and second";
  if (bases.first) return "Runner on first";
  if (bases.second) return "Runner on second";
  return "Runner on third";
}

export function parseInning(inning: string): {
  half: "top" | "bottom";
  number: number;
} {
  const lower = inning.toLowerCase();
  const half = lower.includes("bottom") ? "bottom" : "top";
  const m = lower.match(/(\d+)/);
  return { half, number: m ? Number(m[1]) : 9 };
}

/** Is the batter the home team? Infer from batter team vs home abbr / name. */
export function batterIsHome(atBat: LegendaryAtBat): boolean {
  const team = atBat.batter.team.toLowerCase();
  const home = atBat.home.abbr.toLowerCase();
  const map: Record<string, string[]> = {
    tor: ["toronto"],
    tex: ["texas", "arlington"],
    ari: ["arizona"],
    lad: ["los angeles"],
    hou: ["houston"],
    bos: ["boston"],
    cle: ["cleveland"],
    phi: ["philadelphia"],
    nyy: ["new york"],
    sea: ["seattle"],
    bal: ["baltimore"],
    stl: ["st. louis", "st louis"],
    tb: ["tampa bay", "st. petersburg"],
    wsh: ["washington"],
    chc: ["chicago"],
  };
  const aliases = map[home] ?? [];
  if (aliases.some((a) => team.includes(a))) return true;
  // Fallback: bottom of inning ⇒ batting team is home
  return parseInning(atBat.inning).half === "bottom";
}

export function applyBaserunning(
  bases: BasesState,
  play: PlayResult,
  currentOuts = 0,
): { bases: BasesState; runs: number; outsRecorded: number } {
  let runs = 0;
  let first = bases.first;
  let second = bases.second;
  let third = bases.third;

  if (play === "home_run") {
    runs = (first ? 1 : 0) + (second ? 1 : 0) + (third ? 1 : 0) + 1;
    return {
      bases: { first: false, second: false, third: false },
      runs,
      outsRecorded: 0,
    };
  }

  if (play === "double") {
    if (third) runs += 1;
    if (second) runs += 1;
    third = first;
    second = true;
    first = false;
    return { bases: { first, second, third }, runs, outsRecorded: 0 };
  }

  if (play === "single" || play === "walk") {
    if (third) runs += 1;
    third = second;
    second = first;
    first = true;
    return { bases: { first, second, third }, runs, outsRecorded: 0 };
  }

  if (play === "sac_fly") {
    if (third) {
      runs += 1;
      third = false;
    }
    return { bases: { first, second, third }, runs, outsRecorded: 1 };
  }

  // Classic force DP: out at 2nd (R1) + batter at 1st. Other runners hold.
  if (play === "double_play") {
    const outsRecorded = Math.min(2, 3 - currentOuts);
    return {
      bases: { first: false, second, third },
      runs: 0,
      outsRecorded,
    };
  }

  if (
    play === "fly_out" ||
    play === "ground_out" ||
    play === "line_out" ||
    play === "strikeout"
  ) {
    return { bases, runs: 0, outsRecorded: 1 };
  }

  return { bases, runs: 0, outsRecorded: 0 };
}

function marginForBatter(
  away: ScoreSide,
  home: ScoreSide,
  isHome: boolean,
): number {
  return isHome ? home.runs - away.runs : away.runs - home.runs;
}

/**
 * Situation-aware ending copy after the AB resolves.
 */
export function resolveEndingNarrative(opts: {
  atBat: LegendaryAtBat;
  play: PlayResult;
  endReason: AtBatEndReason;
  runsScored: number;
}): {
  tone: EndingTone;
  title: string;
  blurb: string;
  playerCameThrough: boolean;
} {
  const { atBat, play, endReason, runsScored } = opts;
  const isHome = batterIsHome(atBat);
  const { half, number: inn } = parseInning(atBat.inning);
  const outs = atBat.outs;
  const before = marginForBatter(atBat.away, atBat.home, isHome);
  const after = before + runsScored;
  const late = inn >= 9;
  const walkOffWindow = isHome && half === "bottom" && late;

  const failed =
    endReason === "strikeout" ||
    endReason === "out" ||
    play === "fly_out" ||
    play === "ground_out" ||
    play === "double_play" ||
    play === "line_out" ||
    play === "strikeout" ||
    endReason === "max_pitches";

  const reachedOrExtra =
    play === "single" ||
    play === "double" ||
    play === "walk" ||
    play === "home_run" ||
    play === "sac_fly";

  // --- Failures ---
  if (failed && !reachedOrExtra) {
    if (play === "double_play") {
      const inningOver = outs + 2 >= 3;
      return {
        tone: inningOver ? "failed_lost" : "failed_hope",
        title: inningOver ? "Failed — double play ends it" : "Double play",
        blurb: inningOver
          ? "They turned two. That was the last chance. Better luck tomorrow."
          : "Force at second, out at first. They turned two — tough AB.",
        playerCameThrough: false,
      };
    }
    if (outs >= 2) {
      return {
        tone: "failed_lost",
        title: "Failed — game over",
        blurb:
          "Two outs. That was the last chance. Better luck tomorrow.",
        playerCameThrough: false,
      };
    }
    return {
      tone: "failed_hope",
      title: "You’re out",
      blurb:
        "Tough AB. Hopefully your teammates can pick you up from here.",
      playerCameThrough: false,
    };
  }

  // --- Wins / scoring ---
  if (play === "home_run") {
    if (walkOffWindow && after > 0) {
      return {
        tone: "won_game",
        title: "You won the game",
        blurb: "Walk-off. The building erupts — you rewrote the night.",
        playerCameThrough: true,
      };
    }
    if (after > 0 && before <= 0) {
      return {
        tone: "took_lead",
        title: "You took the lead",
        blurb: "That swing flipped the scoreboard. Huge moment.",
        playerCameThrough: true,
      };
    }
  }

  if (runsScored > 0) {
    if (walkOffWindow && after > 0) {
      return {
        tone: "won_game",
        title: "You won the game",
        blurb:
          play === "sac_fly"
            ? "Sacrifice fly — the runner tags, the game ends. Perfect piece of hitting."
            : "That plated the winner. Ballgame.",
        playerCameThrough: true,
      };
    }
    if (before < 0 && after === 0) {
      return {
        tone: "tied_game",
        title: "You tied it",
        blurb:
          "Run is in — game knotted up. Hopefully your teammates push it over the top.",
        playerCameThrough: true,
      };
    }
    if (before < 0 && after < 0) {
      return {
        tone: "scored_continue",
        title: "You plated a run",
        blurb:
          "Good piece of hitting. Still trailing — hope the next guys finish it.",
        playerCameThrough: true,
      };
    }
    if (after > 0) {
      return {
        tone: "took_lead",
        title: "You took the lead",
        blurb: "Runners came home. The scoreboard flipped in your favor.",
        playerCameThrough: true,
      };
    }
  }

  // Hard contact / reached base but game not over (e.g. bases-empty double in extras)
  if (
    play === "single" ||
    play === "double" ||
    play === "walk" ||
    (play === "home_run" && !(walkOffWindow && after > 0))
  ) {
    return {
      tone: "pass_the_baton",
      title: "Do your job",
      blurb:
        "Good AB — you did your job. The game’s still alive for the next guy.",
      playerCameThrough: true,
    };
  }

  if (play === "sac_fly") {
    return {
      tone: "scored_continue",
      title: "Productive out",
      blurb: "Runner tags and scores. You moved the needle.",
      playerCameThrough: true,
    };
  }

  if (outs >= 2) {
    return {
      tone: "failed_lost",
      title: "Failed — game over",
      blurb: "Two outs. That was the last chance. Better luck tomorrow.",
      playerCameThrough: false,
    };
  }

  return {
    tone: "failed_hope",
    title: "You’re out",
    blurb: "Hopefully your teammates can pick you up.",
    playerCameThrough: false,
  };
}
