"use client";

import type { PlayResult, ZoneCoord } from "@/lib/types";
import type { BatterHand } from "@/lib/contact";
import { exitLabel } from "@/lib/flight";
import {
  fieldSampleAt,
  fieldToSvg,
  fieldTrackSamples,
  sprayLabel,
  type FieldSprayOpts,
} from "@/lib/field-flight";
import { playResultLabel } from "@/lib/contact";
import { cn } from "@/lib/utils";

/** Discrete stadium palette — no fades */
const GRASS = "oklch(0.4 0.1 145)";
const DIRT = "oklch(0.58 0.09 68)";
const WARNING = "oklch(0.38 0.1 25)"; // burgundy
const CHALK = "oklch(0.94 0.02 95)";
const WALL = "oklch(0.72 0.03 95)";

/**
 * Diamond geometry — 1B/3B sit ON the foul lines.
 * HOME → foul corners define rays; bases are fixed distances along those rays.
 */
const HOME = { x: 50, y: 91 };
const LF_WALL = { x: 8, y: 14 };
const RF_WALL = { x: 92, y: 14 };

function along(
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
) {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

const FIRST = along(HOME, RF_WALL, 0.3);
const THIRD = along(HOME, LF_WALL, 0.3);
// Second = home + (1B−home) + (3B−home) for a square diamond in this projection
const SECOND = {
  x: HOME.x + (FIRST.x - HOME.x) + (THIRD.x - HOME.x),
  y: HOME.y + (FIRST.y - HOME.y) + (THIRD.y - HOME.y),
};

/** Dirt cutout extends beyond all four bases */
const DIRT_HOME = along(HOME, { x: 50, y: 100 }, 0.55);
const DIRT_1B = along(HOME, RF_WALL, 0.42);
const DIRT_2B = {
  x: SECOND.x,
  y: SECOND.y - 6,
};
const DIRT_3B = along(HOME, LF_WALL, 0.42);

type Props = {
  play: PlayResult;
  progress: number;
  contact: ZoneCoord;
  bats: BatterHand;
  launchDeg?: number | null;
  aim?: ZoneCoord;
  timingMs?: number;
  windowMs?: number;
  fill?: boolean;
  className?: string;
};

export function BattedBallField({
  play,
  progress,
  contact,
  bats,
  launchDeg = null,
  aim,
  timingMs,
  windowMs,
  fill = false,
  className,
}: Props) {
  const sprayOpts: FieldSprayOpts = { bats, aim, timingMs, windowMs };
  const track = fieldTrackSamples(
    play,
    progress,
    contact,
    bats,
    launchDeg,
    sprayOpts,
    32,
  );
  const ball = fieldSampleAt(
    progress,
    play,
    contact,
    bats,
    launchDeg,
    sprayOpts,
  );
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

  const ballR = Math.max(1.2, 3.2 - ball.dist * 2.0 + ball.height * 1.6);
  const isHit =
    play === "home_run" || play === "double" || play === "single";

  function baseMark(c: { x: number; y: number }, size = 2.4) {
    const h = size / 2;
    return `${c.x},${c.y - h} ${c.x + h},${c.y} ${c.x},${c.y + h} ${c.x - h},${c.y}`;
  }

  return (
    <div
      className={cn(
        fill
          ? "absolute inset-0 overflow-hidden"
          : "relative mx-auto aspect-[4/5] w-full overflow-hidden rounded-sm border border-chalk/20",
        className,
      )}
      style={{ background: GRASS }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {/* Burgundy warning track — solid band, no fade */}
        <path
          d={`M ${LF_WALL.x - 2} ${LF_WALL.y + 8}
              Q 50 ${LF_WALL.y - 6} ${RF_WALL.x + 2} ${RF_WALL.y + 8}
              L ${RF_WALL.x + 1} ${RF_WALL.y + 2}
              Q 50 ${LF_WALL.y - 12} ${LF_WALL.x - 1} ${LF_WALL.y + 2}
              Z`}
          fill={WARNING}
        />

        {/* Outfield wall */}
        <path
          d={`M ${LF_WALL.x} ${LF_WALL.y} Q 50 ${LF_WALL.y - 12} ${RF_WALL.x} ${RF_WALL.y}`}
          fill="none"
          stroke={WALL}
          strokeWidth="0.85"
        />

        {/* Infield dirt — one solid cutout past all bases */}
        <polygon
          points={`${DIRT_HOME.x},${DIRT_HOME.y} ${DIRT_1B.x},${DIRT_1B.y} ${DIRT_2B.x},${DIRT_2B.y} ${DIRT_3B.x},${DIRT_3B.y}`}
          fill={DIRT}
        />

        {/* Foul lines = base paths (through 1B / 3B) */}
        <line
          x1={HOME.x}
          y1={HOME.y}
          x2={LF_WALL.x}
          y2={LF_WALL.y}
          stroke={CHALK}
          strokeWidth="0.45"
          opacity="0.85"
        />
        <line
          x1={HOME.x}
          y1={HOME.y}
          x2={RF_WALL.x}
          y2={RF_WALL.y}
          stroke={CHALK}
          strokeWidth="0.45"
          opacity="0.85"
        />
        {/* Infield base paths 1B–2B–3B */}
        <polyline
          points={`${FIRST.x},${FIRST.y} ${SECOND.x},${SECOND.y} ${THIRD.x},${THIRD.y}`}
          fill="none"
          stroke={CHALK}
          strokeWidth="0.4"
          opacity="0.7"
        />

        {/* Mound */}
        <ellipse
          cx={50}
          cy={(FIRST.y + HOME.y) / 2 - 2}
          rx="3.6"
          ry="2.5"
          fill={DIRT}
          stroke="oklch(0.45 0.07 68)"
          strokeWidth="0.3"
        />

        {/* Bases on the foul / base paths */}
        <polygon points={baseMark(FIRST)} fill={CHALK} />
        <polygon points={baseMark(SECOND)} fill={CHALK} />
        <polygon points={baseMark(THIRD)} fill={CHALK} />
        <polygon
          points={`${HOME.x},${HOME.y + 1.6} ${HOME.x - 2.4},${HOME.y - 1.2} ${HOME.x - 2.4},${HOME.y - 2.8} ${HOME.x + 2.4},${HOME.y - 2.8} ${HOME.x + 2.4},${HOME.y - 1.2}`}
          fill={CHALK}
        />

        {groundPath && (
          <path
            d={groundPath}
            fill="none"
            stroke="oklch(0.2 0.03 145 / 0.45)"
            strokeWidth="0.55"
            strokeLinecap="round"
            strokeDasharray="1.2 1.1"
          />
        )}

        {airPath && (
          <path
            d={airPath}
            fill="none"
            stroke={CHALK}
            strokeWidth="0.7"
            strokeOpacity="0.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        <ellipse
          cx={ballSvg.x}
          cy={ballSvg.shadowY}
          rx={Math.max(1.1, ballR * 1.05)}
          ry={0.7}
          fill="oklch(0.2 0.04 145 / 0.5)"
          opacity={Math.max(0.2, 0.55 - ball.height * 0.4)}
        />

        <circle
          cx={ballSvg.x}
          cy={ballSvg.y}
          r={ballR}
          fill={isHit ? "oklch(0.82 0.14 75)" : CHALK}
          opacity={Math.max(0.25, 1 - progress * 0.1)}
        />
      </svg>

      <p className="pointer-events-none absolute left-2.5 top-2 text-[10px] uppercase tracking-[0.16em] text-chalk/70">
        LF
      </p>
      <p className="pointer-events-none absolute right-2.5 top-2 text-[10px] uppercase tracking-[0.16em] text-chalk/70">
        RF
      </p>
      <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10px] uppercase tracking-[0.16em] text-chalk/80">
        {playResultLabel(play)} · {exitLabel(play)} ·{" "}
        {sprayLabel(contact, bats, sprayOpts)}
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
