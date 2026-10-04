import { NextResponse } from "next/server";
import {
  abandonConnection,
  finishConnection,
  type ConnectMode,
  type ConnectOutcome,
} from "@/lib/ai/connection";
import { getSiteUrl } from "@/lib/supabase/env";

/**
 * Where OpenRouter sends the user back, with a code and our state. The state
 * is what says who they are — the browser it lands in may hold no session,
 * the phone's never does — so it is spent here whatever happens, and the
 * user goes back where the round trip began with how it went: to the web's
 * Profile, or into the phone app by its deep link.
 */

export const dynamic = "force-dynamic";

function back(mode: ConnectMode | null, outcome: ConnectOutcome) {
  const target =
    mode === "app"
      ? `pluclair://profile?ai=${outcome}`
      : `${getSiteUrl()}/profile?ai=${outcome}`;
  return NextResponse.redirect(target, 303);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  if (!state) {
    return back(null, "expired");
  }
  if (!code) {
    // Declined at OpenRouter: the state is spent all the same.
    return back(await abandonConnection(state), "refused");
  }

  const { mode, outcome } = await finishConnection(state, code);
  return back(mode, outcome);
}
