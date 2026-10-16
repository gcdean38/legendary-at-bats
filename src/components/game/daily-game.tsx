"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HowToPlayOverlay } from "@/components/game/how-to-play";
import { PitchCanvas } from "@/components/game/pitch-canvas";
import { ScoreBug } from "@/components/game/score-bug";
import { LEGENDARY_AT_BATS } from "@/data/legendary-at-bats";
import { getDailyAtBat, formatShareSummary, utcDateKey } from "@/lib/daily";
import { exitLabel } from "@/lib/flight";
import { playResultLabel } from "@/lib/contact";
import {
  MAX_PITCHES_PER_AB,
  applyPitchEvent,
  eventLabel,
  formatScoreLine,
  pitchAtCursor,
} from "@/lib/count";
import {
  finalizeSession,
  gradePitch,
  outcomeLabel,
  pitchTypeLabel,
} from "@/lib/scoring";
import type {
  AtBatEndReason,
  AtBatSessionResult,
  CountState,
  GamePhase,
  LegendaryAtBat,
  PitchResultGrade,
  ZoneCoord,
} from "@/lib/types";
import { isInStrikeZone } from "@/lib/zone";
import { cn } from "@/lib/utils";

const FLIGHT_MS = 1400;
const EXIT_MS = 1200;
const LATE_TAKE_GRACE_MS = 900;
/** Auto-advance between pitches (3–2–1 grow/fade; not on AB end). */
const BETWEEN_PITCH_MS = 3000;

