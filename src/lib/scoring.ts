import type {
  AtBatSessionResult,
  HistoryVerdict,
  LegendaryAtBat,
  PitchDecision,
  PitchResultGrade,
  PitchType,
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

export const POINTS = {
  type: 25,
  decision: 25,
  aim: 30,
  timing: 20,
} as const;

/** Score ratio that counts as "coming through" on the at-bat */
export const CAME_THROUGH_RATIO = 0.6;

export function maxScoreForPitchCount(count: number): number {
  return count * (POINTS.type + POINTS.decision + POINTS.aim + POINTS.timing);
}

export function zoneDistance(a: ZoneCoord, b: ZoneCoord): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function aimScoreFromDistance(distance: number): number {
  const normalized = Math.min(1, distance / 0.45);
  return Math.round(POINTS.aim * (1 - normalized));
}

export function timingScoreFromElapsed(
  elapsedMs: number,
  windowMs: number,
): number {
  if (windowMs <= 0) return 0;
  const ideal = windowMs * 0.82;
  const delta = Math.abs(elapsedMs - ideal);
  const tolerance = windowMs * 0.35;
  const ratio = Math.min(1, delta / tolerance);
  return Math.round(POINTS.timing * (1 - ratio));
}

export function gradePitch(opts: {
  pitch: SeedPitch;
  recognizedType: PitchType | null;
  decision: PitchDecision;
  aim?: ZoneCoord;
  timingMs?: number;
  windowMs: number;
}): PitchResultGrade {
  const typeCorrect = opts.recognizedType === opts.pitch.type;
  const decisionCorrect = opts.decision === opts.pitch.expectedDecision;
  const swung = opts.decision === "swing";

  let aimDistance: number | undefined;
  let aimPts = 0;
  let timingPts = 0;

  if (swung && opts.aim) {
    aimDistance = zoneDistance(opts.aim, opts.pitch.location);
    aimPts = aimScoreFromDistance(aimDistance);
    timingPts = timingScoreFromElapsed(opts.timingMs ?? 0, opts.windowMs);
  } else if (!swung && decisionCorrect) {
    aimPts = POINTS.aim;
    timingPts = POINTS.timing;
  }

  const pitchScore =
    (typeCorrect ? POINTS.type : 0) +
    (decisionCorrect ? POINTS.decision : 0) +
    aimPts +
    timingPts;

  return {
    pitchId: opts.pitch.id,
    recognizedType: opts.recognizedType,
    typeCorrect,
    decision: opts.decision,
    decisionCorrect,
    swung,
    aim: opts.aim,
    aimDistance,
    timingMs: opts.timingMs,
    timingScore: timingPts,
    pitchScore,
  };
}

/**
 * Compare player performance to the historical outcome.
 * Failed ABs are intentional: high score = changed history.
 */
export function resolveHistoryVerdict(
  atBat: LegendaryAtBat,
  totalScore: number,
  maxScore: number,
): { verdict: HistoryVerdict; playerCameThrough: boolean } {
  const ratio = maxScore === 0 ? 0 : totalScore / maxScore;
  const playerCameThrough = ratio >= CAME_THROUGH_RATIO;

  if (!atBat.historical.batterSucceeded) {
    if (playerCameThrough) {
      return { verdict: "changed_history", playerCameThrough };
    }
    return { verdict: "history_held", playerCameThrough };
  }

  if (playerCameThrough) {
    return { verdict: "matched_legend", playerCameThrough };
  }
  return { verdict: "fell_short", playerCameThrough };
}

export function finalizeSession(opts: {
  atBat: LegendaryAtBat;
  dateKey: string;
  grades: PitchResultGrade[];
}): AtBatSessionResult {
  const totalScore = opts.grades.reduce((s, g) => s + g.pitchScore, 0);
  const maxScore = maxScoreForPitchCount(opts.grades.length);
  const ratio = maxScore === 0 ? 0 : totalScore / maxScore;
  const stars = ratio >= 0.85 ? 3 : ratio >= 0.6 ? 2 : ratio >= 0.35 ? 1 : 0;
  const { verdict, playerCameThrough } = resolveHistoryVerdict(
    opts.atBat,
    totalScore,
    maxScore,
  );

  return {
    atBatId: opts.atBat.id,
    dateKey: opts.dateKey,
    grades: opts.grades,
    totalScore,
    maxScore,
    stars,
    historyVerdict: verdict,
    playerCameThrough,
  };
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
