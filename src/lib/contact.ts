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

/** Quality 0–1 → stylized exit velo. Barrels approach ~105+. */
function exitVeloFromQuality(quality: number): number {
  return Math.round(55 + quality * 55);
}

/**
 * Plate-normalized barrel radii — match the on-screen sweet-spot marker
 * (≈14% × 10.5% of the plate). Tip slightly shorter, handle longer.
 */
export const BARREL_RADIUS = 0.07; // half of 14% width
export const BARREL_RADIUS_Y = 0.0525; // half of 10.5% height

/**
 * Plate-normalized radius of the on-screen pitch ball at the plate.
 * If the click center lands inside this disc, contact is flush / barreled.
 */
export const BALL_RADIUS = 0.055;

/**
 * Click center = barrel sweet spot. Contact only when the barrel oval
 * overlaps the ball — if they miss entirely, it's a whiff.
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

  // Expand barrel by ball radius so "onBat" = circles/ovals overlap
  const expand = BALL_RADIUS;
  const rTip = (BARREL_RADIUS + expand) * 0.92;
  const rHandle = (BARREL_RADIUS + expand) * 1.18;
  const rPerp = BARREL_RADIUS_Y + expand;
  const rAlong = alongTip > 0 ? rTip : rHandle;
  const nx = (alongTip > 0 ? alongTip : alongHandle) / rAlong;
  const ny = Math.abs(dy) / rPerp;
  const norm = Math.hypot(nx, ny);

  // No overlap between sweet-spot area and ball → whiff
  if (norm > 1 + 1e-6) {
    return {
      onBat: false,
      proximity: 0,
      tipSideMiss: alongTip > 0,
    };
  }

  // Proximity from how centered the ball is in the unexpanded barrel
  const rTip0 = BARREL_RADIUS * 0.92;
  const rHandle0 = BARREL_RADIUS * 1.18;
  const rAlong0 = alongTip > 0 ? rTip0 : rHandle0;
  const nx0 = (alongTip > 0 ? alongTip : alongHandle) / rAlong0;
  const ny0 = Math.abs(dy) / BARREL_RADIUS_Y;
  const norm0 = Math.hypot(nx0, ny0);
  const proximity =
    norm0 > 1
      ? 0.32 // grazing edge contact
      : clamp(1 - Math.pow(norm0, 1.35) * 0.72, 0.28, 1);

  return {
    onBat: true,
    proximity,
    tipSideMiss: alongTip > rTip0 * 0.55,
  };
}

/**
 * Cut-and-dry vertical contact model (y grows downward):
 * - Above ball midpoint → grounder only (single / GIDP / ground out)
 * - Flush on the midline (click in the ball) → home run
 * - Midline, not flush → line drive (double / single / line out)
 * - Below the ball → fly out (sac fly if R3)
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

  const dy = aim.y - pitchLoc.y;
  const vertical = clamp(dy / 0.18, -1, 1);
  const proximity = reach.proximity;
  let quality = clamp(proximity * 0.55 + tFactor * 0.45, 0, 1);

  // Vertical bands relative to the ball's equator
  const aboveMid = dy < -0.008;
  const belowBall = dy > 0.012;
  const onMidline = !aboveMid && !belowBall;
  const flush =
    onMidline &&
    euclid <= BALL_RADIUS &&
    reach.onBat &&
    tFactor >= 0.35;

  if (flush) quality = Math.max(quality, 0.97);

  // Launch labels match the band (display only — play is band-driven)
  const launchDeg = aboveMid
    ? Math.round(clamp(-12 + quality * 14, -20, 5))
    : belowBall
      ? Math.round(clamp(28 + quality * 12, 28, 45))
      : flush
        ? 32
        : Math.round(clamp(10 + quality * 12, 8, 24));

  let exitVeloMph = exitVeloFromQuality(quality);

  if (!reach.onBat) {
    return {
      vertical,
      quality: 0,
      launchDeg,
      exitVeloMph: exitVeloFromQuality(0),
      play: "whiff",
      exitKind: "whiff",
      endsAb: false,
      event: "strike",
    };
  }

  if (quality < 0.22) {
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

  if (quality < 0.4) {
    return {
      vertical,
      quality,
      launchDeg,
      exitVeloMph,
      play: "foul",
      exitKind: aboveMid ? "ground" : "line",
      endsAb: false,
      event: "foul",
    };
  }

  // ---- Above midpoint → ground ball only ----
  if (aboveMid) {
    // Through the hole on solid contact
    if (quality >= 0.82) {
      return pack("single", "ground", vertical, quality, launchDeg, exitVeloMph);
    }
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

  // ---- Below the ball → fly out ----
  if (belowBall) {
    if (bases.third && outs < 2 && quality >= 0.55) {
      return pack("sac_fly", "line", vertical, quality, launchDeg, exitVeloMph);
    }
    return pack("fly_out", "line", vertical, quality, launchDeg, exitVeloMph);
  }

  // ---- Midline ----
  // Flush in the ball → home run
  if (flush) {
    exitVeloMph = Math.max(exitVeloMph, exitVeloFromQuality(1));
    return pack("home_run", "crush", vertical, quality, launchDeg, exitVeloMph);
  }

  // Otherwise line drive: gapper / single / line out
  if (quality >= 0.88) {
    return pack("double", "crush", vertical, quality, launchDeg, exitVeloMph);
  }
  if (quality >= 0.72) {
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

export function pathStyleForPlay(
  play: PlayResult,
  exitKind?: ExitKind,
): ExitPathStyle {
  switch (play) {
    case "home_run":
      return "hr";
    case "double":
      return "double";
    case "single":
      // Midline singles are liners; above-mid singles stay grounders
      return exitKind === "line" ? "liner" : "ground_single";
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
  whiff: "sweet-spot misses the ball, or quality < 0.22",
  foul: "quality < 0.40",
  above_mid: {
    band: "aim above ball midpoint → grounder only",
    single: "quality ≥ 0.82 (through the hole)",
    double_play: "else if runner on 1st and outs < 2",
    ground_out: "else",
  },
  midline: {
    flush_hr: "click inside the ball disc on the midline → home run",
    double: "else quality ≥ 0.88 → gap double",
    single: "else quality ≥ 0.72 → single",
    line_out: "else",
  },
  below_ball: {
    band: "aim below the ball → fly out",
    sac_fly: "R3, outs < 2, quality ≥ 0.55",
    fly_out: "else",
  },
  exitVelo: "mph ≈ 55 + quality×55 (flavor only)",
} as const;
