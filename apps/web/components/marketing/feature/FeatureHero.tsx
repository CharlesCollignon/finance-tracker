"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";
import {
  m,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { EASE_STANDARD } from "@finance/core/motion";
import { FeatureMock } from "@/components/marketing/LandingMocks";
import { LandingCtas } from "@/components/marketing/LandingCtas";
import { RiseWords } from "@/components/marketing/LandingReveal";
import type { LandingPageId } from "@/components/marketing/landing-copy";
import { Phone3D } from "@/components/marketing/landing/Phone3D";
import { PAGE_ICON } from "@/components/marketing/page-icons";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/**
 * How a feature page opens, three ways so the pages do not all open alike:
 *
 * - `tilt`: the words on the left, the desktop screen on the right leaning
 *   towards the pointer as it moves over the hero, drifting up behind the
 *   words as the page scrolls.
 * - `stage`: the words centred, the screen full width under them, laid back
 *   on its bottom edge and standing up as the page scrolls to it.
 * - `phone`: the words on the left, the phone on the right turning towards
 *   the pointer and a little further as the page scrolls.
 */
export type HeroVariant = "tilt" | "stage" | "phone";

export function FeatureHero({
  pageId,
  variant,
  title,
  utility,
  isLoggedIn,
}: {
  pageId: LandingPageId;
  variant: HeroVariant;
  title: string;
  utility: string;
  isLoggedIn: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const still = useReducedMotion() ?? false;

  // The pointer over the hero, -1 to 1 on each axis, eased.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 120, damping: 18, mass: 0.6 });
  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (still || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    px.set(((event.clientX - box.left) / box.width) * 2 - 1);
    py.set(((event.clientY - box.top) / box.height) * 2 - 1);
  }
  function onPointerLeave() {
    px.set(0);
    py.set(0);
  }

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const Icon = PAGE_ICON[pageId];
  const words = (
    <div className={cn(variant === "stage" && "mx-auto max-w-3xl text-center")}>
      <m.span
        className={cn(
          "mb-6 flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-primary",
          variant === "stage" && "mx-auto",
        )}
        initial={{ opacity: 0, scale: 0.6, rotate: -20 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
      >
        <Icon size={24} weight="duotone" />
      </m.span>
      <RiseWords
        as="h1"
        trigger="mount"
        delay={0.2}
        text={title}
        className="marketing-display text-display-section"
      />
      <m.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
      >
        <p
          className={cn(
            "mt-5 text-base leading-relaxed text-marketing-muted md:text-lg",
            variant === "stage" ? "mx-auto max-w-2xl" : "max-w-md",
          )}
        >
          {utility}
        </p>
        <LandingCtas
          isLoggedIn={isLoggedIn}
          size="lg"
          layout="solo"
          className={cn("mt-8", variant === "stage" && "justify-center")}
        />
      </m.div>
    </div>
  );

  return (
    <section
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-32 md:pb-24 md:pt-40"
    >
      {variant === "stage" ? (
        <>
          {words}
          <StageScreen pageId={pageId} still={still} />
        </>
      ) : (
        <div className="grid items-center gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
          {words}
          {variant === "tilt" ? (
            <TiltScreen
              pageId={pageId}
              still={still}
              sx={sx}
              sy={sy}
              scroll={scrollYProgress}
            />
          ) : (
            <PhoneScreen
              pageId={pageId}
              still={still}
              sx={sx}
              sy={sy}
              scroll={scrollYProgress}
            />
          )}
        </div>
      )}
    </section>
  );
}

type Motion = ReturnType<typeof useSpring>;

/** The desktop screen on a tablet up, the narrow one on a phone. */
function Screens({ pageId }: { pageId: LandingPageId }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-[1.4rem] bg-background ring-1 ring-white/10 md:block">
        <div className="aspect-[12/7] w-full">
          <FeatureMock pageId={pageId} variant="web" />
        </div>
      </div>
      <div className="mx-auto aspect-[9/14] w-full max-w-[18rem] overflow-hidden rounded-[1.4rem] bg-background ring-1 ring-white/10 [mask-image:linear-gradient(to_bottom,black_82%,transparent)] md:hidden">
        <div className="aspect-[9/20] w-full">
          <FeatureMock pageId={pageId} variant="mobile" />
        </div>
      </div>
    </>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.75rem] bg-white/[0.04] p-2 ring-1 ring-white/10 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)]">
      {children}
    </div>
  );
}

