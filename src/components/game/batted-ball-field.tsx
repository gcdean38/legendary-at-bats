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
  className?: string;
};

/**
 * Faux-3D side/outfield camera for the batted ball.
 * Spray (pull vs oppo) comes from contact + handedness.
 */
export function BattedBallField({
  play,
  progress,
  contact,
  bats,
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

  const ballR = Math.max(1.2, 3.4 - ball.dist * 2.2);
  const isHit =
    play === "home_run" || play === "double" || play === "single";

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[300px] overflow-hidden rounded-md border border-chalk/20",
        className,
      )}
    >
      <div
        className="relative aspect-[5/3] w-full"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.28 0.04 250 / 0.9) 0%, oklch(0.35 0.06 145 / 0.55) 42%, oklch(0.42 0.09 145 / 0.85) 100%)",
          perspective: "520px",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-[-10%] bottom-[-8%] h-[58%] origin-bottom rounded-[100%]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 20%, oklch(0.55 0.12 145 / 0.55), oklch(0.32 0.07 145 / 0.9))",
            transform: "rotateX(58deg)",
            borderTop: "1px solid oklch(0.75 0.04 95 / 0.25)",
          }}
        />

        <div className="pointer-events-none absolute inset-x-[8%] top-[18%] h-[10%] rounded-sm bg-chalk/10" />

        <p className="absolute left-2 top-2 text-[10px] uppercase tracking-[0.16em] text-chalk/60">
          LF
        </p>
        <p className="absolute right-2 top-2 text-[10px] uppercase tracking-[0.16em] text-chalk/60">
          RF
        </p>

        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <polygon
            points="6,82 10,78 14,82 10,86"
            fill="oklch(0.92 0.02 95 / 0.85)"
          />
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="oklch(0.9 0.04 95 / 0.55)"
              strokeWidth="0.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          <ellipse
            cx={ballSvg.x}
            cy={82}
            rx={Math.max(1.2, ballR * 1.1)}
            ry={0.7}
            fill="oklch(0.15 0.02 145 / 0.35)"
            opacity={Math.max(0.1, 0.45 - ball.height * 0.35)}
          />
          <circle
            cx={ballSvg.x}
            cy={ballSvg.y}
            r={ballR}
            fill={isHit ? "oklch(0.82 0.14 75)" : "oklch(0.92 0.02 95)"}
            opacity={Math.max(0.15, 1 - progress * 0.15)}
            style={{
              filter: isHit
                ? "drop-shadow(0 0 4px oklch(0.82 0.14 75 / 0.7))"
                : "drop-shadow(0 0 3px oklch(0.9 0.05 95 / 0.45))",
            }}
          />
        </svg>

        <p className="absolute bottom-2 left-0 right-0 text-center text-[10px] uppercase tracking-[0.18em] text-chalk/70">
          {playResultLabel(play)} · {exitLabel(play)} · {sprayLabel(contact, bats)}
        </p>
      </div>
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
