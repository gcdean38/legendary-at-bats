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
  /** Height above turf, 0–1 */
  height: number;
  /** -1 pull/LF side … +1 RF side (catcher's left/right) */
  spray: number;
  progress: number;
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/**
 * Side-view / outfield camera: distance + height over time.
 * Spray comes from contact location + handedness (RHB inside → pull/LF).
 */
export function fieldSampleAt(
  progress: number,
  play: PlayResult,
  contact: ZoneCoord = { x: 0.5, y: 0.5 },
  bats: BatterHand = "R",
): FieldSample {
  const p = clamp01(progress);
  const style: ExitPathStyle = pathStyleForPlay(play);
  const spray = sprayBias(contact, bats);

  switch (style) {
    case "hr":
      return {
        progress: p,
        dist: p * 0.98,
        height: Math.sin(p * Math.PI * 0.92) * 0.92,
        spray,
      };
    case "double":
      return {
        progress: p,
        dist: p * 0.82,
        height: Math.sin(p * Math.PI * 0.88) * 0.48,
        spray,
      };
    case "liner":
      return {
        progress: p,
        dist: Math.min(1, p * 1.05) * 0.55,
        height: Math.sin(p * Math.PI * 0.7) * 0.18,
        spray,
      };
    case "ground_single":
      return {
        progress: p,
        dist: p * 0.48,
        height: Math.abs(Math.sin(p * Math.PI * 3)) * 0.06 * (1 - p * 0.5),
        spray,
      };
    case "fly_out":
      return {
        progress: p,
        dist: p * 0.62,
        height: Math.sin(p * Math.PI) * 0.7,
        spray,
      };
    case "sac":
      return {
        progress: p,
        dist: p * 0.7,
        height: Math.sin(p * Math.PI * 0.95) * 0.58,
        spray,
      };
    case "ground_out":
      return {
        progress: p,
        dist: p * 0.28,
        height: Math.abs(Math.sin(p * Math.PI * 2)) * 0.04 * (1 - p),
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
  count = 24,
): FieldSample[] {
  const end = clamp01(upToProgress);
  if (end <= 0.01) return [];
  return Array.from({ length: count }, (_, i) =>
    fieldSampleAt(((i + 1) / count) * end, play, contact, bats),
  );
}

/**
 * Overhead / catcher-pullback camera (same frame as the strike zone):
 * home plate at bottom-center, outfield toward the top, spray = LF/RF.
 */
export function fieldToSvg(sample: FieldSample): { x: number; y: number } {
  const spread = 38 * sample.dist; // how far left/right at this depth
  const x = 50 + sample.spray * spread;
  // Carry toward the outfield (up the frame); height lifts the ball slightly
  const y = 88 - sample.dist * 74 - sample.height * 10;
  return { x, y };
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
