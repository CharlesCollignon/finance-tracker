import { LandingCtas } from "@/components/marketing/LandingHeader";
import { LandingDeviceStack } from "@/components/marketing/LandingDeviceStack";
import { LandingHowItWorks } from "@/components/marketing/LandingMocks";
import { landingCopy } from "@/components/marketing/landing-copy";
import { Logo } from "@/components/layout/Logo";

interface LandingPageProps {
  isLoggedIn: boolean;
}

export function LandingPage({ isLoggedIn }: LandingPageProps) {
  return (
    <>
      <section className="relative flex min-h-dvh flex-col items-center justify-center px-6">
        <div className="page-enter relative z-10 flex w-full max-w-md flex-col items-center text-center">
          <Logo size="hero" />
          <p className="mt-4 max-w-sm text-base text-muted-foreground sm:text-lg">
            {landingCopy.hero.tagline}
          </p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {landingCopy.hero.sub}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <LandingCtas isLoggedIn={isLoggedIn} size="md" layout="block" />
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 pb-20">
        <LandingDeviceStack />
      </section>

      <section className="relative z-10 px-6 py-20 md:py-28">
        <LandingHowItWorks />
      </section>
    </>
  );
}
