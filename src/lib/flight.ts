import type { ExitKind, PitchType, PlayResult, ZoneCoord } from "@/lib/types";
import {
  pathStyleForPlay,
  type BatterHand,
  type ExitPathStyle,
} from "@/lib/contact";

/**
 * Catcher's-eye release: ball starts small near the heart of the frame
 * (not above the zone) and grows as it comes "through" the plate.
 */
const RELEASE: ZoneCoord = { x: 0.5, y: 0.42 };

/** Pitch families for flight timing (Statcast-style buckets). */
export type PitchFamily = "fastball" | "breaking" | "offspeed";

export function pitchFamily(type: PitchType): PitchFamily {
  switch (type) {
    case "FF":
    case "SI":
    case "CT": // hard / fastball-adjacent
      return "fastball";
    case "CH":
      return "offspeed";
    case "SL":
    case "CU":
    default:
      return "breaking";
  }
}

/** Baseline flight window for breaking stuff — FF faster, CH slower. */
export const FLIGHT_MS_BREAKING = 1020;

/**
 * How long the pitch takes to reach the plate (ms).
 * Fastballs quicker, changeups slower, breaking in between.
 */
export function flightMsForPitch(type: PitchType): number {
  switch (pitchFamily(type)) {
    case "fastball":
      return 850;
    case "offspeed":
      return 1200;
    case "breaking":
    default:
      return FLIGHT_MS_BREAKING;
  }
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Early tunnel bias by pitch type (catcher's view: +x = right / arm side).
 * Break pitches start slightly opposite their finish so the late move
 * reads as a sweep — and the ball ALWAYS ends exactly on `target`.
 */
function startBias(type: PitchType): ZoneCoord {
  switch (type) {
    case "SL":
      // Shows arm-side early, sweeps glove-side into the spot
      return { x: 0.1, y: -0.02 };
    case "CT":
      return { x: 0.05, y: -0.01 };
    case "CU":
      return { x: -0.03, y: -0.08 }; // high early, drops in
    case "CH":
      return { x: -0.02, y: -0.04 };
    case "SI":
      return { x: -0.06, y: -0.02 };
    case "FF":
    default:
      return { x: 0, y: -0.03 };
  }
}

/** Commit curve: break pitches stay ambiguous longer, then snap. */
function commitT(type: PitchType, progress: number): number {
  const p = clamp01(progress);
  const smooth = p * p * (3 - 2 * p);
  switch (type) {
    case "SL":
    case "CT":
      return Math.pow(smooth, 2.2);
    case "CU":
      return Math.pow(smooth, 1.8);
    default:
      return smooth * smooth;
  }
}

/**
 * Path from tunnel release → plate location.
 * Early frames stay near center (with pitch-type bias); late frames commit
 * through the zone to the exact target — catcher's-eye, not top-down.
 */
export function ballPositionAt(
  progress: number,
  target: ZoneCoord,
  pitchType: PitchType,
): ZoneCoord {
  const p = clamp01(progress);
  const t = commitT(pitchType, p);
  const bias = startBias(pitchType);
  const start: ZoneCoord = {
    x: RELEASE.x + bias.x,
    y: RELEASE.y + bias.y,
  };
  return {
    x: lerp(start.x, target.x, t),
    y: lerp(start.y, target.y, t),
  };
}

export function ballScaleAt(progress: number): number {
  const p = clamp01(progress);
  // Starts small in the distance, fills in as it reaches the plate
  return 0.28 + p * p * 0.85;
}

export type ExitVisual = {
  x: number;
  y: number;
  /** Apparent size — shrinks as the ball goes into the field */
  scale: number;
  opacity: number;
  /** Ground-shadow Y (slightly below the ball) for a cheap 3D read */
  shadowY: number;
  shadowScale: number;
  shadowOpacity: number;
};

export type SprayInput = {
  /** Pitch location at the plate (inside/outside) */
  pitch: ZoneCoord;
  bats?: BatterHand;
  /** Barrel sweet-spot aim — open of the ball = inside-out oppo */
  aim?: ZoneCoord;
  timingMs?: number;
  windowMs?: number;
};

/**
 * Catcher's view spray: -1 = left (LF/3B), +1 = right (RF/1B).
 *
 * Barrel vs pitch is the primary spray cue (inside-out / pulled):
 * open of the ball → opposite field for both hands.
 * Timing (early pull / late oppo) and pitch location are secondary.
 */
export function sprayBias(input: SprayInput): number {
  const bats = input.bats ?? "R";
  const pullSign = bats === "L" ? 1 : -1;
  const pitch = input.pitch;

  const insideAmt = pullSign * (pitch.x - 0.5);

  let earlyness = 0;
  if (
    input.windowMs &&
    input.windowMs > 0 &&
    input.timingMs != null &&
    input.timingMs > 0
  ) {
    const ideal = input.windowMs * 0.82;
    earlyness = (ideal - input.timingMs) / (input.windowMs * 0.35);
    earlyness = Math.max(-1.2, Math.min(1.2, earlyness));
  }

  // Primary: where the barrel sits on the ball.
  // RHB aim right of pitch (open) → RF / oppo (+); left of pitch → pull LF (−).
  let barrelOpen = 0;
  if (input.aim) {
    barrelOpen = Math.max(-1, Math.min(1, (input.aim.x - pitch.x) / 0.08));
  }

  const bias =
    barrelOpen * 1.15 + // dominate intentional inside-out / pull
    pullSign * earlyness * 0.45 +
    pullSign * (0.08 + insideAmt * 0.5);

  return Math.max(-1, Math.min(1, bias));
}

/**
 * Batted-ball path into the field (catcher looking out).
 * Progress 0 = contact at the plate; 1 = deep into the play / faded out.
 */
export function exitPositionAt(
  progress: number,
  contact: ZoneCoord,
  play: PlayResult,
  bats: BatterHand = "R",
  sprayOpts?: Omit<SprayInput, "pitch" | "bats">,
  exitKind?: ExitKind,
): ZoneCoord {
  return exitVisualAt(progress, contact, play, bats, sprayOpts, exitKind);
}

/**
 * Perspective flight: carries into the field with pull/oppo spray from
 * location + timing + barrel (inside-out), shrinks with depth, fades out.
 */
export function exitVisualAt(
  progress: number,
  contact: ZoneCoord,
  play: PlayResult,
  bats: BatterHand = "R",
  sprayOpts?: Omit<SprayInput, "pitch" | "bats">,
  exitKind?: ExitKind,
): ExitVisual {
  const p = clamp01(progress);
  const style: ExitPathStyle = pathStyleForPlay(play, exitKind);
  const spray = sprayBias({
    pitch: contact,
    bats,
    aim: sprayOpts?.aim,
    timingMs: sprayOpts?.timingMs,
    windowMs: sprayOpts?.windowMs,
  });

  let lateral = 0; // multiplied by spray
  let away = 0; // negative y = into the field / up the frame
  let height = 0;
  let depth = p;

  switch (style) {
    case "hr":
      lateral = 0.55 * p + 0.25 * p * p;
      away = 0.45 * p + 1.1 * p * p;
      height = 0.55 * Math.sin(p * Math.PI * 0.85);
      depth = p;
      break;
    case "double":
      lateral = 0.7 * p + 0.2 * p * p;
      away = 0.55 * p + 0.35 * p * p;
      height = 0.28 * Math.sin(p * Math.PI * 0.9);
      depth = p;
      break;
    case "liner":
      lateral = 0.5 * p + 0.15 * p * p;
      away = 0.4 * p + 0.1 * p * p;
      height = 0.12 * (1 - p);
      depth = Math.min(1, p * 1.15);
      break;
    case "ground_single":
      lateral = 0.55 * p + 0.12 * p * p;
      away = -0.1 * p; // slight drop toward the dirt
      height = 0.04 * Math.abs(Math.sin(p * Math.PI * 2));
      depth = p * 0.85;
      break;
    case "fly_out":
      lateral = 0.35 * p;
      away = 0.75 * Math.sin(p * Math.PI * 0.92);
      height = 0.45 * Math.sin(p * Math.PI);
      depth = p;
      break;
    case "sac":
      lateral = 0.4 * p;
      away = 0.65 * Math.sin(p * Math.PI * 0.88);
      height = 0.38 * Math.sin(p * Math.PI * 0.9);
      depth = p;
      break;
    case "ground_out":
      lateral = 0.32 * p + 0.08 * p * p;
      away = -0.12 * p; // weak roller dropping toward the dirt
      height = 0.03 * (1 - p);
      depth = p * 0.7;
      break;
    case "whiff":
      lateral = 0.02 * p;
      away = -0.45 * p; // drops past the plate
      height = 0;
      depth = p * 0.4;
      break;
    case "take":
    default:
      lateral = 0;
      away = -0.45 * p;
      height = 0;
      depth = p * 0.3;
      break;
  }

  const x = contact.x + spray * lateral;
  const y = contact.y - away;

  const scale = Math.max(0.18, 1 - depth * 0.78);
  const opacity = Math.max(0, 1 - Math.pow(p, 1.15) * 0.95);
  const shadowY = y + 0.04 + height * 0.55;
  const shadowScale = Math.max(0.2, scale * (0.9 - height * 0.5));
  const shadowOpacity = opacity * (0.22 + (1 - height) * 0.18);

  return {
    x,
    y: y - height * 0.35,
    scale,
    opacity,
    shadowY,
    shadowScale,
    shadowOpacity,
  };
}

/** Sampled track points for drawing the batted-ball path. */
export function exitTrackSamples(
  contact: ZoneCoord,
  play: PlayResult,
  upToProgress: number,
  count = 16,
  bats: BatterHand = "R",
  sprayOpts?: Omit<SprayInput, "pitch" | "bats">,
  exitKind?: ExitKind,
): ExitVisual[] {
  const end = clamp01(upToProgress);
  if (end <= 0.02) return [];
  return Array.from({ length: count }, (_, i) => {
    const t = ((i + 1) / count) * end;
    return exitVisualAt(t, contact, play, bats, sprayOpts, exitKind);
  });
}

export function exitLabel(play: PlayResult): string {
  switch (play) {
    case "home_run":
      return "Gone";
    case "double":
      return "In the gap";
    case "single":
      return "Base hit";
    case "sac_fly":
      return "Sac fly";
    case "fly_out":
      return "Can of corn";
    case "ground_out":
      return "Weak grounder";
    case "double_play":
      return "Turned two";
    case "line_out":
      return "Lined out";
    case "whiff":
      return "Swing and miss";
    case "foul":
      return "Foul";
    case "walk":
      return "Walk";
    case "ball":
      return "Ball";
    case "strike_looking":
      return "Strike looking";
    case "strikeout":
      return "Struck out";
  }
}
