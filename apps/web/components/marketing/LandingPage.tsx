import { formatEuro } from "@finance/core/constants";
import {
  ArrowsLeftRight,
  CalendarBlank,
  ChartLine,
  ChartPieSlice,
  Repeat,
  ScalesIcon,
  Target,
} from "@phosphor-icons/react/dist/ssr";
import { LandingBloom, LandingOrb } from "@/components/marketing/LandingOrb";
import { LandingCtas } from "@/components/marketing/LandingCtas";
import { LandingDeviceStack } from "@/components/marketing/LandingDeviceStack";
import { Reveal, Rise } from "@/components/marketing/LandingReveal";
import { GlassLink, GlassStat } from "@/components/marketing/LandingGlass";
import {
  featureHref,
  landingCopy,
  type LandingPageId,
} from "@/components/marketing/landing-copy";
import { landingSample } from "@/components/marketing/landing-sample";

interface LandingPageProps {
  isLoggedIn: boolean;
}

/** One icon per feature card. Phosphor's /dist/ssr entry so a grid of static
 * glyphs does not make this whole page a client component. */
const FEATURE_ICONS: Record<LandingPageId, React.ReactNode> = {
  home: <ChartPieSlice size={18} />,
  transactions: <ArrowsLeftRight size={18} />,
  recurring: <Repeat size={18} />,
  calendar: <CalendarBlank size={18} />,
  wallets: <ChartLine size={18} />,
  planning: <Target size={18} />,
  "month-close": <ScalesIcon size={18} />,
};

/** Twelve months of unrecorded spending, as fractions of the worst one. The
 * shape is the point — it settles as the habit takes — not the values. */
const UNRECORDED_TREND = [
  0.95, 0.82, 0.88, 0.7, 0.74, 0.58, 0.62, 0.48, 0.52, 0.4, 0.44, 0.34,
] as const;
const KEPT_TREND = [0.3, 0.38, 0.34, 0.45, 0.52, 0.48, 0.6, 0.66] as const;

