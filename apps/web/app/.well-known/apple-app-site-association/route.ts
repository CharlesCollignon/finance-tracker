import { appleTeamId, IOS_BUNDLE_ID, wellKnownJsonResponse } from "@/lib/mobile-app";

export const dynamic = "force-dynamic";

export function GET(): Response {
  const teamId = appleTeamId();
  const apps = teamId ? [`${teamId}.${IOS_BUNDLE_ID}`] : [];

  return wellKnownJsonResponse({
    webcredentials: { apps },
  });
}
