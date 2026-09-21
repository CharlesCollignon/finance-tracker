import { Android } from "@/components/magicui/android";
import { Safari } from "@/components/magicui/safari";
import { FeatureMock } from "@/components/marketing/LandingMocks";
import type { LandingPageId } from "@/components/marketing/landing-copy";
import { cn } from "@/lib/utils";

/**
 * A desktop window with a phone overlapping its lower right, both showing the
 * same screen — so "web and mobile" is something the page demonstrates rather
 * than something the copy claims.
 *
 * On the dark ground the frames need help to sit *on* something: the warm
 * wash behind them is the same light the hero orb throws, and the fade at the
 * bottom keeps the window from ending in a hard edge across the page.
 */
export function LandingDeviceStack({
  pageId = "bearing",
  className,
}: {
  pageId?: LandingPageId;
  className?: string;
}) {
  return (
    <div className={cn("relative mx-auto w-full max-w-5xl", className)}>
      <div
        className="marketing-bloom pointer-events-none absolute -inset-x-12 -top-16 bottom-0 rounded-[50%] opacity-60"
        style={{ filter: "blur(40px)" }}
        aria-hidden
      />

      {/* The phone is capped so that, at the Android frame's 433:882 ratio, it
          stays shorter than the Safari frame plus the overhang below it.
          Sized any larger it pokes out above the window and blankets the
          desktop mock's entire right-hand column. */}
      <div className="relative pb-[22%] md:pb-[14%]">
        <div className="w-[80%] overflow-hidden rounded-card ring-1 ring-white/10">
          <Safari url="pluclair.com" className="w-full">
            <FeatureMock pageId={pageId} variant="web" />
          </Safari>
        </div>
        {/* No drop shadow under the phone. It carried
            `0 30px 60px rgba(0, 0, 0, 0.65)` until DESIGN.md's
            Flat-With-One-Exception Rule was read as written — The Marketing
            Glass Rule licenses the glass vocabulary's two and nothing else,
            and a soft black pool under a device mock is the elevation scale
            that rule exists to refuse. What holds the phone off the window is
            what the system asks for instead: its own chassis is a step in
            surface value, `#404040` against a `#06060a` ground, over a window
            whose content is darker still. */}
        <div className="absolute bottom-0 right-0 z-20 w-[28%] min-w-[7rem] max-w-[15rem]">
          <Android className="w-full">
            <FeatureMock pageId={pageId} variant="mobile" />
          </Android>
        </div>
      </div>
    </div>
  );
}
