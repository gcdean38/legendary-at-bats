"use client";

import type { PlayResult, ZoneCoord } from "@/lib/types";
import type { BatterHand } from "@/lib/contact";
import { exitLabel } from "@/lib/flight";
import {
  fieldSampleAt,
  fieldToSvg,
  fieldTrackSamples,
  sprayLabel,
} from "@/lib/field-flight";
import { playResultLabel } from "@/lib/contact";
import { cn } from "@/lib/utils";

type Props = {
  play: PlayResult;
  progress: number;
  contact: ZoneCoord;
  bats: BatterHand;
  launchDeg?: number | null;
  /** Fill a parent frame (used inside PitchCanvas morph) */
  fill?: boolean;
  className?: string;
};

/**
 * Overhead diamond — home at bottom, OF at top — same frame as the zone.
 * Launch angle drives arc height. No fielder clutter — ball + path only.
 */
export function BattedBallField({
  play,
  progress,
  contact,
  bats,
  launchDeg = null,
  fill = false,
  className,
}: Props) {
  const track = fieldTrackSamples(
    play,
    progress,
    contact,
    bats,
    launchDeg,
    32,
  );
  const ball = fieldSampleAt(progress, play, contact, bats, launchDeg);
  const ballSvg = fieldToSvg(ball);

  const airPath =
    track.length > 1
      ? track
          .map((s, i) => {
            const { x, y } = fieldToSvg(s);
            return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
          })
          .join(" ")
      : "";

  const groundPath =
    track.length > 1
      ? track
          .map((s, i) => {
            const { x, shadowY } = fieldToSvg(s);
            return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${shadowY.toFixed(2)}`;
          })
          .join(" ")
      : "";

  const ballR = Math.max(
    1.2,
    3.2 - ball.dist * 2.0 + ball.height * 1.6,
  );
  const isHit =
    play === "home_run" || play === "double" || play === "single";

  return (
    <div
      className={cn(
        fill
          ? "absolute inset-0 overflow-hidden"
          : "relative mx-auto aspect-[4/5] w-full overflow-hidden rounded-sm border border-chalk/20",
        className,
      )}
      style={{
        background:
          "linear-gradient(180deg, oklch(0.24 0.03 250 / 0.92) 0%, oklch(0.36 0.07 145 / 0.8) 32%, oklch(0.4 0.09 145 / 0.95) 100%)",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <radialGradient id="infieldDirt" cx="50%" cy="78%" r="48%">
            <stop offset="0%" stopColor="oklch(0.58 0.09 72 / 0.7)" />
            <stop offset="50%" stopColor="oklch(0.5 0.08 72 / 0.45)" />
            <stop offset="100%" stopColor="oklch(0.4 0.09 145 / 0)" />
          </radialGradient>
          <linearGradient id="warningTrack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.52 0.08 70 / 0.55)" />
            <stop offset="100%" stopColor="oklch(0.45 0.07 70 / 0.15)" />
          </linearGradient>
        </defs>

        {/* Warning track band under the wall */}
        <path
          d="M 4 22 Q 50 4 96 22 L 94 16 Q 50 0 6 16 Z"
          fill="url(#warningTrack)"
          opacity="0.85"
        />

        {/* Outfield wall */}
        <path
          d="M 5 18 Q 50 1 95 18"
          fill="none"
          stroke="oklch(0.78 0.04 95 / 0.4)"
          strokeWidth="0.7"
        />

        {/* Foul lines */}
        <line
          x1="50"
          y1="90"
          x2="6"
          y2="14"
          stroke="oklch(0.93 0.02 95 / 0.4)"
          strokeWidth="0.4"
        />
        <line
          x1="50"
          y1="90"
          x2="94"
          y2="14"
          stroke="oklch(0.93 0.02 95 / 0.4)"
          strokeWidth="0.4"
        />

        {/* Infield dirt diamond + mound cutout */}
        <polygon
          points="50,90 72,68 50,48 28,68"
          fill="url(#infieldDirt)"
          opacity="0.95"
        />
        {/* Baseline / cutout chalk */}
        <polygon
          points="50,88 70,68 50,50 30,68"
          fill="none"
          stroke="oklch(0.9 0.03 95 / 0.2)"
          strokeWidth="0.35"
        />
        {/* Keyhole / batter's box dirt */}
        <ellipse
          cx="50"
          cy="86"
          rx="7"
          ry="5"
          fill="oklch(0.55 0.08 72 / 0.55)"
        />

        {/* Pitcher's mound */}
        <ellipse
          cx="50"
          cy="68"
          rx="4"
          ry="2.8"
          fill="oklch(0.52 0.08 70 / 0.65)"
        />
        <ellipse
          cx="50"
          cy="67.4"
          rx="1.4"
          ry="0.7"
          fill="oklch(0.4 0.05 70 / 0.5)"
        />

        {/* Bases — smaller so dirt reads */}
        <rect
          x="48.6"
          y="51.2"
          width="2.8"
          height="2.8"
          transform="rotate(45 50 52.6)"
          fill="oklch(0.94 0.02 95 / 0.85)"
        />
        <rect
          x="33.2"
          y="66.2"
          width="2.4"
          height="2.4"
          transform="rotate(45 34.4 67.4)"
          fill="oklch(0.94 0.02 95 / 0.7)"
        />
        <rect
          x="64.4"
          y="66.2"
          width="2.4"
          height="2.4"
          transform="rotate(45 65.6 67.4)"
          fill="oklch(0.94 0.02 95 / 0.7)"
        />

        {/* Home plate */}
        <polygon
          points="50,92.5 46.2,88.8 46.2,86.2 53.8,86.2 53.8,88.8"
          fill="oklch(0.95 0.02 95 / 0.95)"
        />

        {/* Ground track (turf shadow of the flight) */}
        {groundPath && (
          <path
            d={groundPath}
            fill="none"
            stroke="oklch(0.15 0.02 145 / 0.35)"
            strokeWidth="0.55"
            strokeLinecap="round"
            strokeDasharray="1.2 1.1"
          />
        )}

        {/* Air arc — lifts with launch angle */}
        {airPath && (
          <path
            d={airPath}
            fill="none"
            stroke="oklch(0.92 0.04 95 / 0.65)"
            strokeWidth="0.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Ball shadow on turf */}
        <ellipse
          cx={ballSvg.x}
          cy={ballSvg.shadowY}
          rx={Math.max(1.1, ballR * 1.05)}
          ry={0.7}
          fill="oklch(0.1 0.02 145 / 0.45)"
          opacity={Math.max(0.15, 0.55 - ball.height * 0.4)}
        />

        {/* Ball */}
        <circle
          cx={ballSvg.x}
          cy={ballSvg.y}
          r={ballR}
          fill={isHit ? "oklch(0.82 0.14 75)" : "oklch(0.94 0.02 95)"}
          opacity={Math.max(0.25, 1 - progress * 0.1)}
          style={{
            filter: isHit
              ? "drop-shadow(0 0 4px oklch(0.82 0.14 75 / 0.7))"
              : "drop-shadow(0 0 3px oklch(0.9 0.05 95 / 0.45))",
          }}
        />
      </svg>

      <p className="pointer-events-none absolute left-2.5 top-2 text-[10px] uppercase tracking-[0.16em] text-chalk/55">
        LF
      </p>
      <p className="pointer-events-none absolute right-2.5 top-2 text-[10px] uppercase tracking-[0.16em] text-chalk/55">
        RF
      </p>
      <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10px] uppercase tracking-[0.16em] text-chalk/70">
        {playResultLabel(play)} · {exitLabel(play)} · {sprayLabel(contact, bats)}
        {launchDeg != null ? ` · ~${Math.round(launchDeg)}°` : ""}
      </p>
    </div>
  );
}

export function shouldShowFieldFlight(
  play: PlayResult | null | undefined,
): boolean {
  if (!play) return false;
  return (
    play === "home_run" ||
    play === "double" ||
    play === "single" ||
    play === "sac_fly" ||
    play === "fly_out" ||
    play === "ground_out" ||
    play === "double_play" ||
    play === "line_out"
  );
}
