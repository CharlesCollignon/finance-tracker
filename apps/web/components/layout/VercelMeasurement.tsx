"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { keepIfMeasured, setMeasured } from "@/lib/measurement";

/**
 * Vercel Web Analytics and Speed Insights, under « Mesure d'audience ».
 *
 * `on` is the stored preference for someone signed in, and on for a visitor
 * without an account, who has no switch. Off when the page loads, neither
 * script is fetched. Turned off later, the scripts stay but send nothing
 * (`keepIfMeasured`). Turned on later, they load from then on.
 */
export function VercelMeasurement({ on }: { on: boolean }) {
  const [loaded, setLoaded] = useState(on);
  if (on && !loaded) {
    setLoaded(true);
  }

  useEffect(() => {
    setMeasured(on);
  }, [on]);

  if (!loaded) {
    return null;
  }
  return (
    <>
      <Analytics beforeSend={keepIfMeasured} />
      <SpeedInsights beforeSend={keepIfMeasured} />
    </>
  );
}
