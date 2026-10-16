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
  /** Fill a parent frame (used inside PitchCanvas morph) */
  fill?: boolean;
  className?: string;
};

/**
 * Overhead diamond — home at bottom, OF at top — sized to share the
 * same phone frame as the strike zone.
 */
export function BattedBallField({
  play,
  progress,
  contact,
  bats,
  fill = false,
  className,
}: Props) {
  const track = fieldTrackSamples(play, progress, contact, bats, 28);
  const ball = fieldSampleAt(progress, play, contact, bats);
  const ballSvg = fieldToSvg(ball);
  const pathD =
    track.length > 1
      ? track
          .map((s, i) => {
            const { x, y } = fieldToSvg(s);
            return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
          })
          .join(" ")
      : "";

  const ballR = Math.max(1.1, 3.6 - ball.dist * 2.4 + ball.height * 0.8);
  const isHit =
    play === "home_run" || play === "double" || play === "single";

  return (
    <div
      className={cn(
        fill
          ? "absolute inset-0 overflow-hidden"
          : "relative mx-auto aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-sm border border-chalk/20",
        className,
      )}
      style={{
        background:
          "linear-gradient(180deg, oklch(0.26 0.035 250 / 0.95) 0%, oklch(0.34 0.06 145 / 0.75) 38%, oklch(0.4 0.09 145 / 0.92) 100%)",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {/* Outfield grass */}
        <defs>
          <radialGradient id="infieldDirt" cx="50%" cy="78%" r="42%">
            <stop offset="0%" stopColor="oklch(0.62 0.08 75 / 0.55)" />
            <stop offset="55%" stopColor="oklch(0.48 0.07 75 / 0.35)" />
            <stop offset="100%" stopColor="oklch(0.4 0.09 145 / 0)" />
          </radialGradient>
        </defs>

        {/* Foul lines from home */}
        <line
          x1="50"
          y1="90"
          x2="8"
          y2="12"
          stroke="oklch(0.93 0.02 95 / 0.35)"
          strokeWidth="0.45"
        />
        <line
          x1="50"
          y1="90"
          x2="92"
          y2="12"
          stroke="oklch(0.93 0.02 95 / 0.35)"
          strokeWidth="0.45"
        />

        {/* Outfield wall arc */}
        <path
          d="M 6 18 Q 50 2 94 18"
          fill="none"
          stroke="oklch(0.75 0.04 95 / 0.28)"
          strokeWidth="0.6"
        />

        {/* Infield dirt */}
        <ellipse cx="50" cy="72" rx="28" ry="22" fill="url(#infieldDirt)" />

        {/* Bases */}
        <rect
          x="48.2"
          y="54"
          width="3.6"
          height="3.6"
          transform="rotate(45 50 55.8)"
          fill="oklch(0.93 0.02 95 / 0.7)"
        />
        <rect
          x="32"
          y="66"
          width="3.2"
          height="3.2"
          transform="rotate(45 33.6 67.6)"
          fill="oklch(0.93 0.02 95 / 0.55)"
        />
        <rect
          x="64.8"
          y="66"
          width="3.2"
          height="3.2"
          transform="rotate(45 66.4 67.6)"
          fill="oklch(0.93 0.02 95 / 0.55)"
        />

        {/* Home plate */}
        <polygon
          points="50,92 46.5,88.5 46.5,86 53.5,86 53.5,88.5"
          fill="oklch(0.94 0.02 95 / 0.9)"
        />

        {/* Pitcher's mound */}
        <ellipse
          cx="50"
          cy="68"
          rx="3.2"
          ry="2.2"
          fill="oklch(0.55 0.07 75 / 0.45)"
        />

        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="oklch(0.9 0.04 95 / 0.55)"
            strokeWidth="0.65"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Ground shadow */}
        <ellipse
          cx={ballSvg.x}
          cy={Math.min(92, ballSvg.y + 2 + ball.height * 6)}
          rx={Math.max(1.1, ballR * 1.15)}
          ry={0.65}
          fill="oklch(0.12 0.02 145 / 0.4)"
          opacity={Math.max(0.12, 0.5 - ball.height * 0.4)}
        />

        <circle
          cx={ballSvg.x}
          cy={ballSvg.y}
          r={ballR}
          fill={isHit ? "oklch(0.82 0.14 75)" : "oklch(0.92 0.02 95)"}
          opacity={Math.max(0.2, 1 - progress * 0.12)}
          style={{
            filter: isHit
              ? "drop-shadow(0 0 4px oklch(0.82 0.14 75 / 0.7))"
              : "drop-shadow(0 0 3px oklch(0.9 0.05 95 / 0.45))",
          }}
        />
      </svg>

      <p className="pointer-events-none absolute left-2 top-2 text-[10px] uppercase tracking-[0.16em] text-chalk/55">
        LF
      </p>
      <p className="pointer-events-none absolute right-2 top-2 text-[10px] uppercase tracking-[0.16em] text-chalk/55">
        RF
      </p>
      <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10px] uppercase tracking-[0.16em] text-chalk/70">
        {playResultLabel(play)} · {exitLabel(play)} · {sprayLabel(contact, bats)}
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
