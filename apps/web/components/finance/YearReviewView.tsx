"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  CaretLeft,
  CaretRight,
  DownloadSimple,
  Pause,
  Play,
  ArrowCounterClockwise,
  ShareNetwork,
  X,
} from "@phosphor-icons/react";
import {
  formatEuro,
  formatPercentLabel,
  formatSignedPercentOf,
} from "@finance/core/constants";
import { monthShort } from "@finance/core/i18n/calendar-names";
import { EASE_STANDARD } from "@finance/core/motion";
import type { YearReview } from "@finance/core/year-review";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { ICON } from "@/lib/icon-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

/** How long a slide stays before the next one, when nothing holds it. */
const SLIDE_MS = 6500;
/** Below this, a press is a tap; above it, a hold that paused the story. */
const TAP_MS = 250;
/** A swipe this far, in pixels, turns the page. */
const SWIPE_PX = 50;

const EASE = [...EASE_STANDARD] as [number, number, number, number];

type SlideId =
  "intro" | "kept" | "closes" | "category" | "milestones" | "share";

/**
 * « Votre année », told as a story: one slide a screen over the whole
 * window, bars across the top filling as each one plays, a tap on the right
 * for the next and on the left for the one before, a swipe, the arrow keys,
 * a hold to pause. The figures count up, the ring fills, the months light
 * one after the other, the bars grow — and the last slide is the image to
 * share, with no amount in it.
 *
 * The one surface where motion carries the content (`DESIGN.md`, Moments):
 * still no confetti, still the one easing curve, and under reduced motion
 * every slide lands on its final state and nothing plays by itself.
 */
export function YearReviewView({
  year,
  review,
}: {
  year: number;
  review: YearReview | null;
}) {
  const t = useT();
  if (!review) {
    return (
      <>
        <PageHeader titleKey="nav.yearReview" />
        <PageContainer>
          <p className="text-sm text-muted-foreground">
            {t("yearReview.nothing", { year })}
          </p>
        </PageContainer>
      </>
    );
  }
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <YearStory year={year} review={review} />
      </MotionConfig>
    </LazyMotion>
  );
}

