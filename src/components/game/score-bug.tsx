"use client";

import type { BasesState, CountState, ScoreSide } from "@/lib/types";
import { cn } from "@/lib/utils";

function Dots({
  filled,
  total,
  label,
  tone = "chalk",
}: {
  filled: number;
  total: number;
  label: string;
  tone?: "chalk" | "flood" | "out";
}) {
  const fillClass =
    tone === "flood"
      ? "bg-flood"
      : tone === "out"
        ? "bg-primary"
        : "bg-chalk";
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 w-2 rounded-full border border-chalk/35",
              i < filled ? fillClass : "bg-transparent",
            )}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

function BaseDiamond({ bases }: { bases: BasesState }) {
  const bag = (on: boolean) =>
    cn(
      "absolute h-2.5 w-2.5 rotate-45 border border-chalk/50",
      on ? "bg-flood shadow-[0_0_8px_oklch(0.84_0.15_78/0.7)]" : "bg-transparent",
    );
  return (
    <div
      className="relative h-9 w-9 shrink-0"
      aria-label={`Bases: ${bases.first ? "1st " : ""}${bases.second ? "2nd " : ""}${bases.third ? "3rd" : ""}${!bases.first && !bases.second && !bases.third ? "empty" : ""}`}
    >
      {/* 2B top */}
      <span className={cn(bag(bases.second), "left-1/2 top-0 -translate-x-1/2")} />
      {/* 3B left */}
      <span className={cn(bag(bases.third), "left-0 top-1/2 -translate-y-1/2")} />
      {/* 1B right */}
      <span className={cn(bag(bases.first), "right-0 top-1/2 -translate-y-1/2")} />
      {/* Home hint */}
      <span className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rotate-45 border border-chalk/25" />
    </div>
  );
}

type Props = {
  away: ScoreSide;
  home: ScoreSide;
  inning: string;
  outs: number;
  count: CountState;
  bases: BasesState;
  className?: string;
};

export function ScoreBug({
  away,
  home,
  inning,
  outs,
  count,
  bases,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-chalk/20 bg-background/75 shadow-[0_8px_30px_oklch(0_0_0/0.35)] backdrop-blur-sm",
        className,
      )}
      aria-label={`Score ${away.abbr} ${away.runs}, ${home.abbr} ${home.runs}. Count ${count.balls}-${count.strikes}, ${outs} out.`}
    >
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-2">
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-[family-name:var(--font-display)] text-lg tracking-wide text-chalk">
              {away.abbr}
            </span>
            <span className="tabular-nums text-lg font-semibold text-foreground">
              {away.runs}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-[family-name:var(--font-display)] text-lg tracking-wide text-primary">
              {home.abbr}
            </span>
            <span className="tabular-nums text-lg font-semibold text-foreground">
              {home.runs}
            </span>
          </div>
        </div>

        <BaseDiamond bases={bases} />

        <div className="flex flex-col items-end justify-between gap-1 border-l border-chalk/15 pl-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {inning}
          </p>
          <div className="space-y-1">
            <Dots label="B" filled={count.balls} total={4} tone="flood" />
            <Dots label="S" filled={count.strikes} total={3} tone="chalk" />
            <Dots label="O" filled={outs} total={3} tone="out" />
          </div>
        </div>
      </div>
    </div>
  );
}
