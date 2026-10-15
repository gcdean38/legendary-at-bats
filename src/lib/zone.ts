import type { ZoneCoord } from "@/lib/types";

/**
 * Full plate graphic is the active/clickable area (0–1).
 * The drawn 3×3 strike zone is an inset of that plate — balls can live outside it.
 */
export const PLATE = {
  zoneLeft: 0.22,
  zoneRight: 0.78,
  zoneTop: 0.2,
  zoneBottom: 0.8,
} as const;

export function isInStrikeZone(c: ZoneCoord): boolean {
  return (
    c.x >= PLATE.zoneLeft &&
    c.x <= PLATE.zoneRight &&
    c.y >= PLATE.zoneTop &&
    c.y <= PLATE.zoneBottom
  );
}

/**
 * Convert legacy coords (0–1 = inside the 3×3 only) into full-plate coords.
 * Out-of-zone pitches are pushed into the chase frame outside the inset.
 */
export function fromLegacyZoneCoord(
  loc: ZoneCoord,
  inZone: boolean,
): ZoneCoord {
  const { zoneLeft: L, zoneRight: R, zoneTop: T, zoneBottom: B } = PLATE;
  const zx = L + loc.x * (R - L);
  const zy = T + loc.y * (B - T);
  if (inZone) {
    return { x: round2(zx), y: round2(zy) };
  }

  let x = zx;
  let y = zy;
  if (loc.x > 0.65) x = R + 0.1;
  else if (loc.x < 0.35) x = L - 0.1;
  if (loc.y < 0.35) y = Math.min(y, T - 0.1);
  else if (loc.y > 0.65) y = Math.max(y, B + 0.1);

  // Guarantee outside the drawn zone
  if (x >= L && x <= R && y >= T && y <= B) {
    x = loc.x >= 0.5 ? R + 0.1 : L - 0.1;
  }

  return {
    x: round2(clamp(x, 0.03, 0.97)),
    y: round2(clamp(y, 0.03, 0.97)),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
