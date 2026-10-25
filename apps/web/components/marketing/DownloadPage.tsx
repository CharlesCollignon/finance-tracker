import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  AndroidLogo,
  AppleLogo,
  ArrowRight,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import { renderSVG } from "uqr";
import { CHANGELOG } from "@finance/core/changelog-entries";
import type { Locale } from "@finance/core/i18n/locale";
import { SOURCE_URL, aboutCopyFor } from "@/components/marketing/about-copy";
import {
  CTA_BASE,
  CTA_QUIET,
  CTA_SIZES,
  CTA_SOLID,
} from "@/components/marketing/cta-classes";
import { DownloadPhone } from "@/components/marketing/download/DownloadPhone";
import { IphoneHomeScreen } from "@/components/marketing/download/IphoneHomeScreen";
import {
  IPHONE_SECTION_ID,
  downloadCopyFor,
  type DownloadCopy,
} from "@/components/marketing/download-copy";
import {
  FadeUp,
  Questions,
  RiseLines,
  RiseWords,
} from "@/components/marketing/LandingReveal";
import { LiveStatus } from "@/components/marketing/LiveStatus";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import {
  NOUVEAUTES_HREF,
  nouveautesEntryHref,
} from "@/components/marketing/nouveautes-copy";
import { getLocale } from "@/lib/locale";
import {
  ANDROID_DOWNLOAD_PATH,
  IOS_DOWNLOAD_PATH,
  iosApp,
  isIphone,
  latestApkRelease,
  storeLinks,
  type ApkRelease,
  type IosApp,
} from "@/lib/store-links";
import { getSiteUrl } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

/** How many of the phone's latest changes the page lists. */
const LATEST = 4;

/** Where the iPhone's first step opens Pluclair: Le point, or the login. */
const IPHONE_OPEN_PATH = "/bearing";

/**
 * Where the Android app is had: the file, a QR code to fetch it from a
 * computer, the three steps a file from outside a store needs, what is new
 * on the phone, and how to check the file is the one published. And the
 * iPhone, which has no file to download: Pluclair on its home screen from
 * Safari, and the iPhone app through `/ios` once it is on TestFlight or the
 * App Store (`iosApp`).
 *
 * Everything about the file — version, size, day, fingerprint — is read from
 * its GitHub release (`latestApkRelease`), so a new APK changes the page by
 * itself. The download goes through `/android`, which follows the file
 * wherever it is hosted. Without an APK there is nothing to download: the
 * page is not found, and nothing on the site links to it.
 *
 * On an iPhone, told by its User-Agent, the hero offers the iPhone's way in
 * place of an APK it cannot open, and the iPhone's steps come first.
 */
