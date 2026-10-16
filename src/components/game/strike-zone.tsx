"use client";

import { useState, type MouseEvent, type PointerEvent } from "react";
import type { PitchType, PlayResult, ZoneCoord } from "@/lib/types";
import type { BatterHand } from "@/lib/contact";
import {
  ballPositionAt,
  ballScaleAt,
  exitTrackSamples,
  exitVisualAt,
} from "@/lib/flight";
import { PLATE } from "@/lib/zone";
import { cn } from "@/lib/utils";

type Props = {
  interactive?: boolean;
  live?: boolean;
  target: ZoneCoord;
  pitchType: PitchType;
  bats?: BatterHand;
  aim?: ZoneCoord;
  showTarget?: boolean;
  ballProgress?: number;
  /** 0–1 exit flight after contact; 0 = hidden */
  exitProgress?: number;
  play?: PlayResult | null;
  contactPoint?: ZoneCoord;
  /** Hide plate exit overlay (unused when field camera is off) */
  suppressExitOverlay?: boolean;
  /** Spray cues for exit path (inside-out / timing) */
  sprayAim?: ZoneCoord;
  sprayTimingMs?: number;
  sprayWindowMs?: number;
  /** Fill a parent frame (PitchCanvas) instead of owning aspect ratio */
  fill?: boolean;
  hideCaption?: boolean;
  onAim?: (coord: ZoneCoord, timingMs: number) => void;
  startedAt?: number;
  className?: string;
};

