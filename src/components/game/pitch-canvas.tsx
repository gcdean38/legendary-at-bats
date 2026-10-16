"use client";

import type { ReactNode } from "react";
import type { ExitKind, PitchType, PlayResult, ZoneCoord } from "@/lib/types";
import type { BatterHand } from "@/lib/contact";
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
  exitKind?: ExitKind | null;
  timingMs?: number;
  windowMs?: number;
  onAim?: (coord: ZoneCoord, timingMs: number) => void;
  startedAt?: number;
  className?: string;
  children?: ReactNode;
};

/**
 * Phone-width plate stage: pitch in, then ball off the bat and fade —
 * no separate field camera.
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
  exitKind = null,
  timingMs,
  windowMs,
  onAim,
  startedAt = 0,
  className,
  children,
}: Props) {
  return (
    <div
      className={cn(
        "relative mx-auto aspect-[4/5] w-full select-none",
        className,
      )}
    >
      <StrikeZone
        fill
        interactive={interactive}
        live={live}
        target={target}
        pitchType={pitchType}
        bats={bats}
        aim={aim}
        showTarget={showTarget}
        ballProgress={ballProgress}
        exitProgress={exitProgress}
        play={play}
        exitKind={exitKind}
        contactPoint={target}
        sprayAim={aim}
        sprayTimingMs={timingMs}
        sprayWindowMs={windowMs}
        onAim={onAim}
        startedAt={startedAt}
      />
      {children}
    </div>
  );
}