function YearStory({ year, review }: { year: number; review: YearReview }) {
  const t = useT();
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;

  const slides: SlideId[] = [
    "intro",
    ...(review.kept ? (["kept"] as const) : []),
    ...(review.closes.count > 0 ? (["closes"] as const) : []),
    ...(review.category ? (["category"] as const) : []),
    ...(review.milestones.length > 0 ? (["milestones"] as const) : []),
    "share",
  ];
  const [index, setIndex] = useState(0);
  // Bumped on each visit, so a slide's figures count up again when it is
  // come back to.
  const [visit, setVisit] = useState(0);
  const [held, setHeld] = useState(false);
  const [paused, setPaused] = useState(false);
  // Under reduced motion nothing plays by itself; the reader turns pages.
  const playing = !paused && !reduce;
  const progress = useMotionValue(0);
  const last = slides.length - 1;
  const slide = slides[index]!;

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(last, next));
      progress.set(0);
      setIndex(clamped);
      setVisit((count) => count + 1);
    },
    [last, progress],
  );

  const close = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/bearing");
    }
  }, [router]);

  // The bar of the slide on screen fills while nothing holds it; full, the
  // story turns the page. The last slide waits for the reader.
  useAnimationFrame((_, delta) => {
    if (!playing || held || index === last) {
      return;
    }
    const next = progress.get() + delta / SLIDE_MS;
    if (next >= 1) {
      goTo(index + 1);
    } else {
      progress.set(next);
    }
  });

  // A tab out of sight holds the story, as a hold does.
  useEffect(() => {
    function onVisibility() {
      setHeld(document.visibilityState === "hidden");
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        goTo(index + 1);
      } else if (event.key === "ArrowLeft") {
        goTo(index - 1);
      } else if (event.key === "Escape") {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, close]);

  // A tap on the left goes back, anywhere else forward; a hold pauses; a
  // swipe turns the page. A press on a control is the control's.
  const press = useRef<{ x: number; at: number } | null>(null);
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a")) {
      return;
    }
    press.current = { x: event.clientX, at: performance.now() };
    setHeld(true);
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = press.current;
    press.current = null;
    setHeld(false);
    if (!start) {
      return;
    }
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > SWIPE_PX) {
      goTo(index + (dx < 0 ? 1 : -1));
      return;
    }
    if (performance.now() - start.at < TAP_MS) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const left = event.clientX - bounds.left < bounds.width * 0.3;
      goTo(index + (left ? -1 : 1));
    }
  }

  return (
    <div
      role="region"
      aria-roledescription={t("nav.yearReview")}
      aria-label={t("yearReview.title", { year })}
      className="fixed inset-0 z-[60] flex touch-pan-y select-none flex-col overflow-hidden bg-background"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        press.current = null;
        setHeld(false);
      }}
    >
      <Backdrop slide={index} />

      {/* The bars: one per slide, filled behind, filling now, empty ahead. */}
      <div className="relative z-10 flex gap-1.5 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {slides.map((id, position) => (
          <div
            key={id}
            className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/15"
          >
            {position < index ? (
              <div className="h-full w-full bg-foreground/80" />
            ) : position === index ? (
              <m.div
                className="h-full w-full origin-left bg-foreground/80"
                style={{ scaleX: index === last ? 1 : progress }}
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 pt-3">
        <p className="text-sm font-medium text-muted-foreground">
          {t("yearReview.title", { year })}
        </p>
        <div className="flex items-center gap-1">
          {index < last && !reduce ? (
            <IconButton
              label={playing ? t("yearReview.pause") : t("yearReview.play")}
              onClick={() => setPaused((value) => !value)}
            >
              {playing ? (
                <Pause size={ICON.md} weight="fill" />
              ) : (
                <Play size={ICON.md} weight="fill" />
              )}
            </IconButton>
          ) : null}
          <IconButton label={t("yearReview.close")} onClick={close}>
            <X size={ICON.md} weight="bold" />
          </IconButton>
        </div>
      </div>

      {/* The slide. Said to a screen reader as it arrives. */}
      <div
        aria-live="polite"
        className="relative z-10 flex flex-1 items-center justify-center px-6"
      >
        <AnimatePresence mode="wait">
          <m.section
            key={`${slide}:${visit}`}
            className="flex w-full max-w-xl flex-col gap-6"
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.98 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {slide === "intro" ? <IntroSlide year={year} /> : null}
            {slide === "kept" ? <KeptSlide review={review} /> : null}
            {slide === "closes" ? <ClosesSlide review={review} /> : null}
            {slide === "category" ? <CategorySlide review={review} /> : null}
            {slide === "milestones" ? (
              <MilestonesSlide review={review} />
            ) : null}
            {slide === "share" ? (
              <ShareSlide year={year} onReplay={() => goTo(0)} />
            ) : null}
          </m.section>
        </AnimatePresence>
      </div>

      {/* For a keyboard and a screen reader: the same pages, as buttons. */}
      <div className="relative z-10 flex items-center justify-between px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <IconButton
          label={t("yearReview.previous")}
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
        >
          <CaretLeft size={ICON.md} weight="bold" />
        </IconButton>
        <p className="text-xs tabular-nums text-muted-foreground">
          {t("yearReview.slideOf", { step: index + 1, total: slides.length })}
        </p>
        <IconButton
          label={t("yearReview.next")}
          onClick={() => goTo(index + 1)}
          disabled={index === last}
        >
          <CaretRight size={ICON.md} weight="bold" />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-10 items-center justify-center rounded-full text-foreground/80 transition-colors duration-hover hover:bg-foreground/10 hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * Two lights drifting behind the slides, gold and violet, moving to a new
 * place with each slide. Held still under reduced motion.
 */
function Backdrop({ slide }: { slide: number }) {
  const spots = [
    { x: "-10%", y: "-5%" },
    { x: "35%", y: "10%" },
    { x: "-20%", y: "40%" },
    { x: "25%", y: "55%" },
    { x: "0%", y: "20%" },
    { x: "30%", y: "-10%" },
  ];
  const gold = spots[slide % spots.length]!;
  const violet = spots[(slide + 3) % spots.length]!;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <m.div
        className="absolute left-1/4 top-1/4 size-[60vmax] rounded-full bg-primary/25 blur-[120px]"
        animate={{ x: gold.x, y: gold.y }}
        transition={{ duration: 2.4, ease: EASE }}
      />
      <m.div
        className="absolute left-1/3 top-1/3 size-[55vmax] rounded-full bg-[#7c5cff]/20 blur-[120px]"
        animate={{ x: violet.x, y: violet.y }}
        transition={{ duration: 2.8, ease: EASE }}
      />
    </div>
  );
}

/** The parts of a slide, one after the other. */
const rise = {
  hidden: { opacity: 0, y: 18 },
  shown: (order: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + order * 0.12, duration: 0.5, ease: EASE },
  }),
};

