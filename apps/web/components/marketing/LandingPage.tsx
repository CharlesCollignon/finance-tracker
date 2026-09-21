import { formatEuro, formatPercent } from "@finance/core/constants";
import { getLocale, getT } from "@/lib/locale";
import {
  ArrowsLeftRight,
  ChartLine,
  Compass,
  Repeat,
  ScalesIcon,
  Sparkle,
  Target,
} from "@phosphor-icons/react/dist/ssr";
import { LandingBloom, LandingOrb } from "@/components/marketing/LandingOrb";
import { LandingCtas } from "@/components/marketing/LandingCtas";
import { LandingDeviceStack } from "@/components/marketing/LandingDeviceStack";
import { Reveal, Rise } from "@/components/marketing/LandingReveal";
import { GlassLink, GlassStat } from "@/components/marketing/LandingGlass";
import {
  featureHref,
  landingCopyFor,
  type LandingPageId,
} from "@/components/marketing/landing-copy";
import { landingSampleFor } from "@/components/marketing/landing-sample";

interface LandingPageProps {
  isLoggedIn: boolean;
}

/** One icon per feature card. Phosphor's /dist/ssr entry so a grid of static
 * glyphs does not make this whole page a client component.
 *
 * The first five are the glyphs `APP_NAV_ITEMS` gives those same surfaces, so
 * a visitor meets each one's mark here and finds it again in the sidebar. The
 * last two are not surfaces and have no nav entry to borrow from. */
const FEATURE_ICONS: Record<LandingPageId, React.ReactNode> = {
  bearing: <Compass size={18} />,
  ledger: <ArrowsLeftRight size={18} />,
  charges: <Repeat size={18} />,
  plan: <Target size={18} />,
  wallets: <ChartLine size={18} />,
  "month-close": <ScalesIcon size={18} />,
  "month-read": <Sparkle size={18} />,
};

/* The two sparklines that used to live here are gone rather than relocated.
   Twelve bars falling 0.95 to 0.34 and eight rising 0.30 to 0.66 were not
   illustrations of a mechanism, they were claims about an outcome — that a
   year of this drives unrecorded spending down by two thirds and more than
   doubles what you keep. Nothing has measured either, and `PRODUCT.md` says
   no benchmark may be invented, implied, or dressed up as placeholder
   content. Moving them next to the "Example data" note did not help: that
   note labels the figures, and a slope is not a figure.

   The meters that replaced them are ratios the sample month actually
   contains — 218 against a 260 allowance, 33.6% of what came in. The Run
   draws no meter at all, because `close.streak / 6` measured progress toward
   a six-month target that exists nowhere in the product. */

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
      <h2 className="marketing-display text-display-sub">{heading}</h2>
      {body ? (
        <p className="mt-4 text-base leading-relaxed text-marketing-muted">
          {body}
        </p>
      ) : null}
    </div>
  );
}

