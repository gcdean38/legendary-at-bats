import type {
  BasesState,
  ExitKind,
  PitchEvent,
  PlayResult,
  ZoneCoord,
} from "@/lib/types";

export type BatterHand = "L" | "R" | "S";

export type ContactEstimate = {
  /** -1 topped (ground ball) … 0 square … +1 undercut (fly) */
  vertical: number;
  /** 0–1 overall quality from proximity + timing */
  quality: number;
  /**
   * Launch angle in degrees — always consistent with the play band:
   * ground ≤ 5°, line 8–24°, fly ≥ 25°.
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
 * how we classify plays (so you never see an 8° “ground out”).
 */
function launchFromVertical(vertical: number): {
  launchDeg: number;
  band: "ground" | "line" | "fly";
} {
  // Bands match real BIP taxonomy so you never see e.g. 8° labeled a grounder:
  // ground ≤ 5°, line 8–24°, fly ≥ 25°.
  if (vertical < -0.1) {
    // Map vertical -1…-0.1 → launch -20°…5°
    const t = (vertical + 1) / 0.9;
    return {
      launchDeg: Math.round(-20 + clamp(t, 0, 1) * 25),
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
  // Map vertical -0.1…0.1 → launch 8°…24°
  const t = (vertical + 0.1) / 0.2;
  return {
    launchDeg: Math.round(8 + clamp(t, 0, 1) * 16),
    band: "line",
  };
}

/** Quality 0–1 → stylized exit velo. Barrels approach ~105+. */
function exitVeloFromQuality(quality: number): number {
  return Math.round(55 + quality * 55);
}

/**
 * Plate-normalized radius of the barrel disc (matches the on-screen
 * sweet-spot marker). Pitch anywhere inside ≈ on the barrel.
 */
export const BARREL_RADIUS = 0.12;

/**
 * Plate-normalized radius of the on-screen pitch ball at the plate.
 * If the click center lands inside this disc, contact is flush / barreled.
 */
export const BALL_RADIUS = 0.065;

/**
 * Click center = barrel sweet spot. The full disc around the click is
 * the barrel — mildly oval by handedness (tip side a bit shorter than
 * handle side) so RHB still whiffs more on up-and-in tip misses.
 */
export function barrelReach(opts: {
  pitchLoc: ZoneCoord;
  aim: ZoneCoord;
  bats: BatterHand;
}): { onBat: boolean; proximity: number; tipSideMiss: boolean } {
  const { pitchLoc, aim, bats } = opts;
  const rhb = bats !== "L";
  const dx = pitchLoc.x - aim.x;
  const dy = pitchLoc.y - aim.y;

  const tipSign = rhb ? 1 : -1;
  const alongTip = dx * tipSign;
  const alongHandle = -alongTip;

  // Full disc ≈ barrel; tip slightly shorter, handle slightly longer
  const rTip = BARREL_RADIUS * 0.92;
  const rHandle = BARREL_RADIUS * 1.18;
  const rPerp = BARREL_RADIUS;
  const rAlong = alongTip > 0 ? rTip : rHandle;
  const nx = (alongTip > 0 ? alongTip : alongHandle) / rAlong;
  const ny = Math.abs(dy) / rPerp;
  const norm = Math.hypot(nx, ny);

  if (norm > 1 + 1e-6) {
    return {
      onBat: false,
      proximity: 0,
      tipSideMiss: alongTip > 0,
    };
  }

  // Soft falloff: edge of the disc still makes contact, center barrels
  const proximity = clamp(1 - Math.pow(norm, 1.35) * 0.72, 0.28, 1);
  return {
    onBat: true,
    proximity,
    tipSideMiss: alongTip > rTip * 0.55,
  };
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
  bats?: BatterHand;
}): ContactEstimate {
  const { pitchLoc, aim, bases, outs } = opts;
  const bats = opts.bats ?? "R";
  const tFactor = timingFactor(opts.timingMs, opts.windowMs);
  const reach = barrelReach({ pitchLoc, aim, bats });
  const euclid = dist(aim, pitchLoc);

  // y grows downward: aim below the ball (higher y) = undercut = fly
  // aim above the ball (lower y) = on the top half = topped / mishit
  const dy = aim.y - pitchLoc.y;
  const vertical = clamp(dy / 0.18, -1, 1);
  const proximity = reach.proximity;
  let quality = clamp(proximity * 0.55 + tFactor * 0.45, 0, 1);
  let { launchDeg, band } = launchFromVertical(vertical);

  // Top half of the ball (bat above center) — never a barrel HR
  const onTopHalf = dy < -0.01;
  // True flush: click in the ball, timed, and at/under the equator
  const flush =
    euclid <= BALL_RADIUS &&
    reach.onBat &&
    tFactor >= 0.4 &&
    !onTopHalf;
  if (flush) {
    quality = Math.max(quality, 0.97);
  }

  let exitVeloMph = exitVeloFromQuality(quality);

  // Off the barrel entirely (e.g. RHB click up-and-left of the pitch) → whiff
  if (!reach.onBat || quality < 0.2 || (euclid > 0.36 && tFactor < 0.4)) {
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

  // Top-of-ball contact → lazy fly out (not a HR, even if "in the disc")
  if (onTopHalf) {
    const popLaunch = Math.max(32, launchDeg < 8 ? 36 : launchDeg);
    return pack(
      "fly_out",
      "line",
      vertical,
      Math.min(quality, 0.72),
      popLaunch,
      exitVeloFromQuality(Math.min(quality, 0.72)),
    );
  }

  // Homers ONLY on true flush (in the ball, at/under center) — not from
  // launch-angle thresholds alone.
  if (flush) {
    const hrLaunch = Math.max(launchDeg, 30);
    exitVeloMph = Math.max(exitVeloMph, exitVeloFromQuality(1));
    return pack("home_run", "crush", vertical, quality, hrLaunch, exitVeloMph);
  }

  // ---- Flies ----
  if (band === "fly") {
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
    if (quality >= 0.9) {
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
  if (quality >= 0.93) {
    return pack("double", "crush", vertical, quality, launchDeg, exitVeloMph);
  }
  if (quality >= 0.86) {
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
  flush_hr:
    "click inside the ball disc, at/under center (not top half), timing ≥ 0.4 → home run (only HR path)",
  top_half: "aim above ball center → fly out (never HR)",
  ground: {
    band: "launch ≤ 5° (bat over the ball / topped)",
    single: "quality ≥ 0.90",
    double_play: "else if runner on 1st and outs < 2",
    ground_out: "else",
  },
  line: {
    band: "launch 8–24°",
    double: "quality ≥ 0.93",
    single: "quality ≥ 0.86",
    line_out: "else",
  },
  fly: {
    band: "launch ≥ 25°",
    home_run: "quality ≥ 0.94 and launch ≥ 28° (or flush rule above)",
    sac_fly: "R3, outs < 2, quality 0.50–0.94",
    double: "quality ≥ 0.92 and launch < 32°",
    fly_out: "else",
  },
  exitVelo: "mph ≈ 55 + quality×55 (flavor only)",
} as const;