function Rise({
  order,
  className,
  children,
}: {
  order: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <m.div
      className={className}
      variants={rise}
      custom={order}
      initial="hidden"
      animate="shown"
    >
      {children}
    </m.div>
  );
}

function SlideTitle({ children }: { children: ReactNode }) {
  return (
    <Rise order={0}>
      <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {children}
      </p>
    </Rise>
  );
}

function IntroSlide({ year }: { year: number }) {
  const t = useT();
  const reduce = useReducedMotion() ?? false;
  const digits = String(year).split("");
  return (
    <>
      <Rise order={0}>
        <p className="text-lg text-muted-foreground">{t("nav.yearReview")}</p>
      </Rise>
      <div className="flex font-head text-[clamp(5rem,22vw,11rem)] leading-none text-primary">
        {digits.map((digit, position) => (
          <m.span
            key={position}
            initial={{ opacity: 0, y: 60, rotate: -6 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 18,
              delay: 0.2 + position * 0.09,
            }}
          >
            {digit}
          </m.span>
        ))}
      </div>
      <Rise order={4}>
        <p className="max-w-md text-lg">{t("yearReview.lead")}</p>
      </Rise>
      <m.p
        className="text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={reduce ? { opacity: 1 } : { opacity: [0, 1, 0.4, 1] }}
        transition={
          reduce
            ? { duration: 0 }
            : { delay: 1.2, duration: 2.4, repeat: Infinity }
        }
      >
        {t("yearReview.tapToStart")}
      </m.p>
    </>
  );
}

function KeptSlide({ review }: { review: YearReview }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const kept = review.kept!;
  const rate = kept.rate === null ? null : Math.max(0, Math.min(1, kept.rate));
  return (
    <>
      <SlideTitle>{t("yearReview.keptTitle")}</SlideTitle>
      <div className="flex flex-wrap items-center gap-8">
        <Rise order={1}>
          <AnimatedAmount
            value={kept.amount}
            startFrom={0}
            format={format}
            className="block font-head text-[clamp(3rem,12vw,6rem)] leading-none text-primary"
          />
          <p className="mt-2 text-lg">
            {t("yearReview.keptCaption", { year: review.year })}
          </p>
        </Rise>
        {rate !== null ? (
          <Rise order={2}>
            <Ring
              value={rate}
              label={formatPercentLabel(Math.round(rate * 100), locale)}
              caption={t("yearReview.rateOfIncome")}
            />
          </Rise>
        ) : null}
      </div>
      <Rise order={3}>
        <p className="max-w-md text-sm text-muted-foreground">
          {t(
            kept.source === "closes"
              ? "yearReview.keptFromCloses"
              : "yearReview.keptFromRecorded",
          )}
        </p>
      </Rise>
    </>
  );
}

