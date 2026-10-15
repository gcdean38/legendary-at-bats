import type { PitchType, PlayResult, ZoneCoord } from "@/lib/types";
import { pathStyleForPlay, type ExitPathStyle } from "@/lib/contact";

/** Release point above the plate (full-plate coords; y can be < 0). */
const RELEASE: ZoneCoord = { x: 0.5, y: -0.2 };

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function breakBias(type: PitchType): number {
  switch (type) {
    case "SL":
      return 0.18;
    case "CT":
      return 0.1;
    case "CU":
      return -0.06;
    case "CH":
      return 0.04;
    case "SI":
      return -0.08;
    case "FF":
    default:
      return 0.02;
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Quadratic path from release → plate.
 * Early progress stays ambiguous; late frames lock onto location.
 */
export function ballPositionAt(
  progress: number,
  target: ZoneCoord,
  pitchType: PitchType,
): ZoneCoord {
  const p = clamp01(progress);
  const t = p * p * (3 - 2 * p);
  const bias = breakBias(pitchType);
  const ctrl: ZoneCoord = {
    x: lerp(RELEASE.x, target.x, 0.45) + bias * Math.sin(Math.PI * t),
    y: lerp(RELEASE.y, target.y, 0.35),
  };
  const x =
    (1 - t) * (1 - t) * RELEASE.x + 2 * (1 - t) * t * ctrl.x + t * t * target.x;
  const y =
    (1 - t) * (1 - t) * RELEASE.y + 2 * (1 - t) * t * ctrl.y + t * t * target.y;
  return { x, y };
}

export function ballScaleAt(progress: number): number {
  const p = clamp01(progress);
  return 0.35 + p * 0.7;
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
      // High majestic arc, climbs out of frame
      return {
        x: contact.x + 0.2 * p + 0.15 * p * p,
        y: contact.y - 0.55 * p - 1.1 * p * p,
      };
    case "double":
      // Gap shot — lower line that carries to the gap
      return {
        x: contact.x + 0.7 * p,
        y: contact.y - 0.45 * p - 0.15 * p * p,
      };
    case "liner":
      // Hard line — flat and fast, then caught (short fade)
      return {
        x: contact.x + 0.55 * p,
        y: contact.y - 0.2 * p + 0.25 * p * p,
      };
    case "ground_single":
      // Chopper through the infield — stays low with a hop
      return {
        x: contact.x + 0.55 * p,
        y: contact.y + 0.08 * Math.sin(p * Math.PI * 2) + 0.12 * p,
      };
    case "fly_out":
      // Can of corn — goes up, then comes down in view
      return {
        x: contact.x + 0.25 * p,
        y: contact.y - 0.85 * Math.sin(p * Math.PI) + 0.15 * p,
      };
    case "sac":
      // Medium fly to outfield — enough for a tag
      return {
        x: contact.x + 0.35 * p,
        y: contact.y - 0.7 * Math.sin(p * Math.PI * 0.85) + 0.05 * p,
      };
    case "ground_out":
      // Weak roller — dies quickly
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
