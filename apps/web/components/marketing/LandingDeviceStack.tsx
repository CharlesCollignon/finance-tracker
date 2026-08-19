import { Android } from "@/components/magicui/android";
import { Safari } from "@/components/magicui/safari";
import { FeatureMock } from "@/components/marketing/LandingMocks";
import type { LandingPageId } from "@/components/marketing/landing-copy";

/** A Safari desktop frame with an Android phone overlapping bottom-right,
 * both showing the same feature — reused on the homepage hero and on every
 * feature page so "web" and "mobile" are never just a claim in the copy. */
export function LandingDeviceStack({
  pageId = "home",
}: {
  pageId?: LandingPageId;
}) {
  return (
    <div className="relative mx-auto w-full max-w-5xl pb-[18%] md:pb-[12%]">
      <div className="w-[82%]">
        <Safari url="pluclair.com" className="w-full">
          <FeatureMock pageId={pageId} variant="web" />
        </Safari>
      </div>
      <div className="absolute right-[2%] bottom-0 z-20 w-[34%] min-w-[7.5rem] max-w-[16rem] drop-shadow-xl sm:max-w-[18rem]">
        <Android className="w-full">
          <FeatureMock pageId={pageId} variant="mobile" />
        </Android>
      </div>
    </div>
  );
}
