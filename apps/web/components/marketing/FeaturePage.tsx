import Link from "next/link";
import { LandingBloom } from "@/components/marketing/LandingOrb";
import { LandingCtas } from "@/components/marketing/LandingCtas";
import { LandingDeviceStack } from "@/components/marketing/LandingDeviceStack";
import { Reveal, Rise } from "@/components/marketing/LandingReveal";
import {
  adjacentLandingPages,
  featureHref,
  getLandingPage,
  type LandingPageId,
} from "@/components/marketing/landing-copy";

interface FeaturePageProps {
  pageId: LandingPageId;
  isLoggedIn: boolean;
}

export function FeaturePage({ pageId, isLoggedIn }: FeaturePageProps) {
  const page = getLandingPage(pageId);
  const { prev, next } = adjacentLandingPages(pageId);

  return (
    // overflow-x-clip, not hidden: the bloom below is 36rem wide and centred,
    // so on a phone it reaches 93px past the right edge and drags the whole
    // document into horizontal scroll. `clip` contains it without making the
    // article a scroll container.
    <article className="relative isolate overflow-x-clip">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem]"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_-10%,rgba(120,130,170,0.1),transparent_60%)]" />
        <div className="marketing-sparks absolute inset-0 opacity-70" />
      </div>
      <LandingBloom className="left-1/2 top-[16rem] h-[36rem] w-[36rem] -translate-x-1/2 opacity-35" />

      <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-32 md:pb-28 md:pt-40">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h1 className="marketing-display text-[clamp(2.1rem,6vw,3.5rem)]">
            {page.title}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-white/55 md:text-lg">
            {page.utility}
          </p>
          <LandingCtas
            isLoggedIn={isLoggedIn}
            size="lg"
            layout="solo"
            className="mt-8 justify-center"
          />
        </Reveal>

        <Rise className="mt-16 md:mt-20">
          <LandingDeviceStack pageId={pageId} />
        </Rise>

        <ol className="glass-grid mt-16 grid gap-px overflow-hidden rounded-2xl md:mt-20 md:grid-cols-3">
          {page.steps.map((step, index) => (
            <li key={step.title} className="p-7 md:p-8">
              <Reveal delay={index * 0.06}>
                <span className="font-mono text-xs text-primary/70">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-3 font-head text-lg text-white">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  {step.body}
                </p>
              </Reveal>
            </li>
          ))}
        </ol>

        <nav
          className="mt-14 flex items-stretch gap-3 sm:gap-4"
          aria-label="Nearby pages"
        >
          {prev ? (
            <Link
              href={featureHref(prev.id)}
              className="glass-flat glass-flat-hover flex flex-1 flex-col items-start rounded-2xl px-5 py-4"
            >
              <span className="text-xs uppercase tracking-[0.14em] text-white/35">
                Previous
              </span>
              <span className="mt-1 text-sm font-medium text-white">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {next ? (
            <Link
              href={featureHref(next.id)}
              className="glass-flat glass-flat-hover flex flex-1 flex-col items-end rounded-2xl px-5 py-4 text-right"
            >
              <span className="text-xs uppercase tracking-[0.14em] text-white/35">
                Next
              </span>
              <span className="mt-1 text-sm font-medium text-white">
                {next.title}
              </span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </nav>
      </div>
    </article>
  );
}
