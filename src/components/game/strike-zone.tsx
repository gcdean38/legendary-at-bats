"use client";

import type { MouseEvent } from "react";
import type { PitchType, PlayResult, ZoneCoord } from "@/lib/types";
import { ballPositionAt, ballScaleAt, exitPositionAt } from "@/lib/flight";
import { PLATE } from "@/lib/zone";
import { cn } from "@/lib/utils";

type Props = {
  interactive?: boolean;
  live?: boolean;
  target: ZoneCoord;
  pitchType: PitchType;
  aim?: ZoneCoord;
  showTarget?: boolean;
  ballProgress?: number;
  /** 0–1 exit flight after contact; 0 = hidden */
  exitProgress?: number;
  play?: PlayResult | null;
  contactPoint?: ZoneCoord;
  onAim?: (coord: ZoneCoord, timingMs: number) => void;
  startedAt?: number;
  className?: string;
};

export function StrikeZone({
  interactive = false,
  live = false,
  target,
  pitchType,
  aim,
  showTarget = false,
  ballProgress = 0,
  exitProgress = 0,
  play = null,
  contactPoint,
  onAim,
  startedAt = 0,
  className,
}: Props) {
  function handleClick(e: MouseEvent<HTMLDivElement>) {
    if (!interactive || !onAim) return;
    // Clicks are on the full plate (chase + zone), not just the 3×3.
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const timingMs = startedAt ? performance.now() - startedAt : 0;
    onAim({ x, y }, timingMs);
  }

  const inboundActive =
    ballProgress > 0 &&
    ballProgress < 1 &&
    !(exitProgress > 0) &&
    (!play ||
      play === "foul" ||
      play === "ball" ||
      play === "strike_looking");
  const inboundPos = inboundActive
    ? ballPositionAt(ballProgress, target, pitchType)
    : null;
  const inboundScale = inboundActive ? ballScaleAt(ballProgress) : 1;

  const showingExit =
    !!play &&
    play !== "ball" &&
    play !== "strike_looking" &&
    play !== "foul" &&
    exitProgress > 0 &&
    (contactPoint || aim || target);
  const exitFrom = contactPoint ?? aim ?? target;
  const exitPos =
    showingExit && play
      ? exitPositionAt(exitProgress, exitFrom, play)
      : null;

  const settledAtPlate =
    ballProgress >= 1 && exitProgress === 0 && !showTarget ? target : null;

  const zoneStyle = {
    left: `${PLATE.zoneLeft * 100}%`,
    right: `${(1 - PLATE.zoneRight) * 100}%`,
    top: `${PLATE.zoneTop * 100}%`,
    bottom: `${(1 - PLATE.zoneBottom) * 100}%`,
  };

  return (
    <div
      className={cn(
        "relative mx-auto aspect-[3/4] w-full max-w-[300px] select-none",
        className,
      )}
    >
      {/* Full plate = active chase frame (clickable) */}
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={
          interactive
            ? "Plate — click where you think the pitch is going"
            : "Plate and strike zone"
        }
        onClick={handleClick}
        className={cn(
          "absolute inset-0 overflow-visible rounded-sm border border-chalk/25 bg-turf/25",
          interactive && "cursor-crosshair anim-zone-live",
          live && "ring-1 ring-flood/40",
        )}
      >
        {/* Drawn strike zone (visual only — inset of the plate) */}
        <div
          className="absolute grid grid-cols-3 grid-rows-3 rounded-sm border-2 border-chalk/60 bg-background/45"
          style={zoneStyle}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-chalk/15" />
          ))}
        </div>

        {showTarget && (
          <span
            className="pointer-events-none absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-flood bg-flood/30"
            style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}
            title="Actual pitch location"
          />
        )}

        {aim && (
          <span
            className="pointer-events-none absolute z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
            style={{ left: `${aim.x * 100}%`, top: `${aim.y * 100}%` }}
            title="Your swing"
          />
        )}

        {play &&
          (play === "home_run" ||
            play === "double" ||
            play === "single" ||
            play === "sac_fly") &&
          exitProgress > 0 &&
          exitProgress < 0.25 &&
          exitFrom && (
            <span
              className="pointer-events-none absolute z-30 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flood/50 blur-[2px]"
              style={{
                left: `${exitFrom.x * 100}%`,
                top: `${exitFrom.y * 100}%`,
                opacity: 1 - exitProgress * 4,
              }}
            />
          )}

        {inboundPos && (
          <span
            className="pointer-events-none absolute z-10 rounded-full bg-chalk shadow-[0_0_18px_oklch(0.84_0.15_78/0.7)]"
            style={{
              left: `${inboundPos.x * 100}%`,
              top: `${inboundPos.y * 100}%`,
              width: `${1.15 + inboundScale}rem`,
              height: `${1.15 + inboundScale}rem`,
              transform: "translate(-50%, -50%)",
              opacity: 0.4 + ballProgress * 0.6,
            }}
          />
        )}

        {settledAtPlate && (
          <span
            className="pointer-events-none absolute z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chalk/80"
            style={{
              left: `${settledAtPlate.x * 100}%`,
              top: `${settledAtPlate.y * 100}%`,
            }}
          />
        )}

        {exitPos && play && (
          <span
            className={cn(
              "pointer-events-none absolute z-10 rounded-full",
              play === "home_run" || play === "double"
                ? "bg-primary shadow-[0_0_20px_oklch(0.82_0.14_75/0.85)]"
                : "bg-chalk/90",
            )}
            style={{
              left: `${exitPos.x * 100}%`,
              top: `${exitPos.y * 100}%`,
              width: play === "home_run" ? "1.35rem" : "1.1rem",
              height: play === "home_run" ? "1.35rem" : "1.1rem",
              transform: `translate(-50%, -50%) scale(${1 + exitProgress * 0.35})`,
              opacity: Math.max(
                0,
                play === "fly_out" || play === "sac_fly"
                  ? 1 - exitProgress * 0.55
                  : 1 - exitProgress * 0.85,
              ),
            }}
          />
        )}
      </div>

      <p className="absolute -bottom-7 left-0 right-0 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {interactive
          ? "Click the plate — zone or chase — or Take"
          : "Plate · strike zone inset"}
      </p>
    </div>
  );
}
