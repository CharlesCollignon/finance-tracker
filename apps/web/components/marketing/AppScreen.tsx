import { FeatureMock } from "@/components/marketing/LandingMocks";
import type { LandingPageId } from "@/components/marketing/landing-copy";
import { cn } from "@/lib/utils";

/**
 * How much of the desktop screen to show, top down, where its content ends
 * well short of the bottom: an empty lower half reads as a broken picture.
 * The rest show whole.
 */
const WEB_VISIBLE: Partial<Record<LandingPageId, number>> = {
  charges: 0.62,
  "month-close": 0.74,
  plan: 0.5,
  wallets: 0.5,
};

/**
 * A screen of the app as it looks, with nothing drawn around it.
 *
 * It used to sit in a drawn Safari window with a drawn Android phone over its
 * corner: chrome the visitor's own browser already supplies, and a phone app
 * the page then seemed to promise before it ships. Now it is the screen
 * itself, at the width it would have — the desktop layout from a tablet up,
 * and on a phone the narrow layout of the same web app, cropped above its tab
 * bar so it does not run a whole screen tall.
 */
export function AppScreen({
  pageId,
  className,
}: {
  pageId: LandingPageId;
  className?: string;
}) {
  const visible = WEB_VISIBLE[pageId] ?? 1;
  return (
    <figure className={cn("m-0", className)}>
      <div
        className={cn(
          "hidden overflow-hidden rounded-card bg-background ring-1 ring-white/10 md:block",
          visible < 1 &&
            "[mask-image:linear-gradient(to_bottom,black_80%,transparent)]",
        )}
        style={{ aspectRatio: `1200 / ${Math.round(700 * visible)}` }}
      >
        <div className="aspect-[12/7] w-full">
          <FeatureMock pageId={pageId} variant="web" />
        </div>
      </div>
      <div className="mx-auto aspect-[9/14] w-full max-w-[18rem] overflow-hidden rounded-card bg-background ring-1 ring-white/10 [mask-image:linear-gradient(to_bottom,black_82%,transparent)] md:hidden">
        <div className="aspect-[9/20] w-full">
          <FeatureMock pageId={pageId} variant="mobile" />
        </div>
      </div>
    </figure>
  );
}