/** A ring that fills to a share, its figure in the middle. */
function Ring({
  value,
  label,
  caption,
}: {
  value: number;
  label: string;
  caption: string;
}) {
  const size = 148;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  return (
    <div className="relative flex size-[148px] items-center justify-center">
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-foreground/10"
        />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="text-primary"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: value }}
          transition={{ delay: 0.5, duration: 1.4, ease: EASE }}
        />
      </svg>
      <div className="absolute flex flex-col items-center text-center">
        <span className="font-head text-2xl">{label}</span>
        <span className="max-w-[6.5rem] text-[11px] leading-tight text-muted-foreground">
          {caption}
        </span>
      </div>
    </div>
  );
}

function ClosesSlide({ review }: { review: YearReview }) {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      <SlideTitle>{t("yearReview.closesTitle")}</SlideTitle>
      <Rise order={1}>
        <p className="font-head text-[clamp(3rem,12vw,6rem)] leading-none text-primary">
          <AnimatedAmount
            value={review.closes.count}
            startFrom={0}
            format={(value) => String(Math.round(value))}
          />
        </p>
        <p className="mt-2 text-lg">
          {t("yearReview.closesCaption", { count: review.closes.count })}
        </p>
      </Rise>
      {/* The twelve months, lit one after the other: closed, won, and the
          longest run of them in gold. */}
      <ol className="grid grid-cols-6 gap-3 sm:grid-cols-12">
        {review.months.map((month, position) => (
          <li
            key={month.monthKey}
            className="flex flex-col items-center gap-1.5"
          >
            <m.span
              aria-hidden
              className={cn(
                "size-7 rounded-full border",
                month.inBestRun
                  ? "border-primary bg-primary shadow-[0_0_18px_rgba(236,178,94,0.55)]"
                  : month.won
                    ? "border-primary/70 bg-primary/40"
                    : month.closed
                      ? "border-foreground/40 bg-foreground/25"
                      : "border-foreground/20",
              )}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: "spring",
                stiffness: 380,
                damping: 20,
                delay: 0.45 + position * 0.07,
              }}
            />
            <span className="text-[11px] text-muted-foreground">
              {monthShort(Number(month.monthKey.slice(5, 7)), locale)}
            </span>
          </li>
        ))}
      </ol>
      {review.closes.bestRun > 0 ? (
        <Rise order={6}>
          <p className="text-base">
            {t("yearReview.bestRun", { count: review.closes.bestRun })}
          </p>
        </Rise>
      ) : null}
    </>
  );
}

function CategorySlide({ review }: { review: YearReview }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const category = review.category!;

  if (category.kind === "share") {
    return (
      <>
        <SlideTitle>{t("yearReview.categoryTitle")}</SlideTitle>
        <Rise order={1}>
          <p className="font-head text-[clamp(3rem,12vw,6rem)] leading-none text-primary">
            {formatPercentLabel(Math.round(category.share * 100), locale)}
          </p>
          <p className="mt-2 text-lg">
            {t("yearReview.categoryShareCaption", { name: category.name })}
          </p>
        </Rise>
        <Bar
          label={category.name}
          amount={format(category.amount)}
          ratio={category.share}
          gold
          order={2}
        />
      </>
    );
  }

  const widest = Math.max(category.before, category.after);
  return (
    <>
      <SlideTitle>{t("yearReview.categoryTitle")}</SlideTitle>
      <Rise order={1}>
        <p className="font-head text-4xl">{category.name}</p>
      </Rise>
      <div className="flex flex-col gap-3">
        <Bar
          label={String(review.year - 1)}
          amount={format(category.before)}
          ratio={category.before / widest}
          order={2}
        />
        <Bar
          label={String(review.year)}
          amount={format(category.after)}
          ratio={category.after / widest}
          gold
          order={3}
        />
      </div>
      <m.span
        className={cn(
          "self-start rounded-full px-4 py-1.5 font-head text-2xl",
          category.change < 0
            ? "bg-success/15 text-success"
            : "bg-primary/15 text-primary",
        )}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 16, delay: 1.3 }}
      >
        {formatSignedPercentOf(category.change, locale, 0)}
      </m.span>
    </>
  );
}

