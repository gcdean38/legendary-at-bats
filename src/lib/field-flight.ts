import {
  pathStyleForPlay,
  type BatterHand,
  type ExitPathStyle,
} from "@/lib/contact";
import { sprayBias } from "@/lib/flight";
import type { PlayResult, ZoneCoord } from "@/lib/types";

export type FieldSample = {
  /** 0 at home plate → 1 deep into the field */
  dist: number;
  /** Height above turf, 0–1 — driven by launch angle */
  height: number;
  /** -1 pull/LF side … +1 RF side (catcher's left/right) */
  spray: number;
  progress: number;
};

export type FielderId =
  | "P"
  | "C"
  | "1B"
  | "2B"
  | "SS"
  | "3B"
  | "LF"
  | "CF"
  | "RF";

export type FielderSpot = {
  id: FielderId;
  /** Rest position in SVG 0–100 */
  x: number;
  y: number;
  /** How aggressively they chase (OF higher on flies, IF on grounders) */
  react: number;
};

/** Classic diamond rests — home at bottom-center. */
export const FIELDER_RESTS: FielderSpot[] = [
  { id: "C", x: 50, y: 91, react: 0.15 },
  { id: "P", x: 50, y: 69, react: 0.35 },
  { id: "1B", x: 69, y: 71, react: 0.55 },
  { id: "2B", x: 58, y: 56, react: 0.65 },
  { id: "SS", x: 42, y: 56, react: 0.65 },
  { id: "3B", x: 31, y: 71, react: 0.55 },
  { id: "LF", x: 22, y: 26, react: 0.75 },
  { id: "CF", x: 50, y: 16, react: 0.8 },
  { id: "RF", x: 78, y: 26, react: 0.75 },
];

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/** Peak height 0–1 from launch degrees (ground flat → fly high). */
export function heightFromLaunch(launchDeg: number | null | undefined): number {
  if (launchDeg == null || Number.isNaN(launchDeg)) return 0.25;
  // -20°…50° → 0…1
  return clamp01((launchDeg + 5) / 45);
}

/**
 * Distance + height over time. Height envelope follows launch angle so
 * grounders stay low and flies visibly arc.
 */
export function fieldSampleAt(
  progress: number,
  play: PlayResult,
  contact: ZoneCoord = { x: 0.5, y: 0.5 },
  bats: BatterHand = "R",
  launchDeg?: number | null,
): FieldSample {
  const p = clamp01(progress);
  const style: ExitPathStyle = pathStyleForPlay(play);
  const spray = sprayBias(contact, bats);
  const peak = heightFromLaunch(launchDeg);

  // Default arc envelope; style tweaks peak + distance
  const arc = (apex: number, phase = 1) =>
    Math.sin(p * Math.PI * phase) * apex * peak;

  switch (style) {
    case "hr":
      return {
        progress: p,
        dist: p * 0.98,
        height: arc(1.15, 0.92),
        spray,
      };
    case "double":
      return {
        progress: p,
        dist: p * 0.82,
        height: arc(0.85, 0.9),
        spray,
      };
    case "liner":
      return {
        progress: p,
        dist: Math.min(1, p * 1.05) * 0.55,
        // Liners stay flatter even at similar launch
        height: arc(0.45, 0.75) * 0.7,
        spray,
      };
    case "ground_single":
      return {
        progress: p,
        dist: p * 0.48,
        height: Math.abs(Math.sin(p * Math.PI * 3)) * 0.08 * Math.max(0.15, peak),
        spray,
      };
    case "fly_out":
      return {
        progress: p,
        dist: p * 0.62,
        height: arc(1.05, 1),
        spray,
      };
    case "sac":
      return {
        progress: p,
        dist: p * 0.7,
        height: arc(0.95, 0.95),
        spray,
      };
    case "ground_out":
      return {
        progress: p,
        dist: p * 0.28,
        height: Math.abs(Math.sin(p * Math.PI * 2)) * 0.05 * Math.max(0.1, peak),
        spray,
      };
    case "whiff":
      return { progress: p, dist: 0.02 * p, height: 0, spray: 0 };
    case "take":
    default:
      return { progress: p, dist: 0, height: 0, spray: 0 };
  }
}

export function fieldTrackSamples(
  play: PlayResult,
  upToProgress: number,
  contact: ZoneCoord = { x: 0.5, y: 0.5 },
  bats: BatterHand = "R",
  launchDeg?: number | null,
  count = 28,
): FieldSample[] {
  const end = clamp01(upToProgress);
  if (end <= 0.01) return [];
  return Array.from({ length: count }, (_, i) =>
    fieldSampleAt(((i + 1) / count) * end, play, contact, bats, launchDeg),
  );
}

/**
 * Overhead / catcher-pullback camera:
 * home plate at bottom-center, outfield toward the top, spray = LF/RF.
 * Height lifts the drawn ball toward the top of the frame (reads as arc).
 */
export function fieldToSvg(sample: FieldSample): {
  x: number;
  y: number;
  shadowY: number;
} {
  const spread = 40 * sample.dist;
  const x = 50 + sample.spray * spread;
  const groundY = 88 - sample.dist * 74;
  // Stronger lift so launch angle is readable on an overhead view
  const y = groundY - sample.height * 22;
  return { x, y, shadowY: groundY };
}

/** Soft chase: fielders ease toward the ball; OF react more on flies. */
export function fielderPositions(
  ball: { x: number; y: number },
  progress: number,
  launchDeg?: number | null,
): { id: FielderId; x: number; y: number }[] {
  const p = clamp01(progress);
  const flyBias = heightFromLaunch(launchDeg); // 0 ground … 1 fly
  return FIELDER_RESTS.map((f) => {
    const isOf = f.id === "LF" || f.id === "CF" || f.id === "RF";
    const isIf = !isOf && f.id !== "C" && f.id !== "P";
    const role =
      (isOf ? 0.45 + flyBias * 0.7 : 0) +
      (isIf ? 0.55 + (1 - flyBias) * 0.55 : 0) +
      (f.id === "P" ? 0.3 : 0);
    const chase = f.react * role * Math.pow(p, 0.85) * 0.42;
    const dx = ball.x - f.x;
    const dy = ball.y - f.y;
    return {
      id: f.id,
      x: f.x + dx * chase,
      y: f.y + dy * chase,
    };
  });
}

export function sprayLabel(
  contact: ZoneCoord,
  bats: BatterHand,
): string {
  const s = sprayBias(contact, bats);
  const pullSign = bats === "L" ? 1 : -1;
  const pullAmt = s * pullSign;
  if (pullAmt > 0.35) return bats === "L" ? "Pull (RF)" : "Pull (LF)";
  if (pullAmt < -0.35) return bats === "L" ? "Oppo (LF)" : "Oppo (RF)";
  if (Math.abs(s) < 0.15) return "Up the middle";
  return pullAmt > 0
    ? bats === "L"
      ? "Slight pull (RF)"
      : "Slight pull (LF)"
    : bats === "L"
      ? "Slight oppo (LF)"
      : "Slight oppo (RF)";
}
