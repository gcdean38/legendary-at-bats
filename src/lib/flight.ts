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

/**
 * Distinct exit arcs by play result so a HR, grounder, and can-of-corn
 * don't look the same. Coords are full-plate; can leave the frame.
 */
export function exitPositionAt(
  progress: number,
  contact: ZoneCoord,
  play: PlayResult,
): ZoneCoord {
  const p = clamp01(progress);
  const style: ExitPathStyle = pathStyleForPlay(play);

  switch (style) {
    case "hr":
      return {
        x: contact.x + 0.2 * p + 0.15 * p * p,
        y: contact.y - 0.55 * p - 1.1 * p * p,
      };
    case "double":
      return {
        x: contact.x + 0.7 * p,
        y: contact.y - 0.45 * p - 0.15 * p * p,
      };
    case "liner":
      return {
        x: contact.x + 0.55 * p,
        y: contact.y - 0.2 * p + 0.25 * p * p,
      };
    case "ground_single":
      return {
        x: contact.x + 0.55 * p,
        y: contact.y + 0.08 * Math.sin(p * Math.PI * 2) + 0.12 * p,
      };
    case "fly_out":
      return {
        x: contact.x + 0.25 * p,
        y: contact.y - 0.85 * Math.sin(p * Math.PI) + 0.15 * p,
      };
    case "sac":
      return {
        x: contact.x + 0.35 * p,
        y: contact.y - 0.7 * Math.sin(p * Math.PI * 0.85) + 0.05 * p,
      };
    case "ground_out":
      return {
        x: contact.x + 0.28 * p,
        y: contact.y + 0.2 * p + 0.25 * p * p,
      };
    case "whiff":
      return {
        x: contact.x + 0.04 * p,
        y: contact.y + 0.5 * p,
      };
    case "take":
    default:
      return {
        x: contact.x,
        y: contact.y + 0.45 * p,
      };
  }
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