export async function LandingPage({ isLoggedIn }: LandingPageProps) {
  const t = await getT();
  // A server component, so the locale comes off the cookie rather than out of
  // context. The mocks below are client components and read it themselves.
  const locale = await getLocale();
  const copy = landingCopyFor(locale);
  const sample = landingSampleFor(locale);
  const euro = (amount: number) => formatEuro(amount, locale);
  const percent = (value: number) =>
    t("units.percent", { value: formatPercent(value, locale) });

  const {
    hero,
    pillars,
    devices,
    features,
    monthClose,
    monthRead,
    how,
    privacy,
    finalCta,
  } = copy;
  const { close } = sample;

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate flex min-h-dvh flex-col overflow-hidden px-6">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          {/* Only the sparks now. There used to be a cool wash from the top
              edge here, put in so the warm sphere had something to be warm
              against; `.marketing-ambient` is that wash since it took the
              app's violet, and two of them stacked only greyed the violet
              out. */}
          <div className="marketing-sparks absolute inset-x-0 top-0 h-[70%] opacity-80" />
        </div>

        <div className="page-enter relative z-20 mx-auto flex w-full max-w-3xl flex-col items-center pt-[calc(8rem+1vh)] text-center md:pt-[calc(8.5rem+2vh)]">
          <h1 className="marketing-display text-display-hero">
            {hero.titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-6 max-w-xl text-[0.975rem] leading-relaxed text-marketing-muted sm:text-lg">
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

          {/* Which card survives the narrow viewport, and why it is this one.
              Below 640px the stage is 327px wide and 280px tall, and two
              cards of this height pinned to opposite corners overlap by about
              thirty pixels down the middle — measured, not guessed — so one
              of them goes. It used to be the unrecorded figure, which left
              every phone showing "what's left this month" and nothing else:
              the one number every budgeting app already prints, while the
              number that is the entire reason this one exists was the one
              hidden. The order is reversed now. What is left in March is the
              figure a reader can get anywhere; what February's balance proved
              was never recorded is the figure they cannot, so it is the one
              that stays. The example-data note below the stage is one
              sentence about the sample month and labels either card. */}
          <GlassStat
            href={featureHref("bearing")}
            label={hero.cards.remaining.label}
            value={euro(sample.remaining)}
            caption={hero.cards.remaining.caption}
            meter={sample.remaining / sample.income}
            className="absolute left-0 top-6 z-10 hidden w-[15.5rem] sm:block"
          />

          <GlassStat
            href={featureHref("month-close")}
            label={hero.cards.unrecorded.label}
            value={euro(close.unrecorded)}
            caption={hero.cards.unrecorded.caption}
            className="absolute left-0 top-5 z-10 w-[13.5rem] sm:bottom-5 sm:left-auto sm:right-0 sm:top-auto sm:w-[15.5rem]"
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

        {/* The figures above the fold — two of them on a tablet and up, one
            on a phone — and neither of them anybody's. The same sentence the
            close's sample figures carry further down, because they are the
            same sample month and one wording is what keeps it from reading as
            a legal hedge attached to each card. Below the stage rather than
            inside it: the cards are pinned to the stage's corners, and a
            caption placed among them lands under whichever one the viewport
            puts there. */}
        <p className="relative z-10 mx-auto max-w-sm pb-6 text-center text-xs leading-relaxed text-marketing-faint">
          {monthClose.exampleNote}
        </p>
      </section>

      {/* --------------------------------------------------------- pillars */}
      <section className="relative px-6 py-20 md:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="marketing-rule" />
          </Reveal>
          <Reveal className="mt-10">
            <h2 className="text-center font-head text-sm font-medium uppercase tracking-[0.18em] text-marketing-faint">
              {pillars.heading}
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {pillars.items.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.08}>
                {/* The ordinal is the quietest thing in the group, so it takes
                    the quietest grey. It was `text-primary/70`, which spent
                    Lamplit Gold on a counter and spent it as a tint — the two
                    failures DESIGN.md names in the same breath, since a tint
                    of the accent is a fourth marketing grey nobody declared.
                    `marketing-faint` reads 5.31:1 on the marketing ground. */}
                <p className="font-mono text-xs text-marketing-faint">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 font-head text-lg text-marketing-ink">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-marketing-muted">
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
            <LandingDeviceStack pageId="bearing" />
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
            {copy.pages.map((page, index) => (
              <Reveal
                key={page.id}
                delay={Math.min(index, 5) * 0.05}
                // Seven cards over three columns come out as two full rows
                // and a last one holding a single card, so that last card is
                // given the whole width rather than left sitting alone in a
                // third of it. It falls to the month read, which is both the
                // one the grid leaves over and the strangest thing here: a
                // model that writes the sentences and is not allowed to write
                // the numbers in them.
                className={
                  page.id === "month-read"
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
                  className="text-base leading-relaxed text-marketing-muted"
                >
                  {paragraph}
                </p>
              ))}
            </div>
            <dl className="mt-10 flex flex-col gap-6 border-t border-white/10 pt-8">
              {monthClose.outcomes.map((outcome) => (
                <div key={outcome.label} className="sm:flex sm:gap-6">
                  {/* The term of a definition list, brighter than the body
                      beside it rather than differently coloured from it. It
                      was `text-primary/80`: an accent the outcome does not
                      earn, reached for at a tint because a weight was what the
                      hierarchy actually wanted. Ink over muted is that weight,
                      and 14.43:1 against the marketing ground. */}
                  <dt className="w-32 shrink-0 font-mono text-xs uppercase tracking-[0.14em] text-marketing-ink">
                    {outcome.label}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-marketing-muted sm:mt-0">
                    {outcome.body}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-marketing-faint">
              {monthClose.footnote}
            </p>
          </Reveal>

          <Rise className="flex flex-col gap-4 lg:pt-24">
            <GlassStat
              href={featureHref("month-close")}
              label={t("marketingStat.unrecordedIn", {
                month: close.monthLabel,
              })}
              value={euro(close.unrecorded)}
              caption={t("marketingStat.underAllowance", {
                amount: euro(close.unrecordedCap),
              })}
              meter={close.unrecorded / close.unrecordedCap}
              className="w-full"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <GlassStat
                label={t("common.kept")}
                value={euro(close.kept)}
                caption={t("marketingStat.ofWhatCameIn", {
                  percent: percent(close.keptRate),
                })}
                meter={close.keptRate / 100}
                className="w-full"
              />
              <GlassStat
                label={t("common.theRun")}
                value={t("marketingStat.monthsValue", { count: close.streak })}
                caption={t("marketingStat.inARowInsideAllowance")}
                className="w-full"
              />
            </div>
            <p className="px-1 text-xs text-marketing-faint">
              {copy.monthClose.exampleNote}
            </p>
          </Rise>
        </div>
      </section>

      {/* ------------------------------------------------------ month read */}
      {/* After the close, because it is the close's figures it has the most to
          say about — and because the order on the page is the order in the
          app: measure first, then read what the measurement came to. */}
      {/* overflow-x-clip for the same reason `FeaturePage` gives: the device
          stack's bloom reaches 48px past each of its edges, and on a phone
          that is 24px of horizontal scroll across the whole document. The
          devices section above already contains its copy of the same stack;
          this one did not, which is why the landing page was the only
          marketing page that scrolled sideways. */}
      <section
        id="read"
        className="relative overflow-x-clip px-6 pb-24 md:pb-32"
      >
        <div className="relative mx-auto grid max-w-6xl gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <Rise className="order-2 flex flex-col gap-4 lg:order-1 lg:pt-24">
            <LandingDeviceStack pageId="month-read" />
          </Rise>

          <Reveal className="order-1 lg:order-2">
            <SectionHeading heading={monthRead.heading} align="left" />
            <div className="mt-6 flex max-w-xl flex-col gap-4">
              {monthRead.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 24)}
                  className="text-base leading-relaxed text-marketing-muted"
                >
                  {paragraph}
                </p>
              ))}
            </div>
            <dl className="mt-10 flex flex-col gap-6 border-t border-white/10 pt-8">
              {monthRead.outcomes.map((outcome) => (
                <div key={outcome.label} className="sm:flex sm:gap-6">
                  {/* The term of a definition list, brighter than the body
                      beside it rather than differently coloured from it. It
                      was `text-primary/80`: an accent the outcome does not
                      earn, reached for at a tint because a weight was what the
                      hierarchy actually wanted. Ink over muted is that weight,
                      and 14.43:1 against the marketing ground. */}
                  <dt className="w-32 shrink-0 font-mono text-xs uppercase tracking-[0.14em] text-marketing-ink">
                    {outcome.label}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-marketing-muted sm:mt-0">
                    {outcome.body}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-marketing-faint">
              {monthRead.footnote}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------- how */}
      <section id="how" className="relative px-6 pb-24 md:pb-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <SectionHeading heading={how.heading} />
          </Reveal>
          <ol className="glass-grid mt-16 grid gap-px overflow-hidden rounded-card sm:grid-cols-2">
            {how.beats.map((beat, index) => (
              <li key={beat.title} className="p-7 md:p-8">
                <Reveal delay={index * 0.06}>
                  {/* As in the pillars above: faint, not a tint of the
                      accent. 5.17:1 inside a `.glass-grid` cell. */}
                  <span className="font-mono text-xs text-marketing-faint">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 font-head text-lg text-marketing-ink">
                    {beat.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-marketing-muted">
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
          <div className="glass-flat overflow-hidden rounded-card p-8 md:p-12">
            <Reveal>
              <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-16">
                <div>
                  <h2 className="marketing-display text-display-sub">
                    {privacy.heading}
                  </h2>
                </div>
                <div>
                  <p className="text-sm leading-relaxed text-marketing-muted">
                    {privacy.body}
                  </p>
                  <ul className="mt-6 flex flex-col gap-3">
                    {privacy.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-3 text-sm text-marketing-ink"
                      >
                        {/* A bullet, sitting a step under the line it marks —
                            the same relation the read card's neutral dot has
                            to its observation. Gold here was three unrelated
                            golds on one page, which is the spend the Rare
                            Accent Rule names. 6.06:1 on the panel. */}
                        <span
                          className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-marketing-muted"
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
          <h2 className="marketing-display text-display-section">
            {finalCta.heading}
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-marketing-muted">
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