export function StrikeZone({
  interactive = false,
  live = false,
  target,
  pitchType,
  bats = "R",
  aim,
  showTarget = false,
  ballProgress = 0,
  exitProgress = 0,
  play = null,
  contactPoint,
  suppressExitOverlay = false,
  sprayAim,
  sprayTimingMs,
  sprayWindowMs,
  fill = false,
  hideCaption = false,
  onAim,
  startedAt = 0,
  className,
}: Props) {
  const [hover, setHover] = useState<ZoneCoord | null>(null);

  function plateCoord(
    e: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>,
  ): ZoneCoord {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    if (!interactive || !onAim) return;
    const { x, y } = plateCoord(e);
    const timingMs = startedAt ? performance.now() - startedAt : 0;
    onAim({ x, y }, timingMs);
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!interactive) return;
    setHover(plateCoord(e));
  }

  function handlePointerLeave() {
    setHover(null);
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

  const TRAIL_COUNT = 14;
  const trailSpan = 0.32;
  const trail =
    inboundActive && ballProgress > 0.04
      ? Array.from({ length: TRAIL_COUNT }, (_, i) => {
          const u = (i + 1) / (TRAIL_COUNT + 1);
          const t = Math.max(0, ballProgress - trailSpan * (1 - u));
          const pos = ballPositionAt(t, target, pitchType);
          const scale = ballScaleAt(t);
          return { pos, scale, fade: u * u };
        })
      : [];

  // Whiffs are not contact — no off-the-bat exit trail / launch arc
  const showingExit =
    !suppressExitOverlay &&
    !!play &&
    play !== "ball" &&
    play !== "strike_looking" &&
    play !== "foul" &&
    play !== "whiff" &&
    exitProgress > 0 &&
    (contactPoint || aim || target);
  const exitFrom = contactPoint ?? aim ?? target;
  const sprayOpts = {
    aim: sprayAim ?? aim,
    timingMs: sprayTimingMs,
    windowMs: sprayWindowMs,
  };
  const exitVis =
    showingExit && play
      ? exitVisualAt(exitProgress, exitFrom, play, bats, sprayOpts)
      : null;
  const exitTrack =
    showingExit && play
      ? exitTrackSamples(exitFrom, play, exitProgress, 18, bats, sprayOpts)
      : [];

  // Pitch still arrives at the plate on a whiff (no BIP flight)
  const settledAtPlate =
    play === "whiff" && exitProgress > 0
      ? target
      : ballProgress >= 1 && exitProgress === 0 && !showTarget
        ? target
        : null;

  // Live barrel reticle while aiming (before click)
  const showHoverReticle = interactive && live && !aim && hover;

  const zoneStyle = {
    left: `${PLATE.zoneLeft * 100}%`,
    right: `${(1 - PLATE.zoneRight) * 100}%`,
    top: `${PLATE.zoneTop * 100}%`,
    bottom: `${(1 - PLATE.zoneBottom) * 100}%`,
  };

  return (
    <div
      className={cn(
        fill
          ? "absolute inset-0 select-none"
          : "relative mx-auto aspect-[3/4] w-full max-w-[300px] select-none",
        className,
      )}
    >
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={
          interactive
            ? "Plate — click where you think the pitch is going"
            : "Plate and strike zone"
        }
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={cn(
          "absolute inset-0 overflow-visible rounded-sm border border-chalk/25 bg-turf/25",
          interactive && "cursor-none anim-zone-live",
          live && "ring-1 ring-flood/40",
        )}
      >
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

        {showHoverReticle && (
          <span
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/80 bg-primary/15 shadow-[0_0_16px_oklch(0.82_0.14_75/0.35)]"
            style={{
              left: `${hover.x * 100}%`,
              top: `${hover.y * 100}%`,
              width: "14%",
              height: "10.5%",
            }}
            title="Barrel sweet spot"
          >
            <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/90" />
          </span>
        )}

        {aim && (
          <span
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary/25 shadow-[0_0_14px_oklch(0.82_0.14_75/0.4)]"
            style={{
              left: `${aim.x * 100}%`,
              top: `${aim.y * 100}%`,
              width: "14%",
              height: "10.5%",
            }}
            title="Barrel sweet spot"
          >
            <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
          </span>
        )}

        {play &&
          (play === "home_run" ||
            play === "double" ||
            play === "single" ||
            play === "sac_fly") &&
          !suppressExitOverlay &&
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

        {trail.map((node, i) => (
          <span
            key={`trail-${i}`}
            className="pointer-events-none absolute z-[9] rounded-full bg-chalk/80"
            style={{
              left: `${node.pos.x * 100}%`,
              top: `${node.pos.y * 100}%`,
              width: `${0.35 + node.scale * 0.55}rem`,
              height: `${0.35 + node.scale * 0.55}rem`,
              transform: "translate(-50%, -50%)",
              opacity: 0.08 + node.fade * 0.38,
              boxShadow: `0 0 ${4 + node.fade * 10}px oklch(0.84 0.15 78 / ${0.15 + node.fade * 0.35})`,
            }}
          />
        ))}

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

        {exitTrack.map((node, i) => (
          <span
            key={`exit-track-${i}`}
            className="pointer-events-none absolute z-[8] rounded-full bg-chalk"
            style={{
              left: `${node.x * 100}%`,
              top: `${node.y * 100}%`,
              width: `${0.28 + node.scale * 0.55}rem`,
              height: `${0.28 + node.scale * 0.55}rem`,
              transform: "translate(-50%, -50%)",
              opacity:
                node.opacity *
                (0.15 + (i / Math.max(1, exitTrack.length)) * 0.45),
            }}
          />
        ))}

        {exitVis && play && (
          <>
            <span
              className="pointer-events-none absolute z-[9] rounded-full bg-black/50 blur-[2px]"
              style={{
                left: `${exitVis.x * 100}%`,
                top: `${exitVis.shadowY * 100}%`,
                width: `${1.1 * exitVis.shadowScale}rem`,
                height: `${0.45 * exitVis.shadowScale}rem`,
                transform: "translate(-50%, -50%)",
                opacity: exitVis.shadowOpacity,
              }}
            />
            <span
              className={cn(
                "pointer-events-none absolute z-10 rounded-full",
                play === "home_run" || play === "double"
                  ? "bg-primary shadow-[0_0_22px_oklch(0.82_0.14_75/0.85)]"
                  : "bg-chalk shadow-[0_0_14px_oklch(0.84_0.12_78/0.55)]",
              )}
              style={{
                left: `${exitVis.x * 100}%`,
                top: `${exitVis.y * 100}%`,
                width: `${1.15 * exitVis.scale}rem`,
                height: `${1.15 * exitVis.scale}rem`,
                transform: "translate(-50%, -50%)",
                opacity: exitVis.opacity,
              }}
            />
          </>
        )}
      </div>

      {!hideCaption && (
        <p className="absolute -bottom-7 left-0 right-0 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {interactive
            ? "Click the plate — zone or chase — or Take"
            : "Plate · strike zone inset"}
        </p>
      )}
    </div>
  );
}
