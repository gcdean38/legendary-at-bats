import {
  pathStyleForPlay,
  type BatterHand,
  type ExitPathStyle,
} from "@/lib/contact";
import { sprayBias, type SprayInput } from "@/lib/flight";
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

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/** Peak height 0–1 from launch degrees (ground flat → fly high). */
export function heightFromLaunch(launchDeg: number | null | undefined): number {
  if (launchDeg == null || Number.isNaN(launchDeg)) return 0.25;
  return clamp01((launchDeg + 5) / 45);
}

export type FieldSprayOpts = {
  bats?: BatterHand;
  aim?: ZoneCoord;
  timingMs?: number;
  windowMs?: number;
};

function sprayFor(
  pitch: ZoneCoord,
  bats: BatterHand,
  opts?: FieldSprayOpts,
): number {
  const input: SprayInput = {
    pitch,
    bats: opts?.bats ?? bats,
    aim: opts?.aim,
    timingMs: opts?.timingMs,
    windowMs: opts?.windowMs,
  };
  return sprayBias(input);
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
  sprayOpts?: FieldSprayOpts,
): FieldSample {
  const p = clamp01(progress);
  const style: ExitPathStyle = pathStyleForPlay(play);
  const spray = sprayFor(contact, bats, sprayOpts);
  const peak = heightFromLaunch(launchDeg);

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
        height: arc(0.45, 0.75) * 0.7,
        spray,
      };
    case "ground_single":
      return {
        progress: p,
        dist: p * 0.48,
        height:
          Math.abs(Math.sin(p * Math.PI * 3)) *
          0.08 *
          Math.max(0.15, peak),
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
        height:
          Math.abs(Math.sin(p * Math.PI * 2)) *
          0.05 *
          Math.max(0.1, peak),
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
  sprayOpts?: FieldSprayOpts,
  count = 28,
): FieldSample[] {
  const end = clamp01(upToProgress);
  if (end <= 0.01) return [];
  return Array.from({ length: count }, (_, i) =>
    fieldSampleAt(
      ((i + 1) / count) * end,
      play,
      contact,
      bats,
      launchDeg,
      sprayOpts,
    ),
  );
}

/**
 * Overhead camera: home bottom-center, OF top, spray = LF/RF.
 */
export function fieldToSvg(sample: FieldSample): {
  x: number;
  y: number;
  shadowY: number;
} {
  const spread = 40 * sample.dist;
  const x = 50 + sample.spray * spread;
  const groundY = 88 - sample.dist * 74;
  const y = groundY - sample.height * 22;
  return { x, y, shadowY: groundY };
}

export function sprayLabel(
  contact: ZoneCoord,
  bats: BatterHand,
  sprayOpts?: FieldSprayOpts,
): string {
  const s = sprayFor(contact, bats, sprayOpts);
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