/** One year's bar, growing to its length. */
function Bar({
  label,
  amount,
  ratio,
  gold = false,
  order,
}: {
  label: string;
  amount: string;
  ratio: number;
  gold?: boolean;
  order: number;
}) {
  return (
    <Rise order={order} className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <PrivateAmount className="tabular-nums">{amount}</PrivateAmount>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-foreground/10">
        <m.div
          className={cn(
            "h-full origin-left rounded-full",
            gold ? "bg-primary" : "bg-foreground/45",
          )}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: Math.max(0.02, ratio) }}
          transition={{ delay: 0.4 + order * 0.15, duration: 1.1, ease: EASE }}
        />
      </div>
    </Rise>
  );
}

function MilestonesSlide({ review }: { review: YearReview }) {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      <SlideTitle>{t("yearReview.milestonesTitle")}</SlideTitle>
      <div className="flex flex-wrap gap-3">
        {review.milestones.map((amount, position) => (
          <m.div
            key={amount}
            className="rounded-card border border-primary/60 bg-primary/10 px-6 py-5"
            initial={{ opacity: 0, scale: 0.6, rotate: position % 2 ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 17,
              delay: 0.3 + position * 0.18,
            }}
          >
            <PrivateAmount className="font-head text-3xl text-primary">
              {formatEuro(amount, locale)}
            </PrivateAmount>
          </m.div>
        ))}
      </div>
      <Rise order={3}>
        <p className="text-lg">
          {t("yearReview.milestonesCaption", {
            count: review.milestones.length,
          })}
        </p>
      </Rise>
    </>
  );
}

/** The image to share, the two ways out with it, and the way back in. */
function ShareSlide({
  year,
  onReplay,
}: {
  year: number;
  onReplay: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const src = `/api/year-review/image?y=${year}&l=${locale}`;
  const fileName = `pluclair-${year}.png`;

  async function share() {
    setPending(true);
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: t("yearReview.imageTitle", { year }),
        });
        return;
      }
      // No share sheet here: the file, then.
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      // Cancelled, or the browser refused: nothing to say.
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <SlideTitle>{t("yearReview.shareTitle")}</SlideTitle>
      <m.div
        initial={{ opacity: 0, y: 40, rotate: -3 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 20,
          delay: 0.25,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- drawn per
            account on request, nothing for the image optimiser to keep */}
        <img
          src={src}
          alt={t("yearReview.imageTitle", { year })}
          width={1080}
          height={1350}
          className="h-auto w-56 rounded-card border border-border shadow-2xl sm:w-64"
        />
      </m.div>
      <Rise order={3}>
        <p className="max-w-xs text-xs text-muted-foreground">
          {t("yearReview.shareHint")}
        </p>
      </Rise>
      <Rise order={4} className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => void share()}
          className="gap-2"
        >
          <ShareNetwork size={ICON.md} aria-hidden />
          {t("yearReview.share")}
        </Button>
        <a
          href={src}
          download={fileName}
          className="inline-flex items-center gap-1.5 rounded-control px-3 py-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <DownloadSimple size={ICON.sm} aria-hidden />
          {t("yearReview.download")}
        </a>
        <Button
          type="button"
          variant="ghost"
          onClick={onReplay}
          className="gap-2"
        >
          <ArrowCounterClockwise size={ICON.md} aria-hidden />
          {t("yearReview.replay")}
        </Button>
      </Rise>
    </div>
  );
}
