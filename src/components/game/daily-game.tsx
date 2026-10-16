"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HowToPlayOverlay } from "@/components/game/how-to-play";
import { PitchCanvas } from "@/components/game/pitch-canvas";
import { ScoreBug } from "@/components/game/score-bug";
import { LEGENDARY_AT_BATS } from "@/data/legendary-at-bats";
import { getDailyAtBat, formatShareSummary, utcDateKey } from "@/lib/daily";
import { exitLabel, flightMsForPitch } from "@/lib/flight";
import { playResultLabel } from "@/lib/contact";
import {
  MAX_PITCHES_PER_AB,
  applyPitchEvent,
  pitchAtCursor,
} from "@/lib/count";
import {
  finalizeSession,
  gradePitch,
  outcomeLabel,
  pitchTypeLabel,
} from "@/lib/scoring";
import {
  advanceInning,
  atBatFromInning,
  createInning,
  inningSummary,
  isInningOver,
  type InningState,
} from "@/lib/inning";
import type {
  AtBatEndReason,
  AtBatSessionResult,
  CountState,
  GamePhase,
  LegendaryAtBat,
  PitchEvent,
  PitchResultGrade,
  ZoneCoord,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type PlayMode = "daily" | "practice" | "inning";

/** Strike = red, ball = green, ball-in-play = blue */
function pitchSequenceColor(event: PitchEvent): string {
  switch (event) {
    case "ball":
      return "text-emerald-400";
    case "hit":
    case "out":
      return "text-sky-400";
    case "strike":
    case "foul":
    default:
      return "text-red-400";
  }
}

const EXIT_MS = 1200;
/** After the pitch arrives, brief beat then auto-take if no swing. */
const LATE_TAKE_GRACE_MS = 450;
/** Auto-advance between pitches (3–2–1 grow/fade; not on AB end). */
const BETWEEN_PITCH_MS = 3000;

export function DailyGame() {
  const [phase, setPhase] = useState<GamePhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [atBat, setAtBat] = useState<LegendaryAtBat | null>(null);
  const [dateKey, setDateKey] = useState("");
  const [playMode, setPlayMode] = useState<PlayMode>("daily");
  const isDaily = playMode === "daily";
  const isInning = playMode === "inning";
  const [inningSnap, setInningSnap] = useState<InningState | null>(null);
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
  const flightMsRef = useRef(1020);
  const rafRef = useRef<number | null>(null);
  const decidedRef = useRef(false);
  const gradesRef = useRef<PitchResultGrade[]>([]);
  const countRef = useRef<CountState>({ balls: 0, strikes: 0 });
  const cursorRef = useRef(0);
  const pendingEndRef = useRef<AtBatEndReason | null>(null);
  const continueTimerRef = useRef<number | null>(null);
  const postResultDelayRef = useRef<number | null>(null);
  /** Auto-show How to Play only on the first at-bat of this session. */
  const howToSeenRef = useRef(false);
  /** Live inning state while playMode === "inning". */
  const inningRef = useRef<InningState | null>(null);

  const currentPitch =
    atBat && atBat.pitches.length > 0
      ? pitchAtCursor(atBat.pitches, pitchCursor)
      : null;
  const extended =
    !!atBat && pitchCursor >= atBat.pitches.length && atBat.pitches.length > 0;

  useEffect(() => {
    try {
      const pick = getDailyAtBat(new Date());
      setAtBat(pick.atBat);
      setDateKey(pick.dateKey);
      setPlayMode("daily");
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
    const windowMs = flightMsRef.current;
    const tick = (now: number) => {
      const p = Math.min(1, (now - flightStart.current) / windowMs);
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

  function selectAtBat(
    next: LegendaryAtBat,
    mode: PlayMode,
    opts?: { skipSituation?: boolean },
  ) {
    cancelFlight();
    resetBattleState();
    setAtBat(next);
    setPlayMode(mode);
    setDateKey(mode === "daily" ? utcDateKey(new Date()) : next.codename);
    setPhase(opts?.skipSituation ? "pitch_windup" : "situation");
    if (!howToSeenRef.current) {
      howToSeenRef.current = true;
      setHowToOpen(true);
    }
  }

  /** Fresh half-inning from 0 outs / empty bases. */
  function startInning() {
    const state = createInning();
    inningRef.current = state;
    setInningSnap(state);
    selectAtBat(atBatFromInning(state), "inning");
  }

  /** Next batter in the same half, or a new inning if three outs. */
  function continueInning() {
    const state = inningRef.current;
    if (!state || isInningOver(state)) {
      startInning();
      return;
    }
    selectAtBat(atBatFromInning(state), "inning", { skipSituation: true });
  }

  function beginPitch() {
    cancelContinueTimer();
    decidedRef.current = false;
    setAim(undefined);
    setLastGrade(null);
    setBallProgress(0);
    setExitProgress(0);
    pendingEndRef.current = null;
    const pitch = atBat
      ? pitchAtCursor(atBat.pitches, cursorRef.current)
      : null;
    flightMsRef.current = pitch ? flightMsForPitch(pitch.type) : 1020;
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
      windowMs: flightMsRef.current,
      bases: atBat.bases,
      outs: atBat.outs,
      countBefore: countRef.current,
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
      windowMs: flightMsRef.current,
      bases: atBat.bases,
      outs: atBat.outs,
      countBefore: countRef.current,
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
      if (inningRef.current) {
        const next = advanceInning(inningRef.current, final);
        inningRef.current = next;
        setInningSnap(next);
      }
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
      isDaily,
    });
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      setError("Could not copy share text.");
    }
  }

  function goHome() {
    cancelFlight();
    resetBattleState();
    inningRef.current = null;
    setInningSnap(null);
    try {
      const pick = getDailyAtBat(new Date());
      setAtBat(pick.atBat);
      setDateKey(pick.dateKey);
      setPlayMode("daily");
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
            onPlayDaily={() => selectAtBat(atBat, "daily")}
            onOpenCatalog={() => setPhase("catalog")}
            onInning={startInning}
          />
        )}
        {phase === "catalog" && (
          <CatalogScreen
            dailyId={getDailyAtBat(new Date()).atBat.id}
            onPick={(ab) =>
              selectAtBat(
                ab,
                ab.id === getDailyAtBat(new Date()).atBat.id
                  ? "daily"
                  : "practice",
              )
            }
            onBack={() => setPhase("intro")}
          />
        )}
        {phase === "situation" && atBat && (
          <SituationScreen
            atBat={atBat}
            dateKey={dateKey}
            count={count}
            playMode={playMode}
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
              extended={extended}
              phase={phase}
              count={count}
              lastGrade={lastGrade}
              aim={aim}
              ballProgress={ballProgress}
              exitProgress={exitProgress}
              flightStart={flightStart.current}
              continueInSec={continueInSec}
              onAim={onAim}
            />
          )}
        {phase === "result" && atBat && session && (
          <ResultScreen
            atBat={atBat}
            session={session}
            copied={copied}
            pending={pending}
            isInning={isInning}
            inningOver={isInning && !!inningSnap && isInningOver(inningSnap)}
            inningLine={
              isInning && inningSnap ? inningSummary(inningSnap) : null
            }
            onShare={shareResult}
            onReplay={() =>
              isInning ? startInning() : selectAtBat(atBat, playMode)
            }
            onContinueInning={isInning ? continueInning : undefined}
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
  onInning,
  catalogSize,
}: {
  dateKey: string;
  daily: LegendaryAtBat;
  onPlayDaily: () => void;
  onOpenCatalog: () => void;
  onInning: () => void;
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
        <p className="mx-auto max-w-sm text-sm text-muted-foreground sm:text-base">
          Step into legendary moments. Swing or take — work the count.
        </p>
        <p className="text-sm text-foreground">
          Today · {daily.codename}
        </p>
      </div>

      <div className="anim-rise-delay space-y-3">
        <Button
          size="lg"
          className="h-12 w-full text-base font-semibold tracking-wide"
          onClick={onPlayDaily}
        >
          Today’s at-bat
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="h-12 w-full text-base"
          onClick={onOpenCatalog}
        >
          Legendary at-bats
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {catalogSize}
          </span>
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="h-12 w-full text-base"
          onClick={onInning}
        >
          Play an inning
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
          Legendary at-bats
        </p>
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>
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
                    {ab.year} · {ab.series} · {ab.inning}
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
  playMode,
  onStart,
  onBack,
  onHowTo,
}: {
  atBat: LegendaryAtBat;
  dateKey: string;
  count: CountState;
  playMode: PlayMode;
  onStart: () => void;
  onBack: () => void;
  onHowTo: () => void;
}) {
  const modeBadge =
    playMode === "daily"
      ? dateKey
      : playMode === "inning"
        ? "Inning"
        : "Practice";

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
              {modeBadge}
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
            {atBat.year} · {atBat.series} · {atBat.venue}
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-4xl tracking-wide text-chalk sm:text-5xl">
            {atBat.codename}
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-foreground/90">
          {atBat.situationBlurb}
        </p>
        <p className="text-sm text-muted-foreground">
          {atBat.batter.team} #{atBat.batter.number} ({atBat.batter.bats}) vs{" "}
          {atBat.pitcher.team} #{atBat.pitcher.number} · {atBat.runners}
        </p>
      </div>
      <div className="grid gap-2">
        <Button size="lg" className="h-12 w-full font-semibold" onClick={onStart}>
          Step in
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </section>
  );
}

function PitchScreen({
  atBat,
  pitch,
  pitchNumber,
  extended,
  phase,
  count,
  lastGrade,
  aim,
  ballProgress,
  exitProgress,
  flightStart,
  continueInSec,
  onAim,
}: {
  atBat: LegendaryAtBat;
  pitch: LegendaryAtBat["pitches"][number];
  pitchNumber: number;
  extended: boolean;
  phase: GamePhase;
  count: CountState;
  lastGrade: PitchResultGrade | null;
  aim?: ZoneCoord;
  ballProgress: number;
  exitProgress: number;
  flightStart: number;
  continueInSec: number | null;
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
            {extended ? " · arsenal" : ""}
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
            {atBat.batter.team} #{atBat.batter.number}
          </p>
          <Badge
            variant="outline"
            className="rounded-md border-flood/50 text-flood"
            title={batsHint}
          >
            {batsLabel}
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
          exitKind={lastGrade?.exitKind ?? null}
          timingMs={lastGrade?.timingMs}
          windowMs={flightMsForPitch(pitch.type)}
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
          <p className="text-center text-xs uppercase tracking-[0.25em] text-flood">
            Get set
          </p>
        )}

        {live && (
          <p className="text-center text-xs uppercase tracking-[0.25em] text-flood">
            {count.balls}–{count.strikes}
          </p>
        )}

        {phase === "pitch_result" && lastGrade && (
          <div className="rounded-md bg-secondary/50 p-4 text-center">
            <p
              className={cn(
                "font-[family-name:var(--font-display)] text-3xl tracking-wide",
                lastGrade.event === "out"
                  ? "text-destructive"
                  : lastGrade.event === "hit"
                    ? "text-flood"
                    : "text-primary",
              )}
            >
              {playResultLabel(lastGrade.play)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {exitLabel(lastGrade.play)}
              {" · "}
              {pitchTypeLabel(pitch.type)}
            </p>
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
  isInning,
  inningOver,
  inningLine,
  onShare,
  onReplay,
  onContinueInning,
  onCatalog,
  onHome,
}: {
  atBat: LegendaryAtBat;
  session: AtBatSessionResult;
  copied: boolean;
  pending: boolean;
  isInning: boolean;
  inningOver: boolean;
  inningLine: string | null;
  onShare: () => void;
  onReplay: () => void;
  onContinueInning?: () => void;
  onCatalog: () => void;
  onHome: () => void;
}) {
  const starsBlurb = isInning
    ? inningOver
      ? (inningLine ?? "Inning over")
      : "Keep the line moving"
    : session.stars >= 3
      ? "Won the game"
      : session.stars === 2
        ? "Do your job"
        : "Failed the moment";

  return (
    <section className="anim-rise flex min-h-[85dvh] flex-col gap-6 py-4">
      <ScoreBug
        away={session.board.away}
        home={session.board.home}
        inning={atBat.inning}
        outs={Math.min(3, session.board.outs)}
        count={session.board.count}
        bases={session.board.bases}
      />

      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {atBat.codename}
          {isInning && atBat.gameLabel ? ` · ${atBat.gameLabel}` : ""}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-5xl tracking-wide text-chalk">
          {isInning && inningOver ? "Inning over" : session.endingTitle}
        </h2>
        <p className="text-sm text-flood">
          {playResultLabel(session.finalPlay)}
          {session.runsScored > 0 ? ` · ${session.runsScored} R` : ""}
        </p>
        {isInning && inningLine && (
          <p className="text-xs text-muted-foreground">{inningLine}</p>
        )}
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

      {!isInning && (
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
      )}

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Pitch sequence
        </p>
        <ul className="space-y-1.5">
          {session.grades.map((g, i) => (
            <li
              key={g.pitchId}
              className={cn(
                "flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2 text-sm font-medium",
                pitchSequenceColor(g.event),
              )}
            >
              <span>
                P{i + 1} · {pitchTypeLabel(g.pitchType)} · {g.speedMph} mph
              </span>
              <span className="text-xs tabular-nums opacity-90">
                {g.countBefore.balls}–{g.countBefore.strikes}
                <span className="mx-1.5 opacity-50">·</span>
                {playResultLabel(g.play)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto grid gap-2">
        {isInning && onContinueInning ? (
          <Button size="lg" className="h-12" onClick={onContinueInning}>
            {inningOver ? "New inning" : "Next batter"}
          </Button>
        ) : (
          <Button size="lg" className="h-12" onClick={onShare}>
            {copied ? "Copied!" : "Copy result"}
          </Button>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          {!isInning && (
            <Button size="lg" variant="secondary" className="h-11" onClick={onReplay}>
              Replay
            </Button>
          )}
          {isInning && (
            <Button size="lg" variant="secondary" className="h-11" onClick={onShare}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          )}
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
