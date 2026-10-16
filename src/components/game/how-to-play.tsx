"use client";

import { Button } from "@/components/ui/button";

type Props = {
  onDismiss: () => void;
};

/**
 * Full-screen how-to tile — dismiss when ready to play.
 */
export function HowToPlayOverlay({ onDismiss }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/75 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
    >
      <div className="anim-rise w-full max-w-md rounded-md border border-chalk/25 bg-card/95 p-5 shadow-[0_12px_40px_oklch(0.1_0.02_155/0.55)] sm:p-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-flood">
          Before you step in
        </p>
        <h2
          id="how-to-play-title"
          className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-wide text-primary"
        >
          How to play
        </h2>

        <ol className="mt-5 space-y-3.5 text-sm leading-relaxed text-foreground/90">
          <li className="flex gap-3">
            <span className="font-[family-name:var(--font-display)] text-lg text-primary">
              1
            </span>
            <span>
              After the <strong className="text-chalk">3–2–1</strong>, the pitch
              comes through the zone. Click the plate to swing — don’t click and
              it counts as a <strong className="text-chalk">take</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-[family-name:var(--font-display)] text-lg text-primary">
              2
            </span>
            <span>
              Your click is the{" "}
              <strong className="text-chalk">barrel sweet spot</strong>. Aim
              where the ball will be — breaking balls spin{" "}
              <strong className="text-chalk">CW/CCW by pitcher hand</strong>,
              changeups tumble over themselves, heaters stay still.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-[family-name:var(--font-display)] text-lg text-primary">
              3
            </span>
            <span>
              Work the count. Stars rate how the at-bat ends — win the game,
              do your job, or fall short.
            </span>
          </li>
        </ol>

        <Button
          size="lg"
          className="mt-6 h-12 w-full font-semibold tracking-wide"
          onClick={onDismiss}
        >
          Got it · let’s play
        </Button>
      </div>
    </div>
  );
}
