/* Hallmark · genre: atmospheric · macrostructure: Letter (scroll-told) · theme: design.md (Pluclair) · enrichment: portrait in the bezel, orb until the photo · nav: kept · footer: kept */

import type { ReactNode } from "react";
import {
  ArrowUpRight,
  EnvelopeSimple,
  GithubLogo,
} from "@phosphor-icons/react/dist/ssr";
import type { Locale } from "@finance/core/i18n/locale";
import { getLocale } from "@/lib/locale";
import { ANDROID_DOWNLOAD_PATH, storeLinks } from "@/lib/store-links";
import { aboutCopyFor, SOURCE_URL } from "@/components/marketing/about-copy";
import { AboutHero } from "@/components/marketing/about/AboutHero";
import { Bill } from "@/components/marketing/about/Bill";
import { Hats } from "@/components/marketing/about/Hats";
import { Run } from "@/components/marketing/about/Run";
import { TryBeta } from "@/components/marketing/about/TryBeta";
import { PromiseSection } from "@/components/marketing/landing/PromiseSection";
import { FadeUp, RiseWords } from "@/components/marketing/LandingReveal";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

/**
 * The owner's photo, once it is in `public/` (4:5, say
 * `public/about/charles.jpg`), as its path. Null until then, and the
 * portrait's frame holds the orb instead.
 */
const PORTRAIT: string | null = null;

/**
 * Who makes Pluclair, told as a letter the page is scrolled through: a
 * greeting and a portrait, why it exists lit word by word, the letter
 * itself, the three trades lit one at a time, the run from the first line of
 * code to the beta drawn down the page, the bill rolling to 0, and the
 * beta to try. See the Motion section of DESIGN.md.
 */
export async function AboutPage({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <AboutView
      locale={await getLocale()}
      isLoggedIn={isLoggedIn}
      portrait={PORTRAIT}
      apkHref={storeLinks().androidApk ? ANDROID_DOWNLOAD_PATH : null}
      email={feedbackEmail()}
    />
  );
}

/** The page itself, from what the request decided. */
function AboutView({
  locale,
  isLoggedIn,
  portrait,
  apkHref,
  email,
}: {
  locale: Locale;
  isLoggedIn: boolean;
  portrait: string | null;
  apkHref: string | null;
  email: string | null;
}) {
  const copy = aboutCopyFor(locale);

  return (
    <article className="relative isolate overflow-x-clip">
      <AboutHero copy={copy.hero} portrait={portrait} />

      <PromiseSection text={copy.why} />

      {/* ---------------------------------------------------------- letter */}
      {/* A letter's measure: one narrow column, the prose a size up from
          the rest of the site, signed. */}
      <section className="relative px-6 py-24 md:py-32">
        <div className="mx-auto max-w-[38rem]">
          <RiseWords
            text={copy.letter.heading}
            className="marketing-display text-display-sub"
          />
          <div className="mt-10 flex flex-col gap-6">
            {copy.letter.paragraphs.map((paragraph, index) => (
              <FadeUp key={paragraph} delay={index * 0.06}>
                <p className="text-lg leading-relaxed text-marketing-muted md:text-xl">
                  {paragraph}
                </p>
              </FadeUp>
            ))}
          </div>
          <FadeUp delay={0.1}>
            <p className="marketing-display mt-12 text-display-sub">
              {copy.letter.signature}
            </p>
          </FadeUp>
        </div>
      </section>

      <Hats copy={copy.hats} />

      <Run copy={copy.run} />

      <Bill copy={copy.bill} euroFirst={locale === "en"} />

      <TryBeta copy={copy.beta} apkHref={apkHref} isLoggedIn={isLoggedIn} />

      {/* ------------------------------------------------------- elsewhere */}
      <section className="relative px-6 pb-28 md:pb-36">
        <div className="mx-auto max-w-6xl">
          <RiseWords
            text={copy.elsewhere.heading}
            className="marketing-display text-display-sub"
          />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            <li>
              <FadeUp>
                <Elsewhere
                  href={SOURCE_URL}
                  title={copy.elsewhere.source.title}
                  detail={copy.elsewhere.source.detail}
                  icon={<GithubLogo size={22} aria-hidden />}
                />
              </FadeUp>
            </li>
            {email ? (
              <li>
                <FadeUp delay={0.08}>
                  <Elsewhere
                    href={`mailto:${email}`}
                    title={copy.elsewhere.write.title}
                    detail={email}
                    icon={<EnvelopeSimple size={22} aria-hidden />}
                  />
                </FadeUp>
              </li>
            ) : null}
          </ul>
        </div>
      </section>
    </article>
  );
}

/** The address « Envoyer un retour » writes to, if the deployment has one. */
function feedbackEmail(): string | null {
  const value = process.env.FEEDBACK_EMAIL?.trim();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

function Elsewhere({
  href,
  title,
  detail,
  icon,
}: {
  href: string;
  title: string;
  detail: string;
  icon: ReactNode;
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "glass-flat glass-flat-hover group flex min-h-24 items-center gap-5 rounded-[1.75rem] p-6",
        marketingFocus,
      )}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/12 text-marketing-ink">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-head text-lg text-marketing-ink">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-sm text-marketing-muted">
          {detail}
        </span>
      </span>
      <ArrowUpRight
        size={18}
        aria-hidden
        className="shrink-0 text-marketing-muted transition-transform duration-hover group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
      />
    </a>
  );
}
