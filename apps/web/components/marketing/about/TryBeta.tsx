import Link from "next/link";
import {
  AndroidLogo,
  ArrowRight,
  DeviceMobile,
} from "@phosphor-icons/react/dist/ssr";
import type { AboutCopy } from "@/components/marketing/about-copy";
import {
  CTA_BASE,
  CTA_QUIET,
  CTA_SIZES,
  CTA_SOLID,
} from "@/components/marketing/cta-classes";
import { LandingBloom } from "@/components/marketing/LandingOrb";
import { FadeUp, RiseWords } from "@/components/marketing/LandingReveal";
import { cn } from "@/lib/utils";

/**
 * Where to try the beta: the Android download first, the web beside it, and
 * how to install a file that does not come from a store, in three steps.
 * `#android` is what the landing's phone section links to.
 *
 * Without an APK set (`ANDROID_APK_URL`), the web is the one button and the
 * Android app is said to be on its way, in the future tense, as the landing
 * says what is not open yet.
 */
export function TryBeta({
  copy,
  apkHref,
  isLoggedIn,
}: {
  copy: AboutCopy["beta"];
  apkHref: string | null;
  isLoggedIn: boolean;
}) {
  const web = isLoggedIn
    ? { href: "/bearing", label: copy.openApp }
    : { href: "/signup", label: copy.web };

  return (
    <section
      id="android"
      className="relative isolate scroll-mt-24 overflow-x-clip px-6 py-24 md:py-36"
    >
      <LandingBloom className="left-[62%] top-1/2 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 opacity-40" />
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] md:gap-16">
        <div>
          <RiseWords
            text={copy.heading}
            className="marketing-display text-display-section"
          />
          <FadeUp delay={0.1}>
            <p className="mt-6 max-w-md text-base leading-relaxed text-marketing-muted">
              {copy.body}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {apkHref ? (
                <a
                  href={apkHref}
                  className={cn(CTA_BASE, CTA_SIZES.lg, CTA_SOLID, "gap-2.5")}
                >
                  <AndroidLogo size={20} weight="fill" aria-hidden />
                  {copy.download}
                </a>
              ) : null}
              <Link
                href={web.href}
                className={cn(
                  CTA_BASE,
                  CTA_SIZES.lg,
                  apkHref ? CTA_QUIET : CTA_SOLID,
                  "group gap-2",
                )}
              >
                {web.label}
                <ArrowRight
                  size={16}
                  aria-hidden
                  className="transition-transform duration-hover group-hover:translate-x-0.5"
                />
              </Link>
            </div>
            <p className="mt-4 text-sm text-marketing-faint">
              {apkHref ? copy.downloadMeta : copy.notYet}
            </p>
          </FadeUp>
        </div>

        {apkHref ? (
          <FadeUp delay={0.2}>
            <div className="glass-flat rounded-[1.75rem] p-6 md:p-8">
              <h3 className="font-head text-lg text-marketing-ink">
                {copy.stepsHeading}
              </h3>
              <ol className="mt-5 flex flex-col gap-5">
                {copy.steps.map((step, index) => (
                  <li key={step} className="flex gap-4">
                    <span
                      aria-hidden
                      className="grid size-7 shrink-0 place-items-center rounded-full border border-white/16 text-xs font-medium text-marketing-ink tabular-nums"
                    >
                      {index + 1}
                    </span>
                    <p className="pt-0.5 text-sm leading-relaxed text-marketing-muted">
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
              <p className="mt-6 flex gap-3 border-t border-white/10 pt-5 text-sm leading-relaxed text-marketing-faint">
                <DeviceMobile
                  size={18}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-marketing-muted"
                />
                {copy.iphone}
              </p>
            </div>
          </FadeUp>
        ) : null}
      </div>
    </section>
  );
}
