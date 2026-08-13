import { Android } from "@/components/magicui/android";
import { Safari } from "@/components/magicui/safari";
import { HomeMock } from "@/components/marketing/LandingMocks";

export function LandingDeviceStack() {
  return (
    <div className="relative mx-auto w-full max-w-5xl pb-[18%] md:pb-[12%]">
      <div className="w-[82%]">
        <Safari url="pluclair.com" className="w-full">
          <HomeMock variant="web" />
        </Safari>
      </div>
      <div className="absolute right-[2%] bottom-0 z-20 w-[34%] min-w-[7.5rem] max-w-[16rem] drop-shadow-xl sm:max-w-[18rem]">
        <Android className="w-full">
          <HomeMock variant="mobile" />
        </Android>
      </div>
    </div>
  );
}