export async function DownloadPage({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (!storeLinks().androidApk) {
    notFound();
  }
  const [locale, request] = await Promise.all([getLocale(), headers()]);
  const iphone = isIphone(request.get("user-agent"));
  const ios = iosApp();
  const copy = downloadCopyFor(locale);
  const steps = aboutCopyFor(locale).beta.steps;
  const release = await latestApkRelease();
  const latest = CHANGELOG.filter((entry) =>
    entry.platforms.includes("phone"),
  ).slice(0, LATEST);
  // Dark on light, whatever the page: phone cameras read a QR code best so.
  // The standard four modules of margin, which the card's rounded corners
  // eat into: with one, they clipped the finder squares and nothing read it.
  const qr = renderSVG(`${getSiteUrl()}${ANDROID_DOWNLOAD_PATH}`, {
    border: 4,
    blackColor: "#0a0a10",
    whiteColor: "#f4f1ea",
  });
  const web = isLoggedIn
    ? { href: "/bearing", label: copy.hero.openApp }
    : { href: "/signup", label: copy.hero.web };
  const iphoneWay = copy.hero.iphone[ios?.kind ?? "homeScreen"];
  const primary = iphone
    ? {
        href: ios ? IOS_DOWNLOAD_PATH : `#${IPHONE_SECTION_ID}`,
        label: iphoneWay.cta,
        Icon: AppleLogo,
      }
    : {
        href: ANDROID_DOWNLOAD_PATH,
        label: copy.hero.download,
        Icon: AndroidLogo,
      };

  const androidSteps = (
    <section key="android" className="relative px-6 pb-24 md:pb-32">
      <div className="mx-auto max-w-6xl">
        <RiseWords
          text={copy.stepsHeading}
          className="marketing-display text-display-sub"
        />
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step}>
              <FadeUp delay={0.1 + index * 0.08} className="h-full">
                <div className="glass-flat flex h-full flex-col gap-4 rounded-[1.5rem] p-6">
                  <StepNumber>{index + 1}</StepNumber>
                  <p className="text-sm leading-relaxed text-marketing-muted">
                    {step}
                  </p>
                </div>
              </FadeUp>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
  const iphoneSteps = (
    <IphoneSection
      key="iphone"
      copy={copy.iphone}
      ios={ios}
      onIphone={iphone}
    />
  );

  return (
    <article className="relative isolate overflow-x-clip">
      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate px-6 pb-20 pt-32 md:pb-28 md:pt-40">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem]"
          aria-hidden
        >
          <div className="marketing-sparks absolute inset-0 opacity-60" />
        </div>
        <div className="mx-auto grid max-w-6xl items-center gap-14 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-16">
          <div className="min-w-0">
            <FadeUp trigger="mount" delay={0.1}>
              <LiveStatus label={copy.hero.eyebrow} />
            </FadeUp>
            <RiseLines
              lines={copy.hero.titleLines}
              className="marketing-display mt-8 text-display-hero"
              delay={0.25}
            />
            <FadeUp trigger="mount" delay={0.8}>
              <p className="mt-6 max-w-xl text-[0.975rem] leading-relaxed text-marketing-muted sm:text-lg">
                {iphone ? copy.hero.iphone.body : copy.hero.body}
              </p>
            </FadeUp>
            <FadeUp trigger="mount" delay={1}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={primary.href}
                  className={cn(
                    CTA_BASE,
                    CTA_SIZES.lg,
                    CTA_SOLID,
                    "marketing-cta-shine gap-2.5",
                  )}
                >
                  <primary.Icon size={20} weight="fill" aria-hidden />
                  {primary.label}
                </a>
                <Link
                  href={web.href}
                  className={cn(
                    CTA_BASE,
                    CTA_SIZES.lg,
                    CTA_QUIET,
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
                {iphone ? (
                  iphoneWay.facts
                ) : (
                  <>
                    {fileFacts(release, locale, copy.hero)}
                    <span aria-hidden> · </span>
                    <a
                      href={`#${IPHONE_SECTION_ID}`}
                      className={cn(
                        "rounded-control text-marketing-muted underline underline-offset-4 transition-colors duration-hover hover:text-white",
                        marketingFocus,
                      )}
                    >
                      {copy.hero.iphoneLink}
                    </a>
                  </>
                )}
              </p>
            </FadeUp>

            {/* From a computer, the file is no use where it lands: the code
                takes the download to the phone. Not drawn on a phone. */}
            <FadeUp trigger="mount" delay={1.2} className="hidden md:block">
              <div className="glass-flat mt-10 flex max-w-md items-center gap-5 rounded-[1.5rem] p-4">
                <div
                  role="img"
                  aria-label={copy.qr.label}
                  className="size-28 shrink-0 overflow-hidden rounded-xl [&>svg]:size-full"
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
                <div>
                  <p className="font-head text-base text-marketing-ink">
                    {copy.qr.heading}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-marketing-muted">
                    {copy.qr.body}
                  </p>
                </div>
              </div>
            </FadeUp>
          </div>

          <DownloadPhone />
        </div>
      </section>

      {/* ---------------------------------------------- steps, each phone */}
      {iphone ? [iphoneSteps, androidSteps] : [androidSteps, iphoneSteps]}

      {/* ---------------------------------------------------------- latest */}
      {latest.length > 0 ? (
        <section className="relative px-6 pb-24 md:pb-32">
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
            <div>
              <RiseWords
                text={copy.latest.heading}
                className="marketing-display text-display-sub"
              />
              <FadeUp delay={0.1}>
                <Link
                  href={NOUVEAUTES_HREF}
                  className={cn(
                    "group mt-6 inline-flex items-center gap-2 rounded-control text-sm text-marketing-muted underline underline-offset-4 transition-colors duration-hover hover:text-white",
                    marketingFocus,
                  )}
                >
                  {copy.latest.all}
                  <ArrowRight
                    size={14}
                    aria-hidden
                    className="transition-transform duration-hover group-hover:translate-x-0.5"
                  />
                </Link>
              </FadeUp>
            </div>
            <ul className="divide-y divide-white/10 border-y border-white/10">
              {latest.map((entry, index) => (
                <li key={entry.id}>
                  <FadeUp delay={0.1 + index * 0.06}>
                    <Link
                      href={nouveautesEntryHref(entry.id)}
                      className={cn(
                        "group block rounded-control py-5",
                        marketingFocus,
                      )}
                    >
                      <p className="flex items-center justify-between gap-4 font-head text-lg text-marketing-ink">
                        {entry[locale].title}
                        <ArrowRight
                          size={16}
                          aria-hidden
                          className="shrink-0 text-primary transition-transform duration-hover group-hover:translate-x-1"
                        />
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-marketing-muted">
                        {entry[locale].body}
                      </p>
                    </Link>
                  </FadeUp>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------- faq */}
      <section className="relative px-6 pb-28 md:pb-36">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
          <RiseWords
            text={copy.faq.heading}
            className="marketing-display text-display-sub"
          />
          <div className="flex flex-col gap-10">
            <FadeUp delay={0.15}>
              <Questions items={copy.faq.items} />
            </FadeUp>
            {release?.sha256 ? (
              <FadeUp delay={0.2}>
                <div className="glass-flat rounded-[1.5rem] p-6">
                  <p className="flex items-center gap-2 font-head text-base text-marketing-ink">
                    <ShieldCheck
                      size={18}
                      weight="fill"
                      aria-hidden
                      className="text-primary"
                    />
                    {copy.verify.heading}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-marketing-muted">
                    {copy.verify.body}
                  </p>
                  <p className="mt-3 break-all font-mono text-xs leading-relaxed text-marketing-ink/80">
                    {release.sha256}
                  </p>
                  <a
                    href={`${SOURCE_URL}/releases`}
                    rel="noopener"
                    className={cn(
                      "mt-4 inline-block rounded-control text-sm text-marketing-muted underline underline-offset-4 transition-colors duration-hover hover:text-white",
                      marketingFocus,
                    )}
                  >
                    {copy.verify.releases}
                  </a>
                </div>
              </FadeUp>
            ) : null}
          </div>
        </div>
      </section>
    </article>
  );
}

/** A step's number, in a ring. */
function StepNumber({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/40 font-head text-sm text-primary tabular-nums"
    >
      {children}
    </span>
  );
}

/**
 * The iPhone: its app through `/ios` when there is one, and the three
 * gestures that put Pluclair on its home screen from Safari — beside a
 * phone that shows them. Read on the iPhone itself, the first gesture is a
 * button; on a computer, a QR code opens Pluclair on the iPhone instead.
 */
function IphoneSection({
  copy,
  ios,
  onIphone,
}: {
  copy: DownloadCopy["iphone"];
  ios: IosApp | null;
  onIphone: boolean;
}) {
  const app = ios ? copy[ios.kind] : null;
  const qr = onIphone
    ? null
    : renderSVG(`${getSiteUrl()}${IPHONE_OPEN_PATH}`, {
        border: 4,
        blackColor: "#0a0a10",
        whiteColor: "#f4f1ea",
      });
  return (
    <section
      id={IPHONE_SECTION_ID}
      className="relative scroll-mt-24 px-6 pb-24 md:pb-32"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-14 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
        <FadeUp className="order-last md:order-first">
          <IphoneHomeScreen copy={copy.screen} />
        </FadeUp>
        <div className="min-w-0">
          <RiseWords
            text={copy.heading}
            className="marketing-display text-display-sub"
          />
          {ios && app ? (
            <FadeUp delay={0.1}>
              <div className="glass-flat mt-8 max-w-xl rounded-[1.5rem] p-6">
                <p className="flex items-center gap-2 font-head text-base text-marketing-ink">
                  <AppleLogo
                    size={18}
                    weight="fill"
                    aria-hidden
                    className="text-primary"
                  />
                  {app.heading}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-marketing-muted">
                  {app.body}
                </p>
                <a
                  href={IOS_DOWNLOAD_PATH}
                  className={cn(
                    CTA_BASE,
                    CTA_SIZES.md,
                    CTA_SOLID,
                    "mt-5 gap-2",
                  )}
                >
                  <AppleLogo size={18} weight="fill" aria-hidden />
                  {"join" in app ? app.join : app.download}
                </a>
              </div>
            </FadeUp>
          ) : null}
          <FadeUp delay={0.15}>
            <p className="mt-6 max-w-xl text-[0.975rem] leading-relaxed text-marketing-muted">
              {ios ? copy.orHomeScreen : copy.homeScreenOnly}
            </p>
          </FadeUp>
          <ol className="mt-8 flex max-w-xl flex-col gap-5">
            {copy.steps.map((step, index) => (
              <li key={step}>
                <FadeUp delay={0.2 + index * 0.08} className="flex gap-4">
                  <StepNumber>{index + 1}</StepNumber>
                  <p className="pt-1.5 text-sm leading-relaxed text-marketing-muted">
                    {step}
                  </p>
                </FadeUp>
              </li>
            ))}
          </ol>
          {qr ? (
            // From a computer, a QR code takes Pluclair to the iPhone. Not
            // drawn on a phone, where it could not be scanned.
            <FadeUp delay={0.45} className="hidden md:block">
              <div className="glass-flat mt-10 flex max-w-md items-center gap-5 rounded-[1.5rem] p-4">
                <div
                  role="img"
                  aria-label={copy.qr.label}
                  className="size-28 shrink-0 overflow-hidden rounded-xl [&>svg]:size-full"
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
                <div>
                  <p className="font-head text-base text-marketing-ink">
                    {copy.qr.heading}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-marketing-muted">
                    {copy.qr.body}
                  </p>
                </div>
              </div>
            </FadeUp>
          ) : (
            <FadeUp delay={0.45}>
              <Link
                href={IPHONE_OPEN_PATH}
                className={cn(
                  CTA_BASE,
                  CTA_SIZES.md,
                  CTA_QUIET,
                  "group mt-8 gap-2",
                )}
              >
                {copy.open}
                <ArrowRight
                  size={16}
                  aria-hidden
                  className="transition-transform duration-hover group-hover:translate-x-0.5"
                />
              </Link>
            </FadeUp>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * « Version 1.3.0 · 109 Mo · 25 octobre 2026 · Gratuit, sans store », as
 * much of it as the release says.
 */
function fileFacts(
  release: ApkRelease | null,
  locale: Locale,
  copy: { version: string; free: string },
): string {
  const tag = locale === "en" ? "en-GB" : "fr-FR";
  const facts: string[] = [];
  if (release) {
    facts.push(copy.version.replace("{version}", release.version));
    if (release.sizeBytes) {
      const megabytes = new Intl.NumberFormat(tag, {
        maximumFractionDigits: 0,
      }).format(release.sizeBytes / (1024 * 1024));
      facts.push(`${megabytes} ${locale === "en" ? "MB" : "Mo"}`);
    }
    if (release.publishedOn) {
      facts.push(
        new Intl.DateTimeFormat(tag, {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${release.publishedOn}T12:00:00Z`)),
      );
    }
  }
  facts.push(copy.free);
  return facts.join(" · ");
}
