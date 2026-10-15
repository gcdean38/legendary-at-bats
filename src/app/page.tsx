import { Suspense } from "react";
import { DailyGame } from "@/components/game/daily-game";

function BootFallback() {
  return (
    <div className="stadium-bg flex min-h-dvh items-center justify-center">
      <p className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-primary">
        Legendary At Bats
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<BootFallback />}>
      <DailyGame />
    </Suspense>
  );
}