export function DailyGame() {
  const [phase, setPhase] = useState<GamePhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [atBat, setAtBat] = useState<LegendaryAtBat | null>(null);
  const [dateKey, setDateKey] = useState("");
  const [isDaily, setIsDaily] = useState(true);
  const [pitchCursor, setPitchCursor] = useState(0);
  const [count, setCount] = useState<CountState>({ balls: 0, strikes: 0 });
  const [grades, setGrades] = useState<PitchResultGrade[]>([]);
  const [lastGrade, setLastGrade] = useState<PitchResultGrade | null>(null);
  const [session, setSession] = useState<AtBatSessionResult | null>(null);
  const [aim, setAim] = useState<ZoneCoord | undefined>();
  const [ballProgress, setBallProgress] = useState(0);
  const [exitProgress, setExitProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [continueInSec, setContinueInSec] = useState<number | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const flightStart = useRef(0);
  const rafRef = useRef<number | null>(null);
  const decidedRef = useRef(false);
  const gradesRef = useRef<PitchResultGrade[]>([]);
  const countRef = useRef<CountState>({ balls: 0, strikes: 0 });
  const cursorRef = useRef(0);
  const pendingEndRef = useRef<AtBatEndReason | null>(null);
  const continueTimerRef = useRef<number | null>(null);
  const postResultDelayRef = useRef<number | null>(null);

  const currentPitch =
    atBat && atBat.pitches.length > 0
      ? pitchAtCursor(atBat.pitches, pitchCursor)
      : null;
  const recycled =
    !!atBat && pitchCursor >= atBat.pitches.length && atBat.pitches.length > 0;

  useEffect(() => {
    try {
      const pick = getDailyAtBat(new Date());
      setAtBat(pick.atBat);
      setDateKey(pick.dateKey);
      setIsDaily(true);
      const t = window.setTimeout(() => setPhase("intro"), 400);
      return () => window.clearTimeout(t);
    } catch {
      setError("Could not load today’s legendary at-bat.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (continueTimerRef.current) window.clearInterval(continueTimerRef.current);
      if (postResultDelayRef.current) window.clearTimeout(postResultDelayRef.current);
    };
  }, []);

  // 3–2–1 lives on the front of a pitch (windup), never after a play.
  useEffect(() => {
    if (phase !== "pitch_windup") {
      return;
    }
    startWindupCountdown();
    return () => cancelContinueTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pitchCursor]);

  function cancelFlight() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function cancelPostResultDelay() {
    if (postResultDelayRef.current) {
      window.clearTimeout(postResultDelayRef.current);
      postResultDelayRef.current = null;
    }
  }

  function cancelContinueTimer() {
    if (continueTimerRef.current) {
      window.clearInterval(continueTimerRef.current);
      continueTimerRef.current = null;
    }
    setContinueInSec(null);
  }

  /** 3–2–1 over the plate, then the pitch flies. */
  function startWindupCountdown() {
    cancelContinueTimer();
    const beats = Math.max(1, Math.round(BETWEEN_PITCH_MS / 1000));
    let beat = beats;
    setContinueInSec(beat);
    continueTimerRef.current = window.setInterval(() => {
      beat -= 1;
      if (beat <= 0) {
        cancelContinueTimer();
        beginPitch();
      } else {
        setContinueInSec(beat);
      }
    }, 1000);
  }

  function startFlightLoop() {
    cancelFlight();
    flightStart.current = performance.now();
    setBallProgress(0);
    setExitProgress(0);
    const tick = (now: number) => {
      const p = Math.min(1, (now - flightStart.current) / FLIGHT_MS);
      setBallProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function startExitLoop(onDone?: () => void) {
    cancelFlight();
    const start = performance.now();
    setExitProgress(0.01);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / EXIT_MS);
      setExitProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        onDone?.();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function resetBattleState() {
    cancelContinueTimer();
    cancelPostResultDelay();
    decidedRef.current = false;
    gradesRef.current = [];
    countRef.current = { balls: 0, strikes: 0 };
    cursorRef.current = 0;
    pendingEndRef.current = null;
    setPitchCursor(0);
    setCount({ balls: 0, strikes: 0 });
    setGrades([]);
    setLastGrade(null);
    setSession(null);
    setAim(undefined);
    setBallProgress(0);
    setExitProgress(0);
    setCopied(false);
  }

  function selectAtBat(next: LegendaryAtBat, daily: boolean) {
    cancelFlight();
    resetBattleState();
    setAtBat(next);
    setIsDaily(daily);
    setDateKey(daily ? utcDateKey(new Date()) : `practice · ${next.id}`);
    setPhase("situation");
    setHowToOpen(true);
  }

  function beginPitch() {
    cancelContinueTimer();
    decidedRef.current = false;
    setAim(undefined);
    setLastGrade(null);
    setBallProgress(0);
    setExitProgress(0);
    pendingEndRef.current = null;
    setPhase("pitch_live");
    startFlightLoop();
  }

  /** 3–2–1 over the plate, then the pitch flies. */
  function beginPitchWindup() {
    cancelFlight();
    cancelContinueTimer();
    decidedRef.current = false;
    setAim(undefined);
    setLastGrade(null);
    setBallProgress(0);
    setExitProgress(0);
    pendingEndRef.current = null;
    setPhase("pitch_windup");
  }

  function commitPitchGrade(grade: PitchResultGrade, swingAim?: ZoneCoord) {
    if (decidedRef.current) return;
    decidedRef.current = true;
    cancelFlight();
    const nextGrades = [...gradesRef.current, grade];
    gradesRef.current = nextGrades;
    setGrades(nextGrades);
    setLastGrade(grade);
    if (swingAim) setAim(swingAim);

    const applied = applyPitchEvent(countRef.current, grade.event);
    countRef.current = applied.count;
    setCount(applied.count);
    const endReason = applied.ended
      ? (applied.reason ?? "out")
      : cursorRef.current + 1 >= MAX_PITCHES_PER_AB
        ? "max_pitches"
        : null;
    pendingEndRef.current = endReason;

    setBallProgress(1);
    setPhase("pitch_result");
    // After the play anim, advance (windup countdown is on the next pitch).
    cancelContinueTimer();
    cancelPostResultDelay();
    if (grade.swung) {
      startExitLoop(() => advanceAfterFeedback());
    } else {
      setExitProgress(0);
      postResultDelayRef.current = window.setTimeout(() => {
        postResultDelayRef.current = null;
        advanceAfterFeedback();
      }, 600);
    }
  }

  function onTake() {
    if (!currentPitch || !atBat || phase !== "pitch_live") return;
    const grade = gradePitch({
      pitch: currentPitch,
      decision: "take",
      windowMs: FLIGHT_MS,
      bases: atBat.bases,
      outs: atBat.outs,
      bats: atBat.batter.bats,
    });
    commitPitchGrade(grade);
  }

  function onAim(coord: ZoneCoord, timingMs: number) {
    if (!currentPitch || !atBat || phase !== "pitch_live") return;
    const grade = gradePitch({
      pitch: currentPitch,
      decision: "swing",
      aim: coord,
      timingMs,
      windowMs: FLIGHT_MS,
      bases: atBat.bases,
      outs: atBat.outs,
      bats: atBat.batter.bats,
    });
    commitPitchGrade(grade, coord);
  }

  useEffect(() => {
    if (phase !== "pitch_live" || ballProgress < 1) return;
    const t = window.setTimeout(() => {
      if (!decidedRef.current) onTake();
    }, LATE_TAKE_GRACE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ballProgress, pitchCursor]);

  function endAtBat(reason: AtBatEndReason, finalCount: CountState) {
    if (!atBat) return;
    startTransition(() => {
      const final = finalizeSession({
        atBat,
        dateKey,
        grades: gradesRef.current,
        endReason: reason,
        finalCount,
      });
      setSession(final);
      setPhase("result");
    });
  }

  function advanceAfterFeedback() {
    // Called from exit-loop / take-hold timeouts — do NOT gate on
    // lastGrade state (stale closure; still null in the commit render).
    if (!atBat || gradesRef.current.length === 0) return;
    cancelContinueTimer();
    cancelPostResultDelay();
    cancelFlight();
    if (pendingEndRef.current) {
      // BIP / AB over — no countdown, go straight to the result
      endAtBat(pendingEndRef.current, countRef.current);
      pendingEndRef.current = null;
      return;
    }
    const nextCursor = cursorRef.current + 1;
    cursorRef.current = nextCursor;
    setPitchCursor(nextCursor);
    // Next pitch: 3–2–1 on the windup (front), then it flies
    beginPitchWindup();
  }

  async function shareResult() {
    if (!session || !atBat) return;
    const text = formatShareSummary({
      dateKey: session.dateKey,
      codename: atBat.codename,
      stars: session.stars,
      verdict: session.historyVerdict,
      endingTitle: session.endingTitle,
    });
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      setError("Could not copy share text. Select and copy manually.");
    }
  }

  function goHome() {
    cancelFlight();
    resetBattleState();
    try {
      const pick = getDailyAtBat(new Date());
      setAtBat(pick.atBat);
      setDateKey(pick.dateKey);
      setIsDaily(true);
    } catch {
      /* keep current */
    }
    setError(null);
    setPhase("intro");
  }

  return (
    <div className="stadium-bg relative min-h-dvh overflow-hidden">
      <div className="stadium-grain absolute inset-0 opacity-40" aria-hidden />
      <div
        className="anim-flood pointer-events-none absolute -top-24 left-1/2 h-64 w-[120%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,oklch(0.84_0.15_78/0.28),transparent_65%)]"
        aria-hidden
      />

      {howToOpen && (
        <HowToPlayOverlay onDismiss={() => setHowToOpen(false)} />
      )}

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
        {phase === "loading" && <LoadingState />}
        {phase === "error" && (
          <ErrorState message={error ?? "Something went wrong."} onRetry={goHome} />
        )}
        {phase === "intro" && atBat && (
          <IntroScreen
            dateKey={dateKey}
            daily={atBat}
            catalogSize={LEGENDARY_AT_BATS.length}
            onPlayDaily={() => selectAtBat(atBat, true)}
            onOpenCatalog={() => setPhase("catalog")}
          />
        )}
        {phase === "catalog" && (
          <CatalogScreen
            dailyId={getDailyAtBat(new Date()).atBat.id}
            onPick={(ab) => selectAtBat(ab, ab.id === getDailyAtBat(new Date()).atBat.id)}
            onBack={() => setPhase("intro")}
          />
        )}
        {phase === "situation" && atBat && (
          <SituationScreen
            atBat={atBat}
            dateKey={dateKey}
            count={count}
            isDaily={isDaily}
            onStart={() => beginPitchWindup()}
            onBack={goHome}
            onHowTo={() => setHowToOpen(true)}
          />
        )}
        {atBat &&
          currentPitch &&
          (phase === "pitch_windup" ||
            phase === "pitch_live" ||
            phase === "pitch_result") && (
            <PitchScreen
              atBat={atBat}
              pitch={currentPitch}
              pitchNumber={pitchCursor + 1}
              recycled={recycled}
              phase={phase}
              count={count}
              lastGrade={lastGrade}
              aim={aim}
              ballProgress={ballProgress}
              exitProgress={exitProgress}
              flightStart={flightStart.current}
              continueInSec={continueInSec}
              onTake={onTake}
              onAim={onAim}
            />
          )}
        {phase === "result" && atBat && session && (
          <ResultScreen
            atBat={atBat}
            session={session}
            copied={copied}
            pending={pending}
            onShare={shareResult}
            onReplay={() => selectAtBat(atBat, isDaily)}
            onCatalog={() => {
              resetBattleState();
              setPhase("catalog");
            }}
            onHome={goHome}
          />
        )}
        {!atBat && phase !== "loading" && phase !== "error" && phase !== "catalog" && (
          <EmptyState onRetry={goHome} />
        )}
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 anim-rise">
      <p className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-primary">
        Legendary At Bats
      </p>
      <p className="text-sm text-muted-foreground">Loading today’s challenge…</p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center anim-rise">
      <p className="font-[family-name:var(--font-display)] text-3xl text-destructive">
        Challenge unavailable
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center anim-rise">
      <p className="font-[family-name:var(--font-display)] text-3xl">No at-bat</p>
      <Button variant="secondary" onClick={onRetry}>
        Reload
      </Button>
    </div>
  );
}

function IntroScreen({
  dateKey,
  daily,
  onPlayDaily,
  onOpenCatalog,
  catalogSize,
}: {
  dateKey: string;
  daily: LegendaryAtBat;
  onPlayDaily: () => void;
  onOpenCatalog: () => void;
  catalogSize: number;
}) {
  return (
    <section className="flex min-h-[85dvh] flex-col justify-between gap-10 py-4">
      <div className="anim-rise space-y-6 pt-8 text-center sm:pt-14">
        <p className="text-xs uppercase tracking-[0.35em] text-flood/90">
          Daily challenge · {dateKey} UTC
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-6xl leading-[0.9] tracking-wide text-chalk sm:text-7xl">
          Legendary
          <br />
          <span className="text-primary">At Bats</span>
        </h1>
        <p className="mx-auto max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
          Watch the pitch. Take or swing where it’s going. Work the count — then
          see if you matched the legend or changed history.
        </p>
        <p className="text-sm text-muted-foreground">
          Today:{" "}
          <span className="text-foreground">
            {daily.codename} · {daily.venue} · {daily.away.abbr}{" "}
            {daily.away.runs}–{daily.home.abbr} {daily.home.runs}
          </span>
        </p>
      </div>

      <div className="anim-rise-delay space-y-3">
        <Button
          size="lg"
          className="h-12 w-full text-base font-semibold tracking-wide"
          onClick={onPlayDaily}
        >
          Play today’s at-bat
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="h-12 w-full text-base"
          onClick={onOpenCatalog}
        >
          Practice all {catalogSize} moments
        </Button>
      </div>
    </section>
  );
}

function CatalogScreen({
  dailyId,
  onPick,
  onBack,
}: {
  dailyId: string;
  onPick: (ab: LegendaryAtBat) => void;
  onBack: () => void;
}) {
  return (
    <section className="anim-rise flex min-h-[85dvh] flex-col gap-4 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-primary">
          All moments
        </p>
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Open any legendary AB for testing — same rules as the daily.
      </p>
      <ul className="flex flex-1 flex-col gap-2 overflow-y-auto pb-4">
        {LEGENDARY_AT_BATS.map((ab) => (
          <li key={ab.id}>
            <button
              type="button"
              onClick={() => onPick(ab)}
              className="w-full rounded-md border border-border/70 bg-secondary/40 px-3 py-3 text-left transition hover:border-flood/40 hover:bg-secondary/70"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{ab.codename}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ab.year} · {ab.series} · {ab.gameLabel} · {ab.inning} ·{" "}
                    {ab.venue}
                  </p>
                  <p className="mt-1 text-xs text-flood">
                    {formatScoreLine(ab.away, ab.home)} · {ab.runners} · {ab.outs}{" "}
                    out
                  </p>
                </div>
                {ab.id === dailyId && (
                  <Badge variant="outline" className="shrink-0 rounded-md text-[10px]">
                    Today
                  </Badge>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SituationScreen({
  atBat,
  dateKey,
  count,
  isDaily,
  onStart,
  onBack,
  onHowTo,
}: {
  atBat: LegendaryAtBat;
  dateKey: string;
  count: CountState;
  isDaily: boolean;
  onStart: () => void;
  onBack: () => void;
  onHowTo: () => void;
}) {
  return (
    <section className="anim-rise flex min-h-[85dvh] flex-col justify-between gap-8 py-4">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-primary">
            Legendary At Bats
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={onHowTo}
            >
              How to play
            </Button>
            <Badge variant="outline" className="rounded-md border-flood/40 text-flood">
              {isDaily ? dateKey : "Practice"}
            </Badge>
          </div>
        </div>

        <ScoreBug
          away={atBat.away}
          home={atBat.home}
          inning={atBat.inning}
          outs={atBat.outs}
          count={count}
          bases={atBat.bases}
        />

        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            {atBat.year} · {atBat.series} · {atBat.gameLabel} · {atBat.venue}
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-4xl tracking-wide text-chalk sm:text-5xl">
            {atBat.codename}
          </h2>
        </div>
        <p className="text-base leading-relaxed text-foreground/90">
          {atBat.situationBlurb}
        </p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Runners" value={atBat.runners} />
          <Stat label="Score" value={formatScoreLine(atBat.away, atBat.home)} />
          <Stat
            label="Batter"
            value={`${atBat.batter.team} #${atBat.batter.number} (${atBat.batter.bats})`}
          />
          <Stat
            label="Pitcher"
            value={`${atBat.pitcher.team} #${atBat.pitcher.number} (${atBat.pitcher.throws})`}
          />
        </dl>
        <p className="border-l-2 border-primary/70 pl-3 text-sm text-muted-foreground">
          {atBat.stakes}
        </p>
      </div>
      <div className="grid gap-2">
        <Button size="lg" className="h-12 w-full font-semibold" onClick={onStart}>
          Step in · 0–0 count
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/60 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

function PitchScreen({
  atBat,
  pitch,
  pitchNumber,
  recycled,
  phase,
  count,
  lastGrade,
  aim,
  ballProgress,
  exitProgress,
  flightStart,
  continueInSec,
  onTake,
  onAim,
}: {
  atBat: LegendaryAtBat;
  pitch: LegendaryAtBat["pitches"][number];
  pitchNumber: number;
  recycled: boolean;
  phase: GamePhase;
  count: CountState;
  lastGrade: PitchResultGrade | null;
  aim?: ZoneCoord;
  ballProgress: number;
  exitProgress: number;
  flightStart: number;
  continueInSec: number | null;
  onTake: () => void;
  onAim: (c: ZoneCoord, ms: number) => void;
}) {
  const live = phase === "pitch_live";
  const windup = phase === "pitch_windup";
  const batsLabel =
    atBat.batter.bats === "L"
      ? "LHB"
      : atBat.batter.bats === "S"
        ? "SHB"
        : "RHB";
  const batsHint =
    atBat.batter.bats === "L"
      ? "Click = barrel sweet spot · tip points left"
      : "Click = barrel sweet spot · tip points right";

  return (
    <section className="anim-rise flex min-h-[85dvh] flex-col gap-4 py-2">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-[family-name:var(--font-display)] text-xl tracking-wide text-primary">
            Legendary At Bats
          </p>
          <p className="text-xs text-muted-foreground">
            Pitch {pitchNumber}
            {recycled ? " · recycled" : ""}
          </p>
        </div>
        <ScoreBug
          away={atBat.away}
          home={atBat.home}
          inning={atBat.inning}
          outs={atBat.outs}
          count={count}
          bases={atBat.bases}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {atBat.batter.team} #{atBat.batter.number} · {pitch.speedMph} mph
          </p>
          <Badge
            variant="outline"
            className="rounded-md border-flood/50 text-flood"
            title={batsHint}
          >
            Bats {atBat.batter.bats} · {batsLabel}
          </Badge>
        </div>
      </header>

      <div className="relative my-1">
        <PitchCanvas
          interactive={live}
          live={live}
          target={pitch.location}
          pitchType={pitch.type}
          bats={atBat.batter.bats}
          aim={aim}
          showTarget={phase === "pitch_result"}
          ballProgress={live ? Math.max(ballProgress, 0.02) : ballProgress}
          exitProgress={phase === "pitch_result" ? exitProgress : 0}
          play={lastGrade?.play ?? null}
          timingMs={lastGrade?.timingMs}
          windowMs={FLIGHT_MS}
          onAim={onAim}
          startedAt={flightStart}
        >
          {windup &&
            continueInSec != null &&
            continueInSec >= 1 && (
              <div
                className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
                aria-live="polite"
                aria-atomic="true"
              >
                <span
                  key={`${phase}-${continueInSec}`}
                  className="anim-countdown-pop font-[family-name:var(--font-display)] text-[7.5rem] leading-none tracking-wide text-primary drop-shadow-[0_0_28px_oklch(0.84_0.15_78/0.55)] sm:text-[9rem]"
                >
                  {continueInSec}
                </span>
              </div>
            )}
        </PitchCanvas>
      </div>

      <div className="mt-4 flex-1 space-y-4">
        {windup && (
          <div className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-flood">
              Get set · {batsLabel}
            </p>
            <p className="text-sm text-muted-foreground">{batsHint}</p>
          </div>
        )}

        {live && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-flood">
                {count.balls}–{count.strikes} · pitch on the way
              </p>
            </div>
            <Button
              size="lg"
              variant="secondary"
              className="h-14 w-full text-base"
              onClick={onTake}
            >
              Take
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Click the barrel sweet spot ({batsLabel}) — or Take
            </p>
          </div>
        )}

        {phase === "pitch_result" && lastGrade && (
          <div className="space-y-3 rounded-md bg-secondary/50 p-4">
            <p className="text-center text-sm italic text-foreground/90">
              “{pitch.approachCue}”
            </p>
            <p
              className={cn(
                "font-[family-name:var(--font-display)] text-2xl tracking-wide",
                lastGrade.event === "out"
                  ? "text-destructive"
                  : lastGrade.event === "hit"
                    ? "text-flood"
                    : "text-primary",
              )}
            >
              {playResultLabel(lastGrade.play)}
              <span className="text-muted-foreground">
                {" "}
                · {exitLabel(lastGrade.play)}
                {lastGrade.launchDeg != null &&
                  lastGrade.swung &&
                  lastGrade.play !== "whiff" &&
                  lastGrade.play !== "foul" &&
                  ` · ~${lastGrade.launchDeg}°`}
                {" · "}
                {pitchTypeLabel(pitch.type)}
                {" · "}
                {isInStrikeZone(pitch.location) ? "in zone" : "out of zone"}
              </span>
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                Decision:{" "}
                <span
                  className={cn(
                    lastGrade.decisionCorrect ? "text-flood" : "text-destructive",
                  )}
                >
                  {lastGrade.decision}
                  {lastGrade.decisionCorrect
                    ? " ✓"
                    : lastGrade.swung
                      ? " · chased a ball"
                      : " · strike looking"}
                </span>
              </li>
              {lastGrade.swung && lastGrade.contactQuality != null && (
                <li>
                  Contact quality {(lastGrade.contactQuality * 100).toFixed(0)}%
                  {lastGrade.exitVeloMph != null &&
                    ` · ~${lastGrade.exitVeloMph} mph`}
                  {lastGrade.aimDistance != null &&
                    ` · miss ${lastGrade.aimDistance.toFixed(2)}`}
                </li>
              )}
              <li className="text-xs">{eventLabel(lastGrade.event)}</li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function ResultScreen({
  atBat,
  session,
  copied,
  pending,
  onShare,
  onReplay,
  onCatalog,
  onHome,
}: {
  atBat: LegendaryAtBat;
  session: AtBatSessionResult;
  copied: boolean;
  pending: boolean;
  onShare: () => void;
  onReplay: () => void;
  onCatalog: () => void;
  onHome: () => void;
}) {
  const shareText = formatShareSummary({
    dateKey: session.dateKey,
    codename: atBat.codename,
    stars: session.stars,
    verdict: session.historyVerdict,
    endingTitle: session.endingTitle,
  });

  const starsBlurb =
    session.stars >= 3
      ? "Won the game"
      : session.stars === 2
        ? "Came through · pass the baton"
        : "Failed the moment";

  return (
    <section className="anim-rise flex min-h-[85dvh] flex-col gap-6 py-4">
      <ScoreBug
        away={session.board.away}
        home={session.board.home}
        inning={atBat.inning}
        outs={session.board.outs}
        count={session.board.count}
        bases={session.board.bases}
      />

      <div className="space-y-2 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-primary">
          Legendary At Bats
        </p>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {session.dateKey} · {atBat.codename}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-5xl tracking-wide text-chalk">
          {session.endingTitle}
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {session.endingBlurb}
        </p>
        <p className="text-xs text-flood">
          {playResultLabel(session.finalPlay)}
          {session.runsScored > 0 ? ` · ${session.runsScored} run(s)` : ""} · AB
          count {session.finalCount.balls}–{session.finalCount.strikes} ·{" "}
          {session.grades.length} pitch
          {session.grades.length === 1 ? "" : "es"}
        </p>
      </div>

      <div className="rounded-md bg-secondary/50 p-5 text-center">
        <p className="font-[family-name:var(--font-display)] text-5xl text-primary">
          {"★".repeat(session.stars)}
          {"☆".repeat(3 - session.stars)}
        </p>
        <p className="mt-2 text-sm font-medium text-foreground">
          {pending ? "Finalizing…" : starsBlurb}
        </p>
      </div>

      <div className="space-y-2 rounded-md border border-border/80 bg-background/40 p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-flood">
          What actually happened
        </p>
        <p className="font-medium text-foreground">
          {outcomeLabel(atBat.historical.outcome)}
          {atBat.historical.batterSucceeded
            ? " · Batter came through"
            : " · Batter failed"}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {atBat.historical.summary}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Pitch log
        </p>
        <ul className="space-y-2">
          {session.grades.map((g, i) => (
            <li
              key={g.pitchId}
              className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2 text-sm"
            >
              <span>
                P{i + 1} · {playResultLabel(g.play)}
                {g.launchDeg != null &&
                g.swung &&
                g.play !== "whiff" &&
                g.play !== "foul"
                  ? ` · ~${g.launchDeg}°`
                  : ""}
              </span>
              <span className="text-xs text-muted-foreground">
                {g.decisionCorrect ? "read ✓" : "miss"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-left text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
        {shareText}
      </pre>

      <div className="mt-auto grid gap-2">
        <Button size="lg" className="h-12" onClick={onShare}>
          {copied ? "Copied!" : "Copy share summary"}
        </Button>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button size="lg" variant="secondary" className="h-11" onClick={onReplay}>
            Replay
          </Button>
          <Button size="lg" variant="secondary" className="h-11" onClick={onCatalog}>
            All moments
          </Button>
          <Button size="lg" variant="ghost" className="h-11" onClick={onHome}>
            Home
          </Button>
        </div>
      </div>
    </section>
  );
}
