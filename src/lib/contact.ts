import type {
  BasesState,
  ExitKind,
  PitchEvent,
  PlayResult,
  ZoneCoord,
} from "@/lib/types";

export type ContactEstimate = {
  /** -1 topped (ground ball) … 0 square … +1 undercut (fly) */
  vertical: number;
  /** 0–1 overall quality from proximity + timing */
  quality: number;
  /**
   * Launch angle in degrees — always consistent with the play band:
   * ground ≤ 8°, line 10–24°, fly ≥ 25°.
   */
  launchDeg: number;
  /** Stylized exit velocity (mph) from contact quality — not Statcast. */
  exitVeloMph: number;
  play: PlayResult;
  exitKind: ExitKind;
  /** Does this end the at-bat? */
  endsAb: boolean;
  event: PitchEvent;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function dist(a: ZoneCoord, b: ZoneCoord) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Timing quality 0–1; ideal ~82% of the flight window. */
function timingFactor(elapsedMs: number, windowMs: number) {
  if (windowMs <= 0) return 0;
  const ideal = windowMs * 0.82;
  const delta = Math.abs(elapsedMs - ideal);
  const tolerance = windowMs * 0.35;
  return clamp(1 - delta / tolerance, 0, 1);
}

/**
 * Map bat vertical mishit (-1…+1) → launch angle with bands that match
 * how we classify plays (so you never see a 14° “ground out”).
 */
function launchFromVertical(vertical: number): {
  launchDeg: number;
  band: "ground" | "line" | "fly";
} {
  if (vertical < -0.1) {
    // Map vertical -1…-0.1 → launch -20°…8°
    const t = (vertical + 1) / 0.9;
    return {
      launchDeg: Math.round(-20 + clamp(t, 0, 1) * 28),
      band: "ground",
    };
  }
  if (vertical > 0.1) {
    // Map vertical 0.1…1 → launch 25°…48°
    const t = (vertical - 0.1) / 0.9;
    return {
      launchDeg: Math.round(25 + clamp(t, 0, 1) * 23),
      band: "fly",
    };
  }
  // Map vertical -0.1…0.1 → launch 10°…24°
  const t = (vertical + 0.1) / 0.2;
  return {
    launchDeg: Math.round(10 + clamp(t, 0, 1) * 14),
    band: "line",
  };
}

/** Quality 0–1 → stylized exit velo. Barrels approach ~105+. */
function exitVeloFromQuality(quality: number): number {
  return Math.round(55 + quality * 55);
}

/**
 * Stylized contact → play result (deterministic thresholds, not RNG odds).
 * Hits must be clearly squared up; ordinary solid contact becomes outs.
 * Force-situation grounders with <2 outs become double plays.
 */
export function estimateContact(opts: {
  pitchLoc: ZoneCoord;
  aim: ZoneCoord;
  timingMs: number;
  windowMs: number;
  bases: BasesState;
  outs: number;
}): ContactEstimate {
  const { pitchLoc, aim, bases, outs } = opts;
  const distance = dist(aim, pitchLoc);
  const tFactor = timingFactor(opts.timingMs, opts.windowMs);

  // y grows downward: aim below the ball (higher y) = undercut = fly
  const vertical = clamp((aim.y - pitchLoc.y) / 0.18, -1, 1);
  const proximity = clamp(1 - distance / 0.38, 0, 1);
  const quality = clamp(proximity * 0.5 + tFactor * 0.5, 0, 1);
  const { launchDeg, band } = launchFromVertical(vertical);
  const exitVeloMph = exitVeloFromQuality(quality);

  if (quality < 0.22 || (distance > 0.34 && tFactor < 0.42)) {
    return {
      vertical,
      quality,
      launchDeg,
      exitVeloMph,
      play: "whiff",
      exitKind: "whiff",
      endsAb: false,
      event: "strike",
    };
  }

  if (quality < 0.42) {
    return {
      vertical,
      quality,
      launchDeg,
      exitVeloMph,
      play: "foul",
      exitKind: "ground",
      endsAb: false,
      event: "foul",
    };
  }

  // ---- Flies ----
  if (band === "fly") {
    if (quality >= 0.94 && launchDeg >= 28) {
      return pack("home_run", "crush", vertical, quality, launchDeg, exitVeloMph);
    }
    if (bases.third && outs < 2 && quality >= 0.5 && quality < 0.94) {
      return pack("sac_fly", "line", vertical, quality, launchDeg, exitVeloMph);
    }
    if (quality >= 0.92 && launchDeg < 32) {
      return pack("double", "line", vertical, quality, launchDeg, exitVeloMph);
    }
    return pack("fly_out", "line", vertical, quality, launchDeg, exitVeloMph);
  }

  // ---- Ground balls ----
  if (band === "ground") {
    if (quality >= 0.93) {
      return pack("single", "ground", vertical, quality, launchDeg, exitVeloMph);
    }
    // Force DP whenever first is occupied and there's room for two outs
    if (bases.first && outs < 2) {
      return pack(
        "double_play",
        "ground",
        vertical,
        quality,
        launchDeg,
        exitVeloMph,
      );
    }
    return pack("ground_out", "ground", vertical, quality, launchDeg, exitVeloMph);
  }

  // ---- Line drives ----
  if (quality >= 0.95) {
    return pack("double", "crush", vertical, quality, launchDeg, exitVeloMph);
  }
  if (quality >= 0.9) {
    return pack("single", "line", vertical, quality, launchDeg, exitVeloMph);
  }
  return pack("line_out", "line", vertical, quality, launchDeg, exitVeloMph);
}

function pack(
  play: PlayResult,
  exitKind: ExitKind,
  vertical: number,
  quality: number,
  launchDeg: number,
  exitVeloMph: number,
): ContactEstimate {
  const endsAb = play !== "foul" && play !== "whiff";
  const event: PitchEvent =
    play === "foul"
      ? "foul"
      : play === "whiff"
        ? "strike"
        : play === "home_run" || play === "double" || play === "single"
          ? "hit"
          : "out";
  return {
    vertical,
    quality,
    launchDeg,
    exitVeloMph,
    play,
    exitKind,
    endsAb,
    event,
  };
}

export function playResultLabel(play: PlayResult): string {
  switch (play) {
    case "home_run":
      return "Home run";
    case "double":
      return "Double";
    case "single":
      return "Single";
    case "walk":
      return "Walk";
    case "sac_fly":
      return "Sacrifice fly";
    case "fly_out":
      return "Fly out";
    case "ground_out":
      return "Ground out";
    case "double_play":
      return "Double play";
    case "line_out":
      return "Line out";
    case "strikeout":
      return "Strikeout";
    case "foul":
      return "Foul";
    case "ball":
      return "Ball";
    case "strike_looking":
      return "Strike looking";
    case "whiff":
      return "Swing and miss";
  }
}

export type ExitPathStyle =
  | "hr"
  | "double"
  | "liner"
  | "ground_single"
  | "fly_out"
  | "ground_out"
  | "sac"
  | "whiff"
  | "take";

export function pathStyleForPlay(play: PlayResult): ExitPathStyle {
  switch (play) {
    case "home_run":
      return "hr";
    case "double":
      return "double";
    case "single":
      return "ground_single";
    case "sac_fly":
      return "sac";
    case "fly_out":
      return "fly_out";
    case "ground_out":
    case "double_play":
      return "ground_out";
    case "line_out":
      return "liner";
    case "whiff":
      return "whiff";
    case "walk":
    case "ball":
    case "strike_looking":
    case "strikeout":
    case "foul":
    default:
      return "take";
  }
}

/**
 * Human-readable outcome ladder by contact quality (for docs / UI).
 * Deterministic thresholds — there is no RNG roll.
 */
export const CONTACT_OUTCOME_GUIDE = {
  whiff: "quality < 0.22 (or big miss + bad timing)",
  foul: "quality < 0.42",
  ground: {
    band: "launch ≤ 8° (bat under the ball / topped)",
    single: "quality ≥ 0.93",
    double_play: "else if runner on 1st and outs < 2",
    ground_out: "else",
  },
  line: {
    band: "launch 10–24°",
    double: "quality ≥ 0.95",
    single: "quality ≥ 0.90",
    line_out: "else",
  },
  fly: {
    band: "launch ≥ 25°",
    home_run: "quality ≥ 0.94 and launch ≥ 28°",
    sac_fly: "R3, outs < 2, quality 0.50–0.94",
    double: "quality ≥ 0.92 and launch < 32°",
    fly_out: "else",
  },
  exitVelo: "mph ≈ 55 + quality×55 (flavor only)",
} as const;
