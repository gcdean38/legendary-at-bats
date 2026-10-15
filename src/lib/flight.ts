import type { PitchType, PlayResult, ZoneCoord } from "@/lib/types";
import { pathStyleForPlay, type ExitPathStyle } from "@/lib/contact";

/**
 * Catcher's-eye release: ball starts small near the heart of the frame
 * (not above the zone) and grows as it comes "through" the plate.
 */
const RELEASE: ZoneCoord = { x: 0.5, y: 0.42 };

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

/**
 * Batted-ball path into the field (catcher looking out).
 * Progress 0 = contact at the plate; 1 = deep into the play / faded out.
 */
export function exitPositionAt(
  progress: number,
  contact: ZoneCoord,
  play: PlayResult,
): ZoneCoord {
  return exitVisualAt(progress, contact, play);
}

/**
 * Perspective flight: ball climbs/carries into the field, shrinks with
 * depth, and fades — with a soft ground shadow for a 3D-ish track feel.
 */
export function exitVisualAt(
  progress: number,
  contact: ZoneCoord,
  play: PlayResult,
): ExitVisual {
  const p = clamp01(progress);
  const style: ExitPathStyle = pathStyleForPlay(play);

  let x = contact.x;
  let y = contact.y;
  let height = 0; // lift above "turf" for shadow separation
  let depth = p; // how far into the field (drives shrink)

  switch (style) {
    case "hr":
      x = contact.x + 0.12 * p + 0.35 * p * p;
      y = contact.y - 0.35 * p - 1.35 * p * p;
      height = 0.55 * Math.sin(p * Math.PI * 0.85);
      depth = p;
      break;
    case "double":
      x = contact.x + 0.55 * p + 0.35 * p * p;
      y = contact.y - 0.55 * p - 0.35 * p * p;
      height = 0.28 * Math.sin(p * Math.PI * 0.9);
      depth = p;
      break;
    case "liner":
      x = contact.x + 0.45 * p + 0.25 * p * p;
      y = contact.y - 0.35 * p + 0.15 * p * p;
      height = 0.12 * (1 - p);
      depth = Math.min(1, p * 1.15);
      break;
    case "ground_single":
      x = contact.x + 0.5 * p + 0.2 * p * p;
      y = contact.y + 0.06 * Math.sin(p * Math.PI * 2) + 0.08 * p;
      height = 0.04 * Math.abs(Math.sin(p * Math.PI * 2));
      depth = p * 0.85;
      break;
    case "fly_out":
      x = contact.x + 0.18 * p + 0.12 * p * p;
      y = contact.y - 0.95 * Math.sin(p * Math.PI * 0.92) + 0.2 * p;
      height = 0.45 * Math.sin(p * Math.PI);
      depth = p;
      break;
    case "sac":
      x = contact.x + 0.28 * p + 0.15 * p * p;
      y = contact.y - 0.8 * Math.sin(p * Math.PI * 0.88) + 0.12 * p;
      height = 0.38 * Math.sin(p * Math.PI * 0.9);
      depth = p;
      break;
    case "ground_out":
      x = contact.x + 0.22 * p + 0.12 * p * p;
      y = contact.y + 0.15 * p + 0.2 * p * p;
      height = 0.03 * (1 - p);
      depth = p * 0.7;
      break;
    case "whiff":
      x = contact.x + 0.03 * p;
      y = contact.y + 0.55 * p;
      height = 0;
      depth = p * 0.4;
      break;
    case "take":
    default:
      x = contact.x;
      y = contact.y + 0.5 * p;
      height = 0;
      depth = p * 0.3;
      break;
  }

  // Shrink into the field + fade as it carries
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
): ExitVisual[] {
  const end = clamp01(upToProgress);
  if (end <= 0.02) return [];
  return Array.from({ length: count }, (_, i) => {
    const t = ((i + 1) / count) * end;
    return exitVisualAt(t, contact, play);
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
