import { arsenalFromPitches, GENERIC_ARSENAL, throwFromArsenal } from "@/lib/arsenal";
import type {
  AtBatEndReason,
  CountState,
  ExitKind,
  PitchEvent,
  PitchResultGrade,
  SeedPitch,
} from "@/lib/types";
import { isInStrikeZone } from "@/lib/zone";

/** Cap so foul battles can't run forever; then force an ending. */
export const MAX_PITCHES_PER_AB = 12;

export function formatScoreLine(away: { abbr: string; runs: number }, home: { abbr: string; runs: number }) {
  return `${away.abbr} ${away.runs} · ${home.abbr} ${home.runs}`;
}

/**
 * Map a graded swing/take to a baseball count event.
 * Weak contact ("ground") counts as a foul so the AB can keep going.
 */
export function pitchEventFromGrade(
  pitch: SeedPitch,
  grade: Pick<PitchResultGrade, "swung" | "exitKind">,
): PitchEvent {
  if (!grade.swung) {
    // Geometry wins over the authored inZone flag (avoids “looks in, says out”).
    return isInStrikeZone(pitch.location) ? "strike" : "ball";
  }
  const kind: ExitKind = grade.exitKind;
  if (kind === "whiff") return "strike";
  if (kind === "crush" || kind === "line") return "hit";
  // ground / anything else put in play softly → foul (battle continues)
  return "foul";
}

export function eventLabel(event: PitchEvent): string {
  switch (event) {
    case "ball":
      return "Ball";
    case "strike":
      return "Strike";
    case "foul":
      return "Foul";
    case "hit":
      return "In play — squared up";
    case "out":
      return "In play — out";
  }
}

export function applyPitchEvent(
  count: CountState,
  event: PitchEvent,
): {
  count: CountState;
  ended: boolean;
  reason?: AtBatEndReason;
} {
  if (event === "hit") {
    return { count, ended: true, reason: "hit" };
  }
  if (event === "out") {
    return { count, ended: true, reason: "out" };
  }

  let { balls, strikes } = count;

  if (event === "ball") {
    balls += 1;
    if (balls >= 4) {
      return { count: { balls: 4, strikes }, ended: true, reason: "walk" };
    }
    return { count: { balls, strikes }, ended: false };
  }

  if (event === "strike") {
    strikes += 1;
    if (strikes >= 3) {
      return { count: { balls, strikes: 3 }, ended: true, reason: "strikeout" };
    }
    return { count: { balls, strikes }, ended: false };
  }

  // foul: strike if under 2, else stay (classic two-strike foul)
  if (strikes < 2) {
    strikes += 1;
  }
  return { count: { balls, strikes }, ended: false };
}

/**
 * Next seed pitch for a legendary (or pre-rolled) sequence.
 * Scripted order while cursor is in-range; once exhausted (foul battle
 * still alive), draw a fresh throw from that pitcher's arsenal (unique
 * types in the script) with a new location — not a copy of the last
 * authored pitch.
 *
 * Callers must lock the result once per cursor (do not re-roll every render).
 * Bottom-of-the-9th / rewrite rallies pre-roll a full sequence into
 * `pitches`, so they rarely hit this arsenal path.
 */
export function pitchAtCursor(
  pitches: SeedPitch[],
  cursor: number,
  rng: () => number = Math.random,
): SeedPitch {
  if (pitches.length === 0) {
    throw new Error("At-bat has no pitches.");
  }
  if (cursor < pitches.length) {
    const template = pitches[cursor]!;
    return {
      ...template,
      id: `${template.id}·${cursor + 1}`,
    };
  }
  const arsenal = arsenalFromPitches(pitches);
  return throwFromArsenal(
    arsenal.length > 0 ? arsenal : GENERIC_ARSENAL,
    cursor,
    rng,
  );
}
