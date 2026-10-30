import { estimateContact } from "@/lib/contact";
import { isInStrikeZone } from "@/lib/zone";
import {
  applyBaserunning,
  batterIsHome,
  resolveEndingNarrative,
} from "@/lib/situation";
import type {
  AtBatEndReason,
  AtBatSessionResult,
  BasesState,
  CountState,
  EndingTone,
  ExitKind,
  HistoricalOutcome,
  HistoryVerdict,
  LegendaryAtBat,
  PitchDecision,
  PitchResultGrade,
  PitchType,
  PlayResult,
  SeedPitch,
  ZoneCoord,
} from "@/lib/types";

export const PITCH_TYPES: { id: PitchType; label: string }[] = [
  { id: "FF", label: "4-Seam" },
  { id: "SI", label: "Sinker" },
  { id: "SL", label: "Slider" },
  { id: "CH", label: "Change" },
  { id: "CU", label: "Curve" },
  { id: "CT", label: "Cutter" },
];

export function zoneDistance(a: ZoneCoord, b: ZoneCoord): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Outcome stars from ending tone alone (Bot 9 / mid-rally defaults).
 * 3 = won the game · 2 = did your job · 1 = failed
 */
export function starsFromEnding(tone: EndingTone): number {
  switch (tone) {
    case "won_game":
      return 3;
    case "took_lead":
    case "tied_game":
    case "scored_continue":
    case "pass_the_baton":
      return 2;
    case "failed_hope":
    case "failed_lost":
    default:
      return 1;
  }
}

/** Real catalog moments — not Bot 9 / rewrite-generated plate appearances. */
export function isLegendaryMoment(atBat: LegendaryAtBat): boolean {
  return !atBat.id.startsWith("bot9-") && !atBat.id.startsWith("rewrite-");
}

/** Map a live play onto the curated historical outcome labels. */
export function playMatchesHistorical(
  play: PlayResult,
  outcome: HistoricalOutcome,
): boolean {
  switch (outcome) {
    case "home_run":
    case "grand_slam":
      return play === "home_run";
    case "single":
      return play === "single";
    case "double":
      return play === "double";
    case "walk":
      return play === "walk";
    case "strikeout":
      return play === "strikeout";
    case "gidp":
      return play === "double_play";
    case "flyout":
      return play === "fly_out" || play === "sac_fly";
    case "groundout":
      return play === "ground_out";
    case "lineout":
      return play === "line_out";
    default:
      return false;
  }
}

/**
 * Legendary daily/archive stars:
 * - Winning-side: match the historical result → 3★ (even a tying Leyritz HR)
 * - Losing-side: fail like history → 1★; on-base / partial → 2★;
 *   fully reverse (tie / take lead / win) → 3★
 * Bot 9 / rewrite PAs stay on tone-only scoring.
 */
export function resolveStars(opts: {
  atBat: LegendaryAtBat;
  finalPlay: PlayResult;
  tone: EndingTone;
  playerCameThrough: boolean;
}): number {
  const { atBat, finalPlay, tone } = opts;
  if (tone === "won_game") return 3;

  if (isLegendaryMoment(atBat)) {
    // Winning-side / recreate-the-legend
    if (atBat.historical.batterSucceeded) {
      if (playMatchesHistorical(finalPlay, atBat.historical.outcome)) {
        return 3;
      }
      return starsFromEnding(tone);
    }

    // Losing-side / reverse-history
    // Full reverse: knot it or flip the lead (won_game already returned above).
    if (tone === "tied_game" || tone === "took_lead") {
      return 3;
    }
    return starsFromEnding(tone); // 2 partial · 1 failed
  }

  return starsFromEnding(tone);
}

export function gradePitch(opts: {
  pitch: SeedPitch;
  decision: PitchDecision;
  aim?: ZoneCoord;
  timingMs?: number;
  windowMs: number;
  bases: BasesState;
  outs: number;
  /** Count when this pitch is thrown (before the outcome) */
  countBefore: CountState;
  /** Batter handedness — shapes the barrel contact kernel */
  bats?: "L" | "R" | "S";
}): PitchResultGrade {
  const inZone = isInStrikeZone(opts.pitch.location);
  const swung = opts.decision === "swing";
  // Zone is the source of truth: swing at strikes, take balls.
  // Seeded expectedDecision is only a soft hint for pitch design, not a quiz answer.
  const decisionCorrect = swung ? inZone : !inZone;

  let aimDistance: number | undefined;
  let exitKind: ExitKind = "take";
  let play: PlayResult = "ball";
  let launchDeg: number | undefined;
  let exitVeloMph: number | undefined;
  let contactQuality: number | undefined;
  let event: PitchResultGrade["event"] = "ball";

  if (swung && opts.aim) {
    aimDistance = zoneDistance(opts.aim, opts.pitch.location);

    const contact = estimateContact({
      pitchLoc: opts.pitch.location,
      aim: opts.aim,
      timingMs: opts.timingMs ?? 0,
      windowMs: opts.windowMs,
      bases: opts.bases,
      outs: opts.outs,
      bats: opts.bats,
    });
    exitKind = contact.exitKind;
    play = contact.play;
    // Whiffs aren't contact — no launch angle / exit velo in the log
    if (contact.play !== "whiff") {
      launchDeg = contact.launchDeg;
      exitVeloMph = contact.exitVeloMph;
      contactQuality = contact.quality;
    }
    event = contact.event;
  } else if (!swung) {
    if (inZone) {
      play = "strike_looking";
      event = "strike";
    } else {
      play = "ball";
      event = "ball";
    }
    exitKind = "take";
  }

  return {
    pitchId: opts.pitch.id,
    pitchType: opts.pitch.type,
    speedMph: opts.pitch.speedMph,
    countBefore: opts.countBefore,
    decision: opts.decision,
    decisionCorrect,
    swung,
    aim: opts.aim,
    aimDistance,
    timingMs: opts.timingMs,
    timingScore: 0,
    pitchScore: 0,
    exitKind,
    event,
    play,
    launchDeg,
    exitVeloMph,
    contactQuality,
  };
}

