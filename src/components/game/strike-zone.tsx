"use client";

import type { MouseEvent } from "react";
import type { ZoneCoord } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  interactive?: boolean;
  live?: boolean;
  target?: ZoneCoord;
  aim?: ZoneCoord;
  showTarget?: boolean;
  ballProgress?: number;
  onAim?: (coord: ZoneCoord, timingMs: number, startedAt: number) => void;
  startedAt?: number;
  className?: string;
};

export function StrikeZone({
  interactive = false,
  live = false,
  target,
  aim,
  showTarget = false,
  ballProgress = 0,
  onAim,
  startedAt = 0,
  className,
}: Props) {
  function handleClick(e: MouseEvent<HTMLDivElement>) {
    if (!interactive || !onAim) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const timingMs = startedAt ? performance.now() - startedAt : 0;
    onAim({ x, y }, timingMs, startedAt);
  }

  return (
    <div
      className={cn(
        "relative mx-auto aspect-[3/4] w-full max-w-[280px] select-none",
        className,
      )}
    >
      {/* Outer chase frame */}
      <div className="absolute inset-0 rounded-sm border border-chalk/20 bg-turf/20" />

      {/* Strike zone */}
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? "Strike zone — click where you swing" : "Strike zone"}
        onClick={handleClick}
        className={cn(
          "absolute inset-[12%] grid grid-cols-3 grid-rows-3 rounded-sm border-2 border-chalk/55 bg-background/40",
          interactive && "cursor-crosshair anim-zone-live",
          live && "ring-1 ring-flood/40",
        )}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="border border-chalk/15" />
        ))}

        {showTarget && target && (
          <span
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-flood bg-flood/30"
            style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}
            title="Pitch location"
          />
        )}

        {aim && (
          <span
            className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
            style={{ left: `${aim.x * 100}%`, top: `${aim.y * 100}%` }}
            title="Your aim"
          />
        )}

        {ballProgress > 0 && ballProgress < 1 && (
          <span
            className="pointer-events-none absolute left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-chalk shadow-[0_0_18px_oklch(0.84_0.15_78/0.7)]"
            style={{
              top: `${8 + ballProgress * 78}%`,
              transform: `translate(-50%, -50%) scale(${0.45 + ballProgress * 0.55})`,
              opacity: 0.35 + ballProgress * 0.65,
            }}
          />
        )}
      </div>

      <p className="absolute -bottom-7 left-0 right-0 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {interactive ? "Click the zone as the pitch arrives" : "Strike zone"}
      </p>
    </div>
  );
}
