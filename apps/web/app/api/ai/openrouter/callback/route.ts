import { NextResponse } from "next/server";
import {
  abandonConnection,
  connectionOrigin,
  finishConnection,
  type ConnectMode,
  type ConnectOrigin,
  type ConnectOutcome,
} from "@/lib/ai/connection";
import { getSiteUrl } from "@/lib/supabase/env";

/**
 * Where OpenRouter sends the user back, with a code and our state. The state
 * is what says who they are — the browser it lands in may hold no session,
 * the phone's never does — so it is spent here whatever happens, and the
 * user goes back where the round trip began with how it went: the Profile
 * or the welcome flow, on the web or in the phone app by its deep link.
 */

export const dynamic = "force-dynamic";

/** The phone's route and the web's page, for each place a trip begins. */
const LANDINGS: Record<ConnectOrigin, { app: string; web: string }> = {
  profile: { app: "profile", web: "/profile" },
  welcome: { app: "onboarding", web: "/welcome" },
};

function back(
  mode: ConnectMode | null,
  origin: ConnectOrigin,
  outcome: ConnectOutcome,
) {
  const landing = LANDINGS[origin];
  const target =
    mode === "app"
      ? `pluclair://${landing.app}?ai=${outcome}`
      : `${getSiteUrl()}${landing.web}?ai=${outcome}`;
  return NextResponse.redirect(target, 303);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  if (!state) {
    return back(null, "profile", "expired");
  }
  const origin = connectionOrigin(state);
  if (!code) {
    // Declined at OpenRouter: the state is spent all the same.
    return back(await abandonConnection(state), origin, "refused");
  }

  const { mode, outcome } = await finishConnection(state, code);
  return back(mode, origin, outcome);
}
