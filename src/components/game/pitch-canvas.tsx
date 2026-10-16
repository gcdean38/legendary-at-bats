"use client";

import type { ReactNode } from "react";
import type { PitchType, PlayResult, ZoneCoord } from "@/lib/types";
import type { BatterHand } from "@/lib/contact";
import {
  BattedBallField,
  shouldShowFieldFlight,
} from "@/components/game/batted-ball-field";
import { StrikeZone } from "@/components/game/strike-zone";
import { cn } from "@/lib/utils";

type Props = {
  interactive?: boolean;
  live?: boolean;
  target: ZoneCoord;
  pitchType: PitchType;
  bats: BatterHand;
  aim?: ZoneCoord;
  showTarget?: boolean;
  ballProgress?: number;
  exitProgress?: number;
  play?: PlayResult | null;
  launchDeg?: number | null;
  timingMs?: number;
  windowMs?: number;
  onAim?: (coord: ZoneCoord, timingMs: number) => void;
  startedAt?: number;
  className?: string;
  children?: ReactNode;
};

/**
 * One phone-sized frame: strike zone during the pitch, then morphs into
 * an overhead diamond for the batted-ball flight — same screen real estate.
 */
export function PitchCanvas({
  interactive = false,
  live = false,
  target,
  pitchType,
  bats,
  aim,
  showTarget = false,
  ballProgress = 0,
  exitProgress = 0,
  play = null,
  launchDeg = null,
  timingMs,
  windowMs,
  onAim,
  startedAt = 0,
  className,
  children,
}: Props) {
  const fieldActive =
    shouldShowFieldFlight(play) && exitProgress > 0.01;

  // Camera morph completes in the first ~40% of exit flight
  const morph = fieldActive
    ? Math.min(1, Math.max(0, exitProgress / 0.4))
    : 0;

  // Ease-out so the pullback feels snappy then settles
  const eased = 1 - Math.pow(1 - morph, 2.2);

  return (
    <div
      className={cn(
        "relative mx-auto aspect-[4/5] w-full select-none overflow-hidden rounded-sm",
        className,
      )}
    >
      {/* Field layer — fades/scales in underneath as the plate pulls back */}
      <div
        className="absolute inset-0 z-0"
        style={{
          opacity: eased,
          transform: `scale(${1.08 - eased * 0.08})`,
          pointerEvents: "none",
        }}
        aria-hidden={!fieldActive}
      >
        {fieldActive && play && (
          <BattedBallField
            fill
            play={play}
            progress={Math.max(exitProgress, 0.05)}
            contact={target}
            bats={bats}
            launchDeg={launchDeg}
            aim={aim}
            timingMs={timingMs}
            windowMs={windowMs}
          />
        )}
      </div>

      {/* Plate layer — shrinks toward home (bottom-center) */}
      <div
        className="absolute inset-0 z-10 origin-[50%_88%]"
        style={{
          opacity: fieldActive ? Math.max(0, 1 - eased * 1.15) : 1,
          transform: fieldActive
            ? `translateY(${eased * 18}%) scale(${1 - eased * 0.72})`
            : "none",
          pointerEvents: fieldActive && eased > 0.55 ? "none" : undefined,
        }}
      >
        <StrikeZone
          fill
          interactive={interactive && !fieldActive}
          live={live}
          target={target}
          pitchType={pitchType}
          bats={bats}
          aim={aim}
          showTarget={showTarget && !fieldActive}
          ballProgress={ballProgress}
          exitProgress={fieldActive ? 0 : exitProgress}
          play={play}
          contactPoint={target}
          suppressExitOverlay={fieldActive}
          onAim={onAim}
          startedAt={startedAt}
          hideCaption
        />
      </div>

      {/* Caption swaps with the morph */}
      <p className="pointer-events-none absolute -bottom-7 left-0 right-0 z-20 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {fieldActive && eased > 0.45
          ? "Field · ball in play"
          : interactive
            ? "Click the plate — zone or chase — or Take"
            : "Plate · strike zone inset"}
      </p>

      {children}
    </div>
  );
}
