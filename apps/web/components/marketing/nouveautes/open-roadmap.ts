import "server-only";
import type { RoadmapItem } from "@finance/core/changelog";
import { ROADMAP } from "@finance/core/changelog-entries";
import { storeLinks } from "@/lib/store-links";

/**
 * « Bientôt » as this deployment can truly say it. The stores item says the
 * Android app downloads from the site meanwhile, which is only so where the
 * site hands out the APK and Google Play does not have it yet.
 */
export function openRoadmap(): readonly RoadmapItem[] {
  const stores = storeLinks();
  const apkOnly = Boolean(stores.androidApk) && !stores.googlePlay;
  return ROADMAP.filter((item) => item.id !== "stores" || apkOnly);
}