function SectionHeading({
  heading,
  body,
  align = "center",
}: {
  heading: string;
  body?: string;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  return (
    <div
      className={
        centered
          ? "mx-auto flex max-w-2xl flex-col items-center text-center"
          : "flex max-w-xl flex-col items-start text-left"
      }
    >
      <h2 className="marketing-display text-[clamp(1.75rem,4vw,2.75rem)]">
        {heading}
      </h2>
      {body ? (
        <p className="mt-4 text-base leading-relaxed text-white/50">{body}</p>
      ) : null}
    </div>
  );
}

export function LandingPage({ isLoggedIn }: LandingPageProps) {
  const {
    hero,
    pillars,
    devices,
    features,
    monthClose,
    how,
    privacy,
    finalCta,
  } = landingCopy;
  const { close } = landingSample;

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate flex min-h-dvh flex-col overflow-hidden px-6">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          {/* A cool wash from the top edge, so the gold below has something to
              be warm against. */}
          <div className="absolute inset-0 bg-[radial-gradient(130%_75%_at_50%_-15%,rgba(120,130,170,0.12),transparent_58%)]" />
          <div className="marketing-sparks absolute inset-x-0 top-0 h-[70%] opacity-80" />
        </div>

        <div className="page-enter relative z-20 mx-auto flex w-full max-w-3xl flex-col items-center pt-[calc(8rem+1vh)] text-center md:pt-[calc(8.5rem+2vh)]">
          <h1 className="marketing-display text-[clamp(2.4rem,8vw,5rem)]">
            {hero.titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-6 max-w-xl text-[0.975rem] leading-relaxed text-white/55 sm:text-lg">
            {hero.tagline}
          </p>
          <LandingCtas
            isLoggedIn={isLoggedIn}
            size="lg"
            className="mt-9 justify-center"
          />
        </div>

        {/* The stage.
            Width is capped well inside the page so the two cards, pinned to
            its edges, actually overlap the sphere — a glass panel floating on
            bare ground has nothing to blur and stops reading as glass. The
            whole sphere shows, resting on the section's bottom edge: at the
            reference's proportions a sharp orb cropped in half stops reading
            as an object and starts reading as a sunrise. */}
        <div className="relative z-10 mx-auto mt-4 min-h-[17.5rem] w-full max-w-3xl flex-1 sm:min-h-[19rem] md:min-h-[20.5rem]">
          <LandingOrb className="absolute left-1/2 top-1 aspect-square w-[min(58vw,352px)] -translate-x-1/2" />

          <GlassStat
            href={featureHref("home")}
            label={hero.cards.remaining.label}
            value={formatEuro(landingSample.remaining)}
            caption={hero.cards.remaining.caption}
            meter={landingSample.remaining / landingSample.income}
            className="absolute left-0 top-5 z-10 w-[13.5rem] sm:top-6 sm:w-[15.5rem]"
          />

          <GlassStat
            href={featureHref("month-close")}
            label={hero.cards.unrecorded.label}
            value={formatEuro(close.unrecorded)}
            caption={hero.cards.unrecorded.caption}
            spark={UNRECORDED_TREND}
            className="absolute bottom-5 right-0 z-10 hidden w-[15.5rem] sm:block"
          />

          {/* Hands the sphere off to the next section instead of ending on a
              hard cut through it. It lives inside the stage, between the orb
              and the cards, so it softens the artwork without also greying
              out the figures floating over it. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-[var(--marketing-ground)]"
            aria-hidden
          />
        </div>
      </section>

      {/* --------------------------------------------------------- pillars */}
      <section className="relative px-6 py-20 md:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="marketing-rule" />
          </Reveal>
          <Reveal className="mt-10">
            <h2 className="text-center font-head text-sm font-medium uppercase tracking-[0.18em] text-white/40">
              {pillars.heading}
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {pillars.items.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.08}>
                <p className="font-mono text-xs text-primary/70">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 font-head text-lg text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  {item.body}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- devices */}
      <section className="relative overflow-hidden px-6 pb-24 pt-4 md:pb-32">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading heading={devices.heading} body={devices.body} />
          </Reveal>
          <Rise className="mt-16 md:mt-20">
            <LandingDeviceStack pageId="home" />
          </Rise>
        </div>
      </section>

      {/* -------------------------------------------------------- features */}
      <section id="features" className="relative px-6 pb-24 md:pb-32">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading heading={features.heading} body={features.body} />
          </Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {landingCopy.pages.map((page, index) => (
              <Reveal
                key={page.id}
                delay={Math.min(index, 5) * 0.05}
                // Seven cards over three columns would leave the last row
                // holding one. The wide slot goes to the one screen no
                // competitor has.
                className={
                  page.id === "month-close"
                    ? "sm:col-span-2 lg:col-span-3"
                    : undefined
                }
              >
                <GlassLink
                  href={featureHref(page.id)}
                  title={page.title}
                  body={page.body}
                  icon={FEATURE_ICONS[page.id]}
                  className="h-full"
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- month close */}
      <section className="relative isolate overflow-hidden px-6 py-24 md:py-32">
        <LandingBloom className="left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 opacity-45" />

        <div className="relative mx-auto grid max-w-6xl gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <Reveal>
            <SectionHeading heading={monthClose.heading} align="left" />
            <div className="mt-6 flex max-w-xl flex-col gap-4">
              {monthClose.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 24)}
                  className="text-base leading-relaxed text-white/50"
                >
                  {paragraph}
                </p>
              ))}
            </div>
            <dl className="mt-10 flex flex-col gap-6 border-t border-white/10 pt-8">
              {monthClose.outcomes.map((outcome) => (
                <div key={outcome.label} className="sm:flex sm:gap-6">
                  <dt className="w-32 shrink-0 font-mono text-xs uppercase tracking-[0.14em] text-primary/80">
                    {outcome.label}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-white/50 sm:mt-0">
                    {outcome.body}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-white/35">
              {monthClose.footnote}
            </p>
          </Reveal>

          <Rise className="flex flex-col gap-4 lg:pt-24">
            <GlassStat
              href={featureHref("month-close")}
              label={`Unrecorded in ${close.monthLabel}`}
              value={formatEuro(close.unrecorded)}
              caption={`under your ${formatEuro(close.unrecordedCap)} allowance`}
              spark={UNRECORDED_TREND}
              className="w-full"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <GlassStat
                label="Kept"
                value={formatEuro(close.kept)}
                caption={`${close.keptRate}% of what came in`}
                spark={KEPT_TREND}
                className="w-full"
              />
              <GlassStat
                label="The run"
                value={`${close.streak} months`}
                caption="in a row inside the allowance"
                meter={close.streak / 6}
                className="w-full"
              />
            </div>
            <p className="px-1 text-xs text-white/30">
              {landingCopy.exampleLabel}. Your first close sets the baseline;
              the figures start from the second.
            </p>
          </Rise>
        </div>
      </section>

      {/* ------------------------------------------------------------- how */}
      <section id="how" className="relative px-6 pb-24 md:pb-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <SectionHeading heading={how.heading} />
          </Reveal>
          <ol className="glass-grid mt-16 grid gap-px overflow-hidden rounded-2xl sm:grid-cols-2">
            {how.beats.map((beat, index) => (
              <li key={beat.title} className="p-7 md:p-8">
                <Reveal delay={index * 0.06}>
                  <span className="font-mono text-xs text-primary/70">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 font-head text-lg text-white">
                    {beat.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">
                    {beat.body}
                  </p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* --------------------------------------------------------- privacy */}
      <section id="privacy" className="relative px-6 pb-24 md:pb-32">
        <div className="mx-auto max-w-5xl">
          <div className="glass-flat overflow-hidden rounded-3xl p-8 md:p-12">
            <Reveal>
              <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-16">
                <div>
                  <h2 className="marketing-display text-[clamp(1.6rem,3.4vw,2.35rem)]">
                    {privacy.heading}
                  </h2>
                </div>
                <div>
                  <p className="text-sm leading-relaxed text-white/50">
                    {privacy.body}
                  </p>
                  <ul className="mt-6 flex flex-col gap-3">
                    {privacy.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-3 text-sm text-white/70"
                      >
                        <span
                          className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                          aria-hidden
                        />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- final cta */}
      <section className="relative isolate overflow-hidden px-6 pb-28 pt-8 md:pb-40">
        <LandingBloom className="left-1/2 top-[38%] h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 opacity-60" />
        <div
          className="marketing-sparks pointer-events-none absolute inset-0 opacity-60"
          aria-hidden
        />

        <Reveal className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="marketing-display text-[clamp(2rem,6vw,3.5rem)]">
            {finalCta.heading}
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/55">
            {finalCta.body}
          </p>
          <LandingCtas
            isLoggedIn={isLoggedIn}
            size="lg"
            className="mt-9 justify-center"
          />
        </Reveal>
      </section>
    </>
  );
}