export function resolveHistoryVerdict(
  atBat: LegendaryAtBat,
  playerCameThrough: boolean,
): HistoryVerdict {
  if (!atBat.historical.batterSucceeded) {
    return playerCameThrough ? "changed_history" : "history_held";
  }
  return playerCameThrough ? "matched_legend" : "fell_short";
}

export function finalizeSession(opts: {
  atBat: LegendaryAtBat;
  dateKey: string;
  grades: PitchResultGrade[];
  endReason: AtBatEndReason;
  finalCount: CountState;
}): AtBatSessionResult {
  const last = opts.grades[opts.grades.length - 1];
  let finalPlay: PlayResult = last?.play ?? "strikeout";
  if (opts.endReason === "walk") finalPlay = "walk";
  if (opts.endReason === "strikeout") finalPlay = "strikeout";
  if (opts.endReason === "max_pitches" && !last?.swung) {
    finalPlay = "strikeout";
  }

  const { runs, bases: nextBases, outsRecorded } = applyBaserunning(
    opts.atBat.bases,
    finalPlay,
    opts.atBat.outs,
    last?.contactQuality,
  );
  const narrative = resolveEndingNarrative({
    atBat: opts.atBat,
    play: finalPlay,
    endReason: opts.endReason,
    runsScored: runs,
  });

  const stars = resolveStars({
    atBat: opts.atBat,
    finalPlay,
    tone: narrative.tone,
    playerCameThrough: narrative.playerCameThrough,
  });
  const historyVerdict = resolveHistoryVerdict(
    opts.atBat,
    narrative.playerCameThrough,
  );

  const isHome = batterIsHome(opts.atBat);
  const away = {
    ...opts.atBat.away,
    runs: opts.atBat.away.runs + (isHome ? 0 : runs),
  };
  const home = {
    ...opts.atBat.home,
    runs: opts.atBat.home.runs + (isHome ? runs : 0),
  };
  const outs = Math.min(3, opts.atBat.outs + outsRecorded);

  return {
    atBatId: opts.atBat.id,
    dateKey: opts.dateKey,
    grades: opts.grades,
    totalScore: stars,
    maxScore: 3,
    stars,
    historyVerdict,
    playerCameThrough: narrative.playerCameThrough,
    endReason: opts.endReason,
    finalCount: opts.finalCount,
    finalPlay,
    endingTone: narrative.tone,
    endingTitle: narrative.title,
    endingBlurb: narrative.blurb,
    runsScored: runs,
    board: {
      away,
      home,
      bases: nextBases,
      outs,
      // AB is over — clear the count on the bug
      count: { balls: 0, strikes: 0 },
    },
  };
}

export function pitchTypeLabel(type: PitchType): string {
  return PITCH_TYPES.find((t) => t.id === type)?.label ?? type;
}

export function outcomeLabel(outcome: string): string {
  const map: Record<string, string> = {
    home_run: "Home run",
    grand_slam: "Grand slam",
    single: "Single",
    double: "Double",
    walk: "Walk",
    strikeout: "Strikeout",
    gidp: "Grounded into double play",
    flyout: "Fly out",
    groundout: "Ground out",
    lineout: "Line out",
  };
  return map[outcome] ?? outcome;
}

export function verdictCopy(verdict: HistoryVerdict): {
  title: string;
  blurb: string;
} {
  switch (verdict) {
    case "changed_history":
      return {
        title: "You changed history",
        blurb:
          "The real moment ended in heartbreak. Your at-bat rewrote the ending.",
      };
    case "matched_legend":
      return {
        title: "You matched the legend",
        blurb:
          "You showed up in the moment the way history remembers it — clutch and clean.",
      };
    case "history_held":
      return {
        title: "History held",
        blurb:
          "The original heartbreak stands. Come back tomorrow and try to rewrite it.",
      };
    case "fell_short":
      return {
        title: "You fell short",
        blurb:
          "The legend came through. This time, the moment got the better of you.",
      };
  }
}