function TiltScreen({
  pageId,
  still,
  sx,
  sy,
  scroll,
}: {
  pageId: LandingPageId;
  still: boolean;
  sx: Motion;
  sy: Motion;
  scroll: Motion | ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const rotateY = useTransform(sx, [-1, 1], [-9, 9]);
  const rotateX = useTransform(sy, [-1, 1], [7, -7]);
  const y = useTransform(scroll, [0, 1], still ? [0, 0] : [0, -90]);
  const scale = useTransform(scroll, [0, 1], still ? [1, 1] : [1, 0.92]);
  // A sheen that slides with the lean.
  const glare = useTransform(sx, [-1, 1], ["10%", "90%"]);
  return (
    <m.div
      className="[perspective:1600px]"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.35, ease: EASE }}
    >
      <m.div
        className="relative [transform-style:preserve-3d]"
        style={{ rotateX, rotateY, y, scale }}
      >
        <Frame>
          <Screens pageId={pageId} />
        </Frame>
        <m.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-[radial-gradient(40%_60%_at_var(--g)_0%,rgba(255,255,255,0.10),transparent)]"
          style={{ ["--g" as string]: glare }}
        />
      </m.div>
    </m.div>
  );
}

function StageScreen({
  pageId,
  still,
}: {
  pageId: LandingPageId;
  still: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });
  const rotateX = useTransform(
    scrollYProgress,
    [0, 1],
    still ? [0, 0] : [32, 0],
  );
  const scale = useTransform(
    scrollYProgress,
    [0, 1],
    still ? [1, 1] : [0.86, 1],
  );
  const y = useTransform(scrollYProgress, [0, 1], still ? [0, 0] : [60, 0]);
  const glow = useTransform(scrollYProgress, [0.3, 1], [0, 1]);
  return (
    <div ref={ref} className="relative mt-16 [perspective:1800px] md:mt-20">
      <m.div
        aria-hidden
        className="pointer-events-none absolute inset-x-[10%] -bottom-10 top-1/3 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(236_178_94/0.22),transparent)] blur-3xl"
        style={{ opacity: glow }}
      />
      <m.div style={{ rotateX, scale, y, transformOrigin: "50% 100%" }}>
        <Frame>
          <Screens pageId={pageId} />
        </Frame>
      </m.div>
    </div>
  );
}

function PhoneScreen({
  pageId,
  still,
  sx,
  sy,
  scroll,
}: {
  pageId: LandingPageId;
  still: boolean;
  sx: Motion;
  sy: Motion;
  scroll: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const turn = useTransform(scroll, [0, 1], still ? [0, 0] : [0, 18]);
  const lean = useTransform(sx, [-1, 1], still ? [0, 0] : [-20, 20]);
  const rotateY = useTransform(() => lean.get() + turn.get() - 12);
  const rotateX = useTransform(sy, [-1, 1], still ? [0, 0] : [10, -4]);
  const y = useTransform(scroll, [0, 1], still ? [0, 0] : [0, -40]);
  return (
    <m.div
      className="relative flex justify-center"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.35, ease: EASE }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[min(30rem,80vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(236_178_94/0.18),transparent)] blur-2xl"
      />
      <Phone3D
        rotateX={rotateX}
        rotateY={rotateY}
        y={y}
        className="h-[min(70vh,38rem)] w-auto [aspect-ratio:9/19.5]"
      >
        <div className="absolute inset-0">
          <FeatureMock pageId={pageId} variant="mobile" />
        </div>
      </Phone3D>
    </m.div>
  );
}
