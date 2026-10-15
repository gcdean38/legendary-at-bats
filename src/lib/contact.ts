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
  /** Flavor launch angle in degrees (not real physics) */
  launchDeg: number;
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
 * Stylized contact → play result.
 * Hits must be clearly squared up; ordinary solid contact becomes
 * fly outs / ground outs / line outs so failure is common.
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
  // Timing weighs more — late/early barrels become outs more often
  const quality = clamp(proximity * 0.5 + tFactor * 0.5, 0, 1);
  const launchDeg = Math.round(-10 + (vertical + 1) * 26 + (quality - 0.5) * 4);

  if (quality < 0.22 || (distance > 0.34 && tFactor < 0.42)) {
    return {
      vertical,
      quality,
      launchDeg,
      play: "whiff",
      exitKind: "whiff",
      endsAb: false,
      event: "strike",
    };
  }

  // Weak nick → foul
  if (quality < 0.42) {
    return {
      vertical,
      quality,
      launchDeg,
      play: "foul",
      exitKind: "ground",
      endsAb: false,
      event: "foul",
    };
  }

  // Wide fly/ground bands — the “true barrel” line window is tiny
  const fly = vertical > 0.1;
  const ground = vertical < -0.1;
  const line = !fly && !ground;

  // ---- Flies ----
  if (fly) {
    // HR only when truly crushed
    if (quality >= 0.94 && launchDeg >= 26) {
      return pack("home_run", "crush", vertical, quality, launchDeg);
    }
    // Sac fly before plain fly out when R3 and <2 outs
    if (bases.third && outs < 2 && quality >= 0.5 && quality < 0.94) {
      return pack("sac_fly", "line", vertical, quality, launchDeg);
    }
    // Gap double is rare on a fly
    if (quality >= 0.92 && launchDeg < 28) {
      return pack("double", "line", vertical, quality, launchDeg);
    }
    // Default: can of corn / warning-track out
    return pack("fly_out", "line", vertical, quality, launchDeg);
  }

  // ---- Ground balls ----
  if (ground) {
    // Through the infield only when really well struck
    if (quality >= 0.93) {
      return pack("single", "ground", vertical, quality, launchDeg);
    }
    return pack("ground_out", "ground", vertical, quality, launchDeg);
  }

  // ---- Line drives ----
  if (line) {
    if (quality >= 0.95) {
      return pack("double", "crush", vertical, quality, launchDeg);
    }
    if (quality >= 0.9) {
      return pack("single", "line", vertical, quality, launchDeg);
    }
    // Most liners — even pretty good ones — are caught
    return pack("line_out", "line", vertical, quality, launchDeg);
  }

  return pack("ground_out", "ground", vertical, quality, launchDeg);
}

function pack(
  play: PlayResult,
  exitKind: ExitKind,
  vertical: number,
  quality: number,
  launchDeg: number,
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
  return { vertical, quality, launchDeg, play, exitKind, endsAb, event };
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
