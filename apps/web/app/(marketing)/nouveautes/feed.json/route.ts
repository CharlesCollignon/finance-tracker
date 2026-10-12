import type { NouveautesFeed } from "@finance/core/changelog";
import { CHANGELOG } from "@finance/core/changelog-entries";
import { openRoadmap } from "@/components/marketing/nouveautes/open-roadmap";
import {
  ANDROID_DOWNLOAD_PATH,
  latestApkVersion,
  storeLinks,
} from "@/lib/store-links";
import { getSiteUrl } from "@/lib/supabase/env";

/**
 * « Nouveautés » for the phone (`NouveautesFeed`): every entry, both
 * languages, what is coming, and the APK the site hands out with its
 * version. Read by the app rather than bundled into it, so an APK installed
 * months ago still hears of what shipped since — and of a newer APK to
 * download. Built again at most every ten minutes, so a release published
 * between deployments is offered without one (`latestApkVersion`).
 */
export const revalidate = 600;

export async function GET() {
  const version = await latestApkVersion();
  const feed: NouveautesFeed = {
    entries: [...CHANGELOG],
    roadmap: [...openRoadmap()],
    apk:
      version && storeLinks().androidApk
        ? {
            version,
            url: new URL(ANDROID_DOWNLOAD_PATH, getSiteUrl()).toString(),
          }
        : null,
  };
  return Response.json(feed, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
