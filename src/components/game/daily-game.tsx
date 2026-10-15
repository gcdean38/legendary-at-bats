"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StrikeZone } from "@/components/game/strike-zone";
import { LEGENDARY_AT_BATS } from "@/data/legendary-at-bats";
import { getDailyAtBat, formatShareSummary } from "@/lib/daily";
import {
  finalizeSession,
  gradePitch,
  outcomeLabel,
  PITCH_TYPES,
  verdictCopy,
} from "@/lib/scoring";
import type {
  AtBatSessionResult,
  GamePhase,
  PitchDecision,
  PitchResultGrade,
  PitchType,
  ZoneCoord,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const FLIGHT_MS = 1100;

type DailyPick = ReturnType<typeof getDailyAtBat>;

export function DailyGame() {
  const [phase, setPhase] = useState<GamePhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [daily, setDaily] = useState<DailyPick | null>(null);
  const [pitchIndex, setPitchIndex] = useState(0);
  const [recognized, setRecognized] = useState<PitchType | null>(null);
  const [grades, setGrades] = useState<PitchResultGrade[]>([]);
  const [lastGrade, setLastGrade] = useState<PitchResultGrade | null>(null);
  const [session, setSession] = useState<AtBatSessionResult | null>(null);
  const [aim, setAim] = useState<ZoneCoord | undefined>();
  const [ballProgress, setBallProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const flightStart = useRef(0);
  const rafRef = useRef<number | null>(null);

  const atBat = daily?.atBat ?? null;
  const dateKey = daily?.dateKey ?? "";
  const currentPitch = atBat?.pitches[pitchIndex];

  useEffect(() => {
    try {
      const pick = getDailyAtBat(new Date());
      setDaily(pick);
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
    };
  }, []);

  function startFlightLoop() {
    flightStart.current = performance.now();
    setBallProgress(0);
    const tick = (now: number) => {
      const p = Math.min(1, (now - flightStart.current) / FLIGHT_MS);
      setBallProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function beginPitch() {
    setRecognized(null);
    setAim(undefined);
    setLastGrade(null);
    setBallProgress(0);
    setPhase("pitch_cue");
  }

  function goRecognize() {
    setPhase("pitch_recognize");
  }

  function pickType(type: PitchType) {
    setRecognized(type);
    setPhase("pitch_decide");
  }

  function decide(decision: PitchDecision) {
    if (!currentPitch) return;
    if (decision === "take") {
      const grade = gradePitch({
        pitch: currentPitch,
        recognizedType: recognized,
        decision,
        windowMs: FLIGHT_MS,
      });
      commitPitchGrade(grade);
      return;
    }
    setPhase("pitch_aim");
    startFlightLoop();
  }

  function onAim(coord: ZoneCoord, timingMs: number) {
    if (!currentPitch || phase !== "pitch_aim") return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const grade = gradePitch({
      pitch: currentPitch,
      recognizedType: recognized,
      decision: "swing",
      aim: coord,
      timingMs,
      windowMs: FLIGHT_MS,
    });
    setAim(coord);
    commitPitchGrade(grade);
  }

  function commitPitchGrade(grade: PitchResultGrade) {
    setLastGrade(grade);
    const nextGrades = [...grades, grade];
    setGrades(nextGrades);
    setPhase("pitch_feedback");
  }

  function advanceAfterFeedback() {
    if (!atBat) return;
    if (pitchIndex + 1 < atBat.pitches.length) {
      setPitchIndex((i) => i + 1);
      beginPitch();
      return;
    }
    startTransition(() => {
      const final = finalizeSession({ atBat, dateKey, grades });
      setSession(final);
      setPhase("result");
    });
  }

  async function shareResult() {
    if (!session || !atBat) return;
    const text = formatShareSummary({
      dateKey: session.dateKey,
      codename: atBat.codename,
      score: session.totalScore,
      maxScore: session.maxScore,
      stars: session.stars,
      verdict: session.historyVerdict,
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

  function resetDay() {
    setPitchIndex(0);
    setRecognized(null);
    setGrades([]);
    setLastGrade(null);
    setSession(null);
    setAim(undefined);
    setBallProgress(0);
    setCopied(false);
    setError(null);
    setPhase("intro");
  }

  const progressPct = atBat
    ? Math.round(
        ((phase === "result" ? atBat.pitches.length : pitchIndex) /
          atBat.pitches.length) *
          100,
      )
    : 0;

  return (
    <div className="stadium-bg relative min-h-dvh overflow-hidden">
      <div className="stadium-grain absolute inset-0 opacity-40" aria-hidden />
      <div
        className="anim-flood pointer-events-none absolute -top-24 left-1/2 h-64 w-[120%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,oklch(0.84_0.15_78/0.28),transparent_65%)]"
        aria-hidden
      />

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
        {phase === "loading" && <LoadingState />}
        {phase === "error" && (
          <ErrorState message={error ?? "Something went wrong."} onRetry={resetDay} />
        )}
        {phase === "intro" && atBat && (
          <IntroScreen
            dateKey={dateKey}
            onPlay={() => setPhase("situation")}
            catalogSize={LEGENDARY_AT_BATS.length}
          />
        )}
        {phase === "situation" && atBat && (
          <SituationScreen
            atBat={atBat}
            dateKey={dateKey}
            onStart={() => beginPitch()}
          />
        )}
        {atBat &&
          currentPitch &&
          (phase === "pitch_cue" ||
            phase === "pitch_recognize" ||
            phase === "pitch_decide" ||
            phase === "pitch_aim" ||
            phase === "pitch_feedback") && (
            <PitchScreen
              atBat={atBat}
              pitch={currentPitch}
              pitchIndex={pitchIndex}
              totalPitches={atBat.pitches.length}
              phase={phase}
              recognized={recognized}
              lastGrade={lastGrade}
              aim={aim}
              ballProgress={ballProgress}
              progressPct={progressPct}
              flightStart={flightStart.current}
              onCueDone={goRecognize}
              onPickType={pickType}
              onDecide={decide}
              onAim={onAim}
              onContinue={advanceAfterFeedback}
            />
          )}
        {phase === "result" && atBat && session && (
          <ResultScreen
            atBat={atBat}
            session={session}
            copied={copied}
            pending={pending}
            onShare={shareResult}
            onReplay={resetDay}
          />
        )}
        {!atBat && phase !== "loading" && phase !== "error" && (
          <EmptyState onRetry={resetDay} />
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
      <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 animate-pulse bg-primary" />
      </div>
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
      <p className="font-[family-name:var(--font-display)] text-3xl">No at-bat today</p>
      <p className="text-sm text-muted-foreground">
        The daily catalog didn’t load. Check back shortly.
      </p>
      <Button variant="secondary" onClick={onRetry}>
        Reload
      </Button>
    </div>
  );
}

function IntroScreen({
  dateKey,
  onPlay,
  catalogSize,
}: {
  dateKey: string;
  onPlay: () => void;
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
          Step into clutch October moments. Read the pitch, decide take or swing,
          aim the zone — then see if you matched the legend or changed history.
        </p>
      </div>

      <div className="anim-rise-delay space-y-4">
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="rounded-md">
            Pitch recognition
          </Badge>
          <Badge variant="secondary" className="rounded-md">
            Take / swing
          </Badge>
          <Badge variant="secondary" className="rounded-md">
            Zone aim
          </Badge>
        </div>
        <Button
          size="lg"
          className="h-12 w-full text-base font-semibold tracking-wide"
          onClick={onPlay}
        >
          Play today’s at-bat
        </Button>
        <p className="text-center text-[11px] text-muted-foreground/80">
          {catalogSize}+ curated moments · team + jersey # only · no real names
        </p>
      </div>
    </section>
  );
}

function SituationScreen({
  atBat,
  dateKey,
  onStart,
}: {
  atBat: NonNullable<ReturnType<typeof getDailyAtBat>["atBat"]>;
  dateKey: string;
  onStart: () => void;
}) {
  return (
    <section className="anim-rise flex min-h-[85dvh] flex-col justify-between gap-8 py-4">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-primary">
            Legendary At Bats
          </p>
          <Badge variant="outline" className="rounded-md border-flood/40 text-flood">
            {dateKey}
          </Badge>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            {atBat.year} · {atBat.series} · {atBat.gameLabel}
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-4xl tracking-wide text-chalk sm:text-5xl">
            {atBat.codename}
          </h2>
        </div>
        <p className="text-base leading-relaxed text-foreground/90">
          {atBat.situationBlurb}
        </p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Inning" value={atBat.inning} />
          <Stat label="Outs" value={String(atBat.outs)} />
          <Stat label="Score" value={atBat.scoreText} />
          <Stat label="Runners" value={atBat.runners} />
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
      <Button size="lg" className="h-12 w-full font-semibold" onClick={onStart}>
        Step in · Pitch 1 of {atBat.pitches.length}
      </Button>
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
  pitchIndex,
  totalPitches,
  phase,
  recognized,
  lastGrade,
  aim,
  ballProgress,
  progressPct,
  flightStart,
  onCueDone,
  onPickType,
  onDecide,
  onAim,
  onContinue,
}: {
  atBat: NonNullable<ReturnType<typeof getDailyAtBat>["atBat"]>;
  pitch: NonNullable<
    ReturnType<typeof getDailyAtBat>["atBat"]["pitches"][number]
  >;
  pitchIndex: number;
  totalPitches: number;
  phase: GamePhase;
  recognized: PitchType | null;
  lastGrade: PitchResultGrade | null;
  aim?: ZoneCoord;
  ballProgress: number;
  progressPct: number;
  flightStart: number;
  onCueDone: () => void;
  onPickType: (t: PitchType) => void;
  onDecide: (d: PitchDecision) => void;
  onAim: (c: ZoneCoord, ms: number) => void;
  onContinue: () => void;
}) {
  useEffect(() => {
    if (phase !== "pitch_cue") return;
    const t = window.setTimeout(onCueDone, 1600);
    return () => window.clearTimeout(t);
  }, [phase, onCueDone, pitch.id]);

  return (
    <section className="anim-rise flex min-h-[85dvh] flex-col gap-5 py-2">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-[family-name:var(--font-display)] text-xl tracking-wide text-primary">
            Legendary At Bats
          </p>
          <p className="text-xs text-muted-foreground">
            Pitch {pitchIndex + 1}/{totalPitches}
          </p>
        </div>
        <Progress value={progressPct} className="h-1.5" />
        <p className="text-sm text-muted-foreground">
          {atBat.batter.team} #{atBat.batter.number} · {pitch.speedMph} mph cue
        </p>
      </header>

      <StrikeZone
        interactive={phase === "pitch_aim"}
        live={phase === "pitch_aim" || phase === "pitch_cue"}
        target={pitch.location}
        aim={aim}
        showTarget={phase === "pitch_feedback"}
        ballProgress={
          phase === "pitch_aim" || phase === "pitch_cue" ? ballProgress || 0.15 : 0
        }
        onAim={onAim}
        startedAt={flightStart}
        className="my-2"
      />

      <div className="mt-4 flex-1 space-y-4">
        {phase === "pitch_cue" && (
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-flood">
              Pitch on the way
            </p>
            <p className="mt-2 text-sm text-foreground/90">{pitch.approachCue}</p>
          </div>
        )}

        {phase === "pitch_recognize" && (
          <div className="space-y-3">
            <p className="text-center text-sm font-medium">What pitch is this?</p>
            <div className="grid grid-cols-3 gap-2">
              {PITCH_TYPES.map((t) => (
                <Button
                  key={t.id}
                  variant="secondary"
                  className="h-11"
                  onClick={() => onPickType(t.id)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {phase === "pitch_decide" && (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              You called{" "}
              <span className="font-semibold text-foreground">
                {PITCH_TYPES.find((t) => t.id === recognized)?.label}
              </span>
              . Take or swing?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                variant="secondary"
                className="h-14 text-base"
                onClick={() => onDecide("take")}
              >
                Take
              </Button>
              <Button
                size="lg"
                className="h-14 text-base"
                onClick={() => onDecide("swing")}
              >
                Swing
              </Button>
            </div>
          </div>
        )}

        {phase === "pitch_aim" && (
          <p className="text-center text-sm text-flood">
            Swing! Click the zone as the pitch arrives.
          </p>
        )}

        {phase === "pitch_feedback" && lastGrade && (
          <div className="space-y-3 rounded-md bg-secondary/50 p-4">
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-primary">
              +{lastGrade.pitchScore} pts
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                Recognition:{" "}
                <span
                  className={cn(
                    lastGrade.typeCorrect ? "text-flood" : "text-destructive",
                  )}
                >
                  {lastGrade.typeCorrect ? "Correct" : "Miss"}
                </span>{" "}
                · actual {pitch.type}
              </li>
              <li>
                Decision:{" "}
                <span
                  className={cn(
                    lastGrade.decisionCorrect ? "text-flood" : "text-destructive",
                  )}
                >
                  {lastGrade.decision}{" "}
                  {lastGrade.decisionCorrect ? "✓" : `(wanted ${pitch.expectedDecision})`}
                </span>
              </li>
              {lastGrade.swung && (
                <li>
                  Aim / timing: {lastGrade.timingScore} timing pts
                  {lastGrade.aimDistance != null &&
                    ` · miss ${lastGrade.aimDistance.toFixed(2)}`}
                </li>
              )}
            </ul>
            <Button className="w-full" onClick={onContinue}>
              {pitchIndex + 1 < totalPitches ? "Next pitch" : "See the result"}
            </Button>
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
}: {
  atBat: NonNullable<ReturnType<typeof getDailyAtBat>["atBat"]>;
  session: AtBatSessionResult;
  copied: boolean;
  pending: boolean;
  onShare: () => void;
  onReplay: () => void;
}) {
  const copy = verdictCopy(session.historyVerdict);
  const shareText = formatShareSummary({
    dateKey: session.dateKey,
    codename: atBat.codename,
    score: session.totalScore,
    maxScore: session.maxScore,
    stars: session.stars,
    verdict: session.historyVerdict,
  });

  return (
    <section className="anim-rise flex min-h-[85dvh] flex-col gap-6 py-4">
      <div className="space-y-2 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-primary">
          Legendary At Bats
        </p>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {session.dateKey} · {atBat.codename}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-5xl tracking-wide text-chalk">
          {copy.title}
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{copy.blurb}</p>
      </div>

      <div className="rounded-md bg-secondary/50 p-5 text-center">
        <p className="font-[family-name:var(--font-display)] text-4xl text-primary">
          {"★".repeat(session.stars)}
          {"☆".repeat(3 - session.stars)}
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {session.totalScore}
          <span className="text-base text-muted-foreground">
            /{session.maxScore}
          </span>
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {pending ? "Finalizing…" : "Daily score"}
        </p>
      </div>

      <div className="space-y-2 rounded-md border border-border/80 bg-background/40 p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-flood">
          What actually happened
        </p>
        <p className="font-medium text-foreground">
          {outcomeLabel(atBat.historical.outcome)}
          {atBat.historical.batterSucceeded ? " · Batter came through" : " · Batter failed"}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {atBat.historical.summary}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Pitch grades
        </p>
        <ul className="space-y-2">
          {session.grades.map((g, i) => (
            <li
              key={g.pitchId}
              className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2 text-sm"
            >
              <span>Pitch {i + 1}</span>
              <span className="tabular-nums text-primary">+{g.pitchScore}</span>
            </li>
          ))}
        </ul>
      </div>

      <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-left text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
        {shareText}
      </pre>

      <div className="mt-auto grid gap-2 sm:grid-cols-2">
        <Button size="lg" className="h-12" onClick={onShare}>
          {copied ? "Copied!" : "Copy share summary"}
        </Button>
        <Button size="lg" variant="secondary" className="h-12" onClick={onReplay}>
          Replay today’s AB
        </Button>
      </div>
    </section>
  );
}
