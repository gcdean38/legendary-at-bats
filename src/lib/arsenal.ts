import type { PitchType, SeedPitch, ZoneCoord } from "@/lib/types";
import { PLATE, isInStrikeZone } from "@/lib/zone";

export type ArsenalPitch = {
  type: PitchType;
  /** Typical release speed for this offering */
  speedMph: number;
};

/** Unique pitch types from a scripted sequence = that pitcher's arsenal. */
export function arsenalFromPitches(pitches: SeedPitch[]): ArsenalPitch[] {
  const byType = new Map<PitchType, number>();
  for (const p of pitches) {
    if (!byType.has(p.type)) byType.set(p.type, p.speedMph);
  }
  return [...byType.entries()].map(([type, speedMph]) => ({ type, speedMph }));
}

/** Default arsenal for Inning mode (generic big-league mix). */
export const GENERIC_ARSENAL: ArsenalPitch[] = [
  { type: "FF", speedMph: 95 },
  { type: "SI", speedMph: 93 },
  { type: "CT", speedMph: 89 },
  { type: "SL", speedMph: 86 },
  { type: "CH", speedMph: 84 },
  { type: "CU", speedMph: 78 },
];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Random plate location — mostly in the zone, with enough chase to
 * reward takes. Full-plate coords (strike zone is an inset).
 */
export function randomPlateLocation(rng: () => number = Math.random): ZoneCoord {
  const { zoneLeft: L, zoneRight: R, zoneTop: T, zoneBottom: B } = PLATE;
  const roll = rng();

  if (roll < 0.58) {
    // Heart / shadow of the zone
    return {
      x: round2(L + 0.05 + rng() * (R - L - 0.1)),
      y: round2(T + 0.05 + rng() * (B - T - 0.1)),
    };
  }

  if (roll < 0.78) {
    // Just off the black
    const side = rng();
    if (side < 0.25) {
      return { x: round2(L - 0.06 - rng() * 0.08), y: round2(T + rng() * (B - T)) };
    }
    if (side < 0.5) {
      return { x: round2(R + 0.06 + rng() * 0.08), y: round2(T + rng() * (B - T)) };
    }
    if (side < 0.75) {
      return { x: round2(L + rng() * (R - L)), y: round2(T - 0.06 - rng() * 0.08) };
    }
    return { x: round2(L + rng() * (R - L)), y: round2(B + 0.06 + rng() * 0.08) };
  }

  // Wider chase
  return {
    x: round2(clamp(rng(), 0.04, 0.96)),
    y: round2(clamp(rng(), 0.04, 0.96)),
  };
}

/** Throw one pitch from an arsenal with a fresh location + light speed jitter. */
export function throwFromArsenal(
  arsenal: ArsenalPitch[],
  cursor: number,
  rng: () => number = Math.random,
): SeedPitch {
  if (arsenal.length === 0) {
    throw new Error("Arsenal is empty.");
  }
  const pick = arsenal[Math.floor(rng() * arsenal.length)]!;
  const location = randomPlateLocation(rng);
  const inZone = isInStrikeZone(location);
  const speedMph = Math.max(
    70,
    Math.min(102, pick.speedMph + Math.round((rng() - 0.5) * 4)),
  );
  return {
    id: `ars-${pick.type}-${cursor + 1}`,
    type: pick.type,
    speedMph,
    location,
    inZone,
    expectedDecision: inZone ? "swing" : "take",
    approachCue: "From the arsenal.",
  };
}

/** Opening sequence — N fresh throws from an arsenal. */
export function generateOpeningSequence(
  arsenal: ArsenalPitch[],
  count: number,
  rng: () => number = Math.random,
): SeedPitch[] {
  return Array.from({ length: count }, (_, i) => throwFromArsenal(arsenal, i, rng));
}
