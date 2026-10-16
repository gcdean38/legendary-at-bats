import { sendGAEvent } from "@next/third-parties/google";

/** GA4 Measurement ID for the legendary-at-bats web stream. */
export const GA_MEASUREMENT_ID = "G-2WW33SVR37";

type GaParam = string | number | boolean;

/**
 * Fire a GA4 event. No-ops safely if gtag isn’t ready yet.
 */
export function trackEvent(
  name: string,
  params?: Record<string, GaParam>,
): void {
  try {
    sendGAEvent("event", name, params ?? {});
  } catch {
    /* analytics must never break gameplay */
  }
}
