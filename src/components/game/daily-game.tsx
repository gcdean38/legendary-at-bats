"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HowToPlayOverlay } from "@/components/game/how-to-play";
import { PitchCanvas } from "@/components/game/pitch-canvas";
import { ScoreBug } from "@/components/game/score-bug";
import { LEGENDARY_AT_BATS } from "@/data/legendary-at-bats";
import {
  getDailyAtBat,
  formatShareSummary,
  easternDateKey,
} from "@/lib/daily";
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
  dealNextAtBat,
  createInning,
  createRewriteInning,
  inningSummary,
  isBot9TiedForExtras,
  isInningOver,
  isWalkOff,
  shouldOfferRewriteContinue,
  type AbLogEntry,
  type Bot9Difficulty,
  type InningState,
} from "@/lib/inning";
import {
  battingSideAbbr,
  pitchingSideAbbr,
  playerIdentity,
  runnersLabel,
} from "@/lib/situation";
import { trackEvent } from "@/lib/analytics";
import type {
  AtBatEndReason,
  AtBatSessionResult,
  CountState,
  GamePhase,
  LegendaryAtBat,
  PitchEvent,
  PitchResultGrade,
  PlayResult,
  SeedPitch,
  ZoneCoord,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type PlayMode = "daily" | "practice" | "inning";

/** Count / take / foul / K — no ball-in-play flight (stay on the plate UI). */
function isNonBipPlay(play: PlayResult): boolean {
  switch (play) {
    case "foul":
    case "ball":
    case "strike_looking":
    case "whiff":
    case "walk":
    case "strikeout":
      return true;
    default:
      return false;
  }
}

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
/** After BIP exit flight finishes, hold so the outcome label can land. */
const BIP_REVEAL_HOLD_MS = 1100;
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
  const [inningPop, setInningPop] = useState<{
    line: string;
    sub: string;
    runners: string;
    outs: number;
    scoreLine: string;
  } | null>(null);
  const [pitchCursor, setPitchCursor] = useState(0);
  /** Locked pitch for this plate appearance — never re-roll on re-render. */
  const [livePitch, setLivePitch] = useState<SeedPitch | null>(null);
  const livePitchRef = useRef<SeedPitch | null>(null);
  const [count, setCount] = useState<CountState>({ balls: 0, strikes: 0 });
  const [grades, setGrades] = useState<PitchResultGrade[]>([]);
  const [lastGrade, setLastGrade] = useState<PitchResultGrade | null>(null);
  const [session, setSession] = useState<AtBatSessionResult | null>(null);
  const [aim, setAim] = useState<ZoneCoord | undefined>();
  const [ballProgress, setBallProgress] = useState(0);
  const [exitProgress, setExitProgress] = useState(0);
  /** Brief button flash after share/copy (“Shared!” / “Copied!”). */
  const [shareFlash, setShareFlash] = useState<string | null>(null);
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
  const inningPopTimerRef = useRef<number | null>(null);

  const currentPitch = livePitch;
  const extended =
    !!atBat &&
    playMode !== "inning" &&
    pitchCursor >= atBat.pitches.length &&
    atBat.pitches.length > 0;

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
      if (inningPopTimerRef.current) window.clearTimeout(inningPopTimerRef.current);
    };
  }, []);

  function clearInningPopTimer() {
    if (inningPopTimerRef.current) {
      window.clearTimeout(inningPopTimerRef.current);
      inningPopTimerRef.current = null;
    }
  }

  /** Pick once per cursor index — pitchAtCursor uses RNG after the script. */
  function lockPitchForCursor(ab: LegendaryAtBat, cursor: number) {
    const pitch = pitchAtCursor(ab.pitches, cursor);
    livePitchRef.current = pitch;
    setLivePitch(pitch);
    flightMsRef.current = flightMsForPitch(pitch.type);
    return pitch;
  }

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
    setShareFlash(null);
    livePitchRef.current = null;
    setLivePitch(null);
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
    setDateKey(mode === "daily" ? easternDateKey(new Date()) : next.codename);
    lockPitchForCursor(next, 0);
    setPhase(opts?.skipSituation ? "pitch_windup" : "situation");
    if (!howToSeenRef.current) {
      howToSeenRef.current = true;
      setHowToOpen(true);
    }
    trackEvent("at_bat_start", {
      mode,
      moment_id: next.id,
      year: next.year,
      series: next.series,
      matchup: next.codename,
    });
  }

  /** Fresh bottom of the 9th — easy/medium/hard deficit, empty bases. */
  function startInning(difficulty: Bot9Difficulty = "medium") {
    clearInningPopTimer();
    setInningPop(null);
    const dealt = dealNextAtBat(createInning(difficulty));
    inningRef.current = dealt.state;
    setInningSnap(dealt.state);
    selectAtBat(dealt.atBat, "inning");
  }

  /** Next batter in an active Bottom 9 / rewrite rally. */
  function continueInning() {
    const state = inningRef.current;
    if (!state || isInningOver(state)) return;
    const dealt = dealNextAtBat(state);
    inningRef.current = dealt.state;
    setInningSnap(dealt.state);
    selectAtBat(dealt.atBat, "inning", { skipSituation: true });
  }

  function beginPitch() {
    cancelContinueTimer();
    decidedRef.current = false;
    setAim(undefined);
    setLastGrade(null);
    setBallProgress(0);
    setExitProgress(0);
    pendingEndRef.current = null;
    // Prefer the ref — setInterval windup can close over a stale livePitch.
    let pitch = livePitchRef.current;
    if (!pitch && atBat) {
      pitch = lockPitchForCursor(atBat, cursorRef.current);
    } else if (pitch) {
      flightMsRef.current = flightMsForPitch(pitch.type);
    }
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
    if (atBat) {
      lockPitchForCursor(atBat, cursorRef.current);
    }
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
      const bip = !isNonBipPlay(grade.play);
      startExitLoop(() => {
        if (bip) {
          // Keep them in suspense through the flight; reveal, then hold.
          postResultDelayRef.current = window.setTimeout(() => {
            postResultDelayRef.current = null;
            advanceAfterFeedback();
          }, BIP_REVEAL_HOLD_MS);
        } else {
          advanceAfterFeedback();
        }
      });
    } else {
      setExitProgress(0);
      postResultDelayRef.current = window.setTimeout(() => {
        postResultDelayRef.current = null;
        advanceAfterFeedback();
      }, 600);
    }
  }

  function onTake() {
    const pitch = livePitchRef.current;
    if (!pitch || !atBat || phase !== "pitch_live") return;
    const grade = gradePitch({
      pitch,
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
    const pitch = livePitchRef.current;
    if (!pitch || !atBat || phase !== "pitch_live") return;
    const grade = gradePitch({
      pitch,
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
      setSession(final);
      trackEvent("at_bat_complete", {
        mode: playMode,
        moment_id: atBat.id,
        year: atBat.year,
        series: atBat.series,
        matchup: atBat.codename,
        stars: final.stars,
        final_play: final.finalPlay,
        verdict: final.historyVerdict,
        end_reason: reason,
      });

      if (inningRef.current) {
        const next = advanceInning(
          inningRef.current,
          final,
          atBat.batter,
        );
        inningRef.current = next;
        setInningSnap(next);

        const line = `${playResultLabel(final.finalPlay)}${
          final.runsScored > 0 ? ` · ${final.runsScored} R` : ""
        }`;

        // Mid-inning: situation recap + Continue (no auto-advance)
        if (!isInningOver(next)) {
          clearInningPopTimer();
          const deficit = next.battingHome
            ? Math.max(0, next.away.runs - next.home.runs)
            : Math.max(0, next.home.runs - next.away.runs);
          setInningPop({
            line,
            sub: final.endingTitle,
            runners: runnersLabel(next.bases),
            outs: next.outs,
            scoreLine:
              deficit === 0
                ? `${next.away.abbr} ${next.away.runs}–${next.home.abbr} ${next.home.runs} · tied`
                : `${next.away.abbr} ${next.away.runs}–${next.home.abbr} ${next.home.runs} · down ${deficit}`,
          });
          return;
        }

        setInningPop(null);
        setPhase("result");
        return;
      }

      // Deep-hole legendary: offer to keep rewriting history
      if (shouldOfferRewriteContinue(atBat, final)) {
        setInningPop(null);
        setPhase("rewrite_offer");
        return;
      }

      setInningPop(null);
      setPhase("result");
    });
  }

  function acceptRewriteContinue() {
    if (!atBat || !session) return;
    const dealt = dealNextAtBat(createRewriteInning(atBat, session));
    inningRef.current = dealt.state;
    setInningSnap(dealt.state);
    selectAtBat(dealt.atBat, "inning", { skipSituation: true });
  }

  function declineRewriteContinue() {
    setPhase("result");
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
    // beginPitchWindup locks the next pitch once (RNG-safe)
    beginPitchWindup();
  }

  function flashShare(label: string) {
    setShareFlash(label);
    window.setTimeout(() => setShareFlash(null), 2000);
  }

  async function shareResult() {
    if (!session || !atBat) return;
    const text = formatShareSummary({
      dateKey: session.dateKey,
      codename: atBat.codename,
      year: atBat.year,
      series: atBat.series,
      gameLabel: atBat.gameLabel,
      stars: session.stars,
      finalPlay: session.finalPlay,
      isDaily,
    });
    // Text only — no title/url fields. Title duplicates the first line of
    // the summary; a separate url makes many targets drop the body.
    const payload: ShareData = { text };
    try {
      if (typeof navigator.share === "function") {
        const canShare =
          typeof navigator.canShare !== "function" || navigator.canShare(payload);
        if (canShare) {
          await navigator.share(payload);
          trackEvent("share_result", {
            method: "share_sheet",
            mode: playMode,
            moment_id: atBat.id,
            stars: session.stars,
            final_play: session.finalPlay,
          });
          flashShare("Shared!");
          return;
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        trackEvent("share_result", {
          method: "clipboard",
          mode: playMode,
          moment_id: atBat.id,
          stars: session.stars,
          final_play: session.finalPlay,
        });
        flashShare("Copied!");
        return;
      }
      setError("Sharing isn’t available in this browser.");
    } catch (err) {
      // User dismissed the system share sheet — not an error.
      if (err instanceof DOMException && err.name === "AbortError") return;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          trackEvent("share_result", {
            method: "clipboard_fallback",
            mode: playMode,
            moment_id: atBat.id,
            stars: session.stars,
            final_play: session.finalPlay,
          });
          flashShare("Copied!");
          return;
        }
      } catch {
        /* fall through */
      }
      setError("Could not share result.");
    }
  }

  function goHome() {
    cancelFlight();
    resetBattleState();
    clearInningPopTimer();
    setInningPop(null);
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

      {inningPop && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-background/70 p-4 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Between batters"
        >
          <div className="anim-rise w-full max-w-md rounded-md border border-flood/35 bg-card/95 p-5 shadow-[0_12px_40px_oklch(0.1_0.02_155/0.55)]">
            <p className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-flood">
              {inningPop.line}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {inningPop.sub}
            </p>
            <div className="mt-4 space-y-1.5 rounded-md bg-secondary/50 px-3 py-3 text-sm">
              <p className="text-chalk">{inningPop.scoreLine}</p>
              <p className="text-chalk">
                {inningPop.outs} out{inningPop.outs === 1 ? "" : "s"} ·{" "}
                {inningPop.runners}
              </p>
            </div>
            <Button
              size="lg"
              className="mt-5 h-12 w-full font-semibold"
              onClick={() => {
                setInningPop(null);
                continueInning();
              }}
            >
              Continue
            </Button>
          </div>
        </div>
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
            onInning={(difficulty) => startInning(difficulty)}
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
            bot9Difficulty={
              playMode === "inning" && inningSnap?.kind === "bot9"
                ? inningSnap.bot9?.difficulty ?? null
                : null
            }
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
        {phase === "rewrite_offer" && atBat && session && (
          <RewriteOfferScreen
            atBat={atBat}
            session={session}
            onContinue={acceptRewriteContinue}
            onStop={declineRewriteContinue}
          />
        )}
        {phase === "result" && atBat && session && (
          <ResultScreen
            atBat={atBat}
            session={session}
            shareFlash={shareFlash}
            pending={pending}
            isInning={isInning}
            inningOver={isInning && !!inningSnap && isInningOver(inningSnap)}
            walkedOff={isInning && !!inningSnap && isWalkOff(inningSnap)}
            tiedExtras={
              isInning && !!inningSnap && isBot9TiedForExtras(inningSnap)
            }
            inningLine={
              isInning && inningSnap ? inningSummary(inningSnap) : null
            }
            abLog={isInning && inningSnap ? inningSnap.abLog : null}
            inningKind={isInning && inningSnap ? inningSnap.kind : null}
            onShare={shareResult}
            onReplay={() => selectAtBat(atBat, playMode)}
            onContinueInning={
              isInning && inningSnap && !isInningOver(inningSnap)
                ? continueInning
                : undefined
            }
            onNewBot9={startInning}
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
  onInning: (difficulty: Bot9Difficulty) => void;
  catalogSize: number;
}) {
  return (
    <section className="flex min-h-[85dvh] flex-col justify-between gap-10 py-4">
      <div className="anim-rise space-y-6 pt-8 text-center sm:pt-14">
        <p className="text-xs uppercase tracking-[0.35em] text-flood/90">
          Daily challenge · {dateKey} ET
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-6xl leading-[0.9] tracking-wide text-chalk sm:text-7xl">
          Legendary
          <br />
          <span className="text-primary">At Bats</span>
        </h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground sm:text-base">
          Step into legendary moments. Swing or take — work the count.
        </p>
        <div className="mx-auto w-full max-w-sm space-y-2 text-left">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-flood">
              Today · {daily.year} {daily.series}
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-xl tracking-wide text-chalk">
              {daily.codename}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {daily.gameLabel} · {daily.inning} · {daily.runners}
            </p>
          </div>
          <ScoreBug
            away={daily.away}
            home={daily.home}
            inning={daily.inning}
            outs={daily.outs}
            count={{ balls: 0, strikes: 0 }}
            bases={daily.bases}
            batter={{
              abbr: battingSideAbbr(daily),
              number: daily.batter.number,
              name: daily.batter.name,
            }}
            pitcher={{
              abbr: pitchingSideAbbr(daily),
              number: daily.pitcher.number,
              name: daily.pitcher.name,
            }}
          />
        </div>
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
        <Bot9DifficultyPicker
          title="Bottom of the 9th Mode:"
          onPick={onInning}
        />
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
        {[...LEGENDARY_AT_BATS]
          .sort((a, b) => b.year - a.year || b.id.localeCompare(a.id))
          .map((ab) => (
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
                    {ab.batter.name ? ` · ${ab.batter.name}` : ""}
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

const BOT9_DIFFICULTY_LABEL: Record<Bot9Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

function Bot9DifficultyPicker({
  title,
  onPick,
}: {
  title: string;
  onPick: (difficulty: Bot9Difficulty) => void;
}) {
  return (
    <div className="rounded-lg bg-secondary px-3 py-3">
      <p className="mb-2 text-center text-sm font-medium text-secondary-foreground">
        {title}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { id: "easy", label: "Easy" },
            { id: "medium", label: "Medium" },
            { id: "hard", label: "Hard" },
          ] as const
        ).map((opt) => (
          <Button
            key={opt.id}
            size="lg"
            variant="outline"
            className="h-11 border-chalk/20 bg-background/40 text-sm font-semibold hover:bg-background/70"
            onClick={() => onPick(opt.id)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function SituationScreen({
  atBat,
  dateKey,
  count,
  playMode,
  bot9Difficulty,
  onStart,
  onBack,
  onHowTo,
}: {
  atBat: LegendaryAtBat;
  dateKey: string;
  count: CountState;
  playMode: PlayMode;
  bot9Difficulty: Bot9Difficulty | null;
  onStart: () => void;
  onBack: () => void;
  onHowTo: () => void;
}) {
  const modeBadge =
    playMode === "daily"
      ? dateKey
      : playMode === "inning"
        ? bot9Difficulty
          ? `Bot 9 · ${BOT9_DIFFICULTY_LABEL[bot9Difficulty]}`
          : "Bot 9"
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
          batter={{
            abbr: battingSideAbbr(atBat),
            number: atBat.batter.number,
            name: atBat.batter.name,
          }}
          pitcher={{
            abbr: pitchingSideAbbr(atBat),
            number: atBat.pitcher.number,
            name: atBat.pitcher.name,
          }}
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
          {playerIdentity(atBat.batter)} ({atBat.batter.bats}) vs{" "}
          {playerIdentity(atBat.pitcher)} · {atBat.runners}
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
  const outcomeIsNonBip =
    lastGrade != null && isNonBipPlay(lastGrade.play);
  // Non-BIP: show as soon as the pitch is decided. BIP: wait until exit flight ends.
  const showOutcome =
    phase === "pitch_result" &&
    lastGrade != null &&
    (outcomeIsNonBip || exitProgress >= 1);
  const bipInFlight =
    phase === "pitch_result" &&
    lastGrade != null &&
    !outcomeIsNonBip &&
    exitProgress > 0 &&
    exitProgress < 1;

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
          batter={{
            abbr: battingSideAbbr(atBat),
            number: atBat.batter.number,
            name: atBat.batter.name,
          }}
          pitcher={{
            abbr: pitchingSideAbbr(atBat),
            number: atBat.pitcher.number,
            name: atBat.pitcher.name,
          }}
        />
        {/* Former batter line — non-BIP (and BIP) outcome sits above the zone, clear of Safari chrome */}
        <div className="flex min-h-9 items-center justify-between gap-2">
          <div className="min-w-0 flex-1" aria-live="polite" aria-atomic="true">
            {showOutcome && lastGrade ? (
              <>
                <p
                  className={cn(
                    "font-[family-name:var(--font-display)] text-xl tracking-wide sm:text-2xl",
                    lastGrade.event === "out"
                      ? "text-destructive"
                      : lastGrade.event === "hit"
                        ? "text-flood"
                        : "text-primary",
                  )}
                >
                  {playResultLabel(lastGrade.play).toUpperCase()}
                </p>
                {!outcomeIsNonBip && (
                  <p className="truncate text-xs text-muted-foreground">
                    {exitLabel(lastGrade.play)}
                    {" · "}
                    {pitchTypeLabel(pitch.type)}
                  </p>
                )}
              </>
            ) : bipInFlight ? (
              <p className="text-sm uppercase tracking-[0.22em] text-flood/85">
                In play…
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/80">
                {windup
                  ? "Get set"
                  : live
                    ? `${count.balls}–${count.strikes}`
                    : "\u00a0"}
              </p>
            )}
          </div>
          <Badge
            variant="outline"
            className="shrink-0 rounded-md border-flood/50 text-flood"
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
    </section>
  );
}

function RewriteOfferScreen({
  atBat,
  session,
  onContinue,
  onStop,
}: {
  atBat: LegendaryAtBat;
  session: AtBatSessionResult;
  onContinue: () => void;
  onStop: () => void;
}) {
  return (
    <section className="anim-rise flex min-h-[85dvh] flex-col justify-between gap-8 py-4">
      <ScoreBug
        away={session.board.away}
        home={session.board.home}
        inning={atBat.inning}
        outs={session.board.outs}
        count={session.board.count}
        bases={session.board.bases}
      />
      <div className="space-y-4 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-flood">
          {atBat.codename}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-chalk sm:text-5xl">
          You’re on the verge of rewriting history
        </h2>
        <p className="text-sm text-flood">
          {playResultLabel(session.finalPlay)}
          {session.runsScored > 0 ? ` · ${session.runsScored} R` : ""}
        </p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Keep batting with this pitcher’s mix until you take the lead — or stop
          here and take the legendary ending.
        </p>
      </div>
      <div className="grid gap-2">
        <Button size="lg" className="h-12 font-semibold" onClick={onContinue}>
          Keep rewriting history
        </Button>
        <Button size="lg" variant="secondary" className="h-11" onClick={onStop}>
          Stop here
        </Button>
      </div>
    </section>
  );
}

function ResultScreen({
  atBat,
  session,
  shareFlash,
  pending,
  isInning,
  inningOver,
  walkedOff,
  tiedExtras,
  inningLine,
  abLog,
  inningKind,
  onShare,
  onReplay,
  onContinueInning,
  onNewBot9,
  onCatalog,
  onHome,
}: {
  atBat: LegendaryAtBat;
  session: AtBatSessionResult;
  shareFlash: string | null;
  pending: boolean;
  isInning: boolean;
  inningOver: boolean;
  walkedOff: boolean;
  tiedExtras: boolean;
  inningLine: string | null;
  abLog: AbLogEntry[] | null;
  inningKind: "bot9" | "rewrite" | null;
  onShare: () => void;
  onReplay: () => void;
  onContinueInning?: () => void;
  onNewBot9: (difficulty: Bot9Difficulty) => void;
  onCatalog: () => void;
  onHome: () => void;
}) {
  // Bot 9 tie → extras always awards ★★☆.
  const displayStars = tiedExtras ? 2 : session.stars;

  const starsBlurb = tiedExtras
    ? "Hopefully your team will come through in extras"
    : isInning
      ? inningOver
        ? (inningLine ?? "Inning over")
        : "Keep the line moving"
      : displayStars >= 3
        ? "Won the game"
        : displayStars === 2
          ? "Do your job"
          : "Failed the moment";

  const inningHeadline = !isInning
    ? session.endingTitle
    : walkedOff
      ? inningKind === "rewrite"
        ? "History rewritten"
        : "Walk-off!"
      : tiedExtras
        ? "You tied it"
        : inningOver
          ? "Ballgame"
          : session.endingTitle;

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
          {inningHeadline}
        </h2>
        <p className="text-sm text-flood">
          {playResultLabel(session.finalPlay)}
          {session.runsScored > 0 ? ` · ${session.runsScored} R` : ""}
        </p>
        {isInning && inningLine && !tiedExtras && (
          <p className="text-xs text-muted-foreground">{inningLine}</p>
        )}
      </div>

      <div className="rounded-md bg-secondary/50 p-5 text-center">
        <p className="font-[family-name:var(--font-display)] text-5xl text-primary">
          {"★".repeat(displayStars)}
          {"☆".repeat(3 - displayStars)}
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

      {isInning && abLog ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            At-bat log
          </p>
          <ul className="space-y-1.5">
            {abLog.map((entry) => (
              <li
                key={`${entry.batterIndex}-${entry.line}`}
                className={cn(
                  "flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2 text-sm font-medium",
                  entry.runsScored > 0 ? "text-flood" : "text-chalk",
                )}
              >
                <span>
                  B{entry.batterIndex} · {entry.batterLabel}
                </span>
                <span className="text-xs tabular-nums opacity-90">
                  {entry.line}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
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
      )}

      <div className="mt-auto grid gap-2">
        {isInning && inningOver ? (
          <Bot9DifficultyPicker
            title={
              inningKind === "rewrite"
                ? "Bottom of the 9th Mode:"
                : "New Bottom of the 9th:"
            }
            onPick={onNewBot9}
          />
        ) : isInning && onContinueInning ? (
          <Button size="lg" className="h-12" onClick={onContinueInning}>
            Next batter
          </Button>
        ) : (
          <Button size="lg" className="h-12" onClick={onShare}>
            {shareFlash ?? "Share result"}
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
              {shareFlash ?? "Share"}
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
