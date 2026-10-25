"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  AnimatePresence,
  m,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { ArrowCounterClockwise, PlusSquare } from "@phosphor-icons/react";
import { EASE_STANDARD } from "@finance/core/motion";
import type { DownloadCopy } from "@/components/marketing/download-copy";
import { Phone3D } from "@/components/marketing/landing/Phone3D";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/**
 * Where the gesture is: the home screen alone, the Share sheet up, its
 * « Sur l'écran d'accueil » pressed, then the sheet gone and the icon there.
 */
type Phase = "home" | "sheet" | "tap" | "landed";

/** When each phase starts, in milliseconds after the phone comes into view. */
const TIMELINE: [Phase, number][] = [
  ["sheet", 500],
  ["tap", 1500],
  ["landed", 2100],
];

/** Apps already on the screen, muted; Pluclair takes the next free place. */
const TILES = [
  "bg-white/[0.12]",
  "bg-white/[0.07]",
  "bg-white/[0.1]",
  "bg-white/[0.06]",
  "bg-white/[0.08]",
  "bg-white/[0.11]",
  "bg-white/[0.06]",
  "bg-white/[0.09]",
  "bg-white/[0.07]",
  "bg-white/[0.1]",
  "bg-white/[0.12]",
  "bg-white/[0.06]",
  "bg-white/[0.09]",
  "bg-white/[0.07]",
];

/** Turned a little towards the text beside it, the other way from the hero's. */
const REST_X = 4;
const REST_Y = 14;

/**
 * The download page's iPhone: what adding Pluclair to the home screen looks
 * like. When it comes into view the Share sheet rises, « Sur l'écran
 * d'accueil » is pressed, the sheet goes and Pluclair's icon springs into
 * the next free place — once, and then it rests, as DESIGN.md asks. « Revoir »
 * plays it again. With reduced motion the icon is simply there.
 *
 * A drawing, not a screenshot: no maker's status bar or app names, as the
 * hero's phone has none.
 */
export function IphoneHomeScreen({
  copy,
}: {
  copy: DownloadCopy["iphone"]["screen"];
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [phase, setPhase] = useState<Phase>("home");
  const [run, setRun] = useState(0);
  const rotateX = useMotionValue(REST_X);
  const rotateY = useMotionValue(REST_Y);
  const y = useMotionValue(0);

  useEffect(() => {
    if (!inView || reduced) {
      return;
    }
    const timers = TIMELINE.map(([next, at]) =>
      window.setTimeout(() => setPhase(next), at),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [inView, reduced, run]);

  const shown: Phase = reduced ? "landed" : phase;
  const landed = shown === "landed";

  function replay() {
    setPhase("home");
    setRun((count) => count + 1);
  }

  return (
    <div className="flex flex-col items-center">
      <div ref={ref} role="img" aria-label={copy.label} className="w-full">
        <Phone3D
          rotateX={rotateX}
          rotateY={rotateY}
          y={y}
          className="mx-auto h-[min(62vh,34rem)] w-auto [aspect-ratio:9/19.5]"
        >
          <div
            aria-hidden
            className="relative size-full bg-[#0b0b14] bg-[radial-gradient(120%_60%_at_15%_0%,rgb(76_64_140/0.45),transparent_65%),radial-gradient(90%_55%_at_100%_100%,rgb(30_76_110/0.4),transparent_70%)]"
          >
            <div className="grid grid-cols-4 gap-x-[11%] gap-y-[5.5%] px-[9%] pt-[22%]">
              {TILES.map((tile, index) => (
                <AppTile key={index} className={tile} />
              ))}
              <div className="relative flex flex-col items-center gap-[0.3rem]">
                {/* A gold ring as it lands, once, widening as it fades. */}
                {landed && !reduced ? (
                  <m.span
                    key={run}
                    className="absolute inset-x-0 top-0 aspect-square rounded-[24%] ring-2 ring-primary"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: [0, 0.9, 0], scale: [0.9, 1.25, 1.6] }}
                    transition={{ duration: 0.9, delay: 0.45, ease: EASE }}
                  />
                ) : null}
                <m.div
                  className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-[24%] bg-background ring-1 ring-white/10"
                  initial={false}
                  animate={
                    landed
                      ? { scale: 1, opacity: 1 }
                      : { scale: 0.2, opacity: 0 }
                  }
                  transition={
                    landed
                      ? {
                          type: "spring",
                          stiffness: 420,
                          damping: 15,
                          delay: reduced ? 0 : 0.3,
                        }
                      : { duration: 0 }
                  }
                >
                  <Image
                    src="/icon-192.png"
                    alt=""
                    width={192}
                    height={192}
                    className="size-[64%]"
                  />
                </m.div>
                <m.span
                  className="text-[0.5rem] leading-none text-white/85"
                  initial={false}
                  animate={{ opacity: landed ? 1 : 0 }}
                  transition={{
                    duration: landed ? 0.4 : 0,
                    delay: landed && !reduced ? 0.5 : 0,
                    ease: EASE,
                  }}
                >
                  {copy.appName}
                </m.span>
              </div>
            </div>

            {/* The dock. */}
            <div className="absolute inset-x-[4.5%] bottom-[2.6%] grid grid-cols-4 gap-x-[11%] rounded-[1.45rem] bg-white/[0.08] px-[5%] py-[4%] backdrop-blur-md">
              {[
                "bg-white/[0.12]",
                "bg-white/[0.09]",
                "bg-white/[0.11]",
                "bg-white/[0.08]",
              ].map((tile, index) => (
                <span
                  key={index}
                  className={cn("aspect-square rounded-[24%]", tile)}
                />
              ))}
            </div>

            <AnimatePresence>
              {shown === "sheet" || shown === "tap" ? (
                <m.div
                  key="sheet"
                  className="absolute inset-x-[2.5%] bottom-[1.5%] rounded-[1.6rem] bg-[#1d1d28]/95 p-[5%] shadow-[0_-20px_60px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur-xl"
                  initial={{ y: "115%" }}
                  animate={{ y: "0%" }}
                  exit={{ y: "115%" }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  {/* The page being shared: its icon and two lines. */}
                  <div className="flex items-center gap-[6%]">
                    <span className="relative grid aspect-square w-[18%] shrink-0 place-items-center rounded-[24%] bg-background ring-1 ring-white/10">
                      <Image
                        src="/icon-192.png"
                        alt=""
                        width={192}
                        height={192}
                        className="size-[64%]"
                      />
                    </span>
                    <span className="flex flex-1 flex-col gap-[0.3rem]">
                      <span className="h-[0.35rem] w-3/5 rounded-full bg-white/30" />
                      <span className="h-[0.3rem] w-2/5 rounded-full bg-white/15" />
                    </span>
                  </div>
                  {/* Who it could go to. */}
                  <div className="mt-[8%] flex justify-between px-[2%]">
                    {[0, 1, 2, 3].map((index) => (
                      <span
                        key={index}
                        className="aspect-square w-[17%] rounded-full bg-white/[0.1]"
                      />
                    ))}
                  </div>
                  {/* What it could do, the one pressed among them. */}
                  <div className="mt-[8%] overflow-hidden rounded-[0.9rem] bg-white/[0.06]">
                    <SheetRow />
                    <m.div
                      className="relative flex items-center justify-between border-t border-white/[0.06] px-[6%] py-[5.5%]"
                      animate={{
                        backgroundColor:
                          shown === "tap"
                            ? "rgba(255,255,255,0.14)"
                            : "rgba(255,255,255,0)",
                      }}
                      transition={{ duration: 0.14 }}
                    >
                      <span className="text-[0.55rem] font-medium leading-none text-white">
                        {copy.addToHomeScreen}
                      </span>
                      <PlusSquare
                        size={12}
                        weight="bold"
                        className="text-white/90"
                      />
                      {shown === "tap" ? (
                        <m.span
                          className="absolute right-[5%] top-1/2 size-7 -translate-y-1/2 rounded-full bg-white/40"
                          initial={{ scale: 0.3, opacity: 0.7 }}
                          animate={{ scale: 1.8, opacity: 0 }}
                          transition={{ duration: 0.55, ease: EASE }}
                        />
                      ) : null}
                    </m.div>
                    <SheetRow />
                  </div>
                </m.div>
              ) : null}
            </AnimatePresence>
          </div>
        </Phone3D>
      </div>
      {reduced ? null : (
        <button
          type="button"
          onClick={replay}
          disabled={!landed}
          className={cn(
            "-mt-2 inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm text-marketing-muted transition-[color,opacity] duration-hover hover:text-white disabled:opacity-0",
            marketingFocus,
          )}
        >
          <ArrowCounterClockwise size={14} aria-hidden />
          {copy.replay}
        </button>
      )}
    </div>
  );
}

/** An app on the home screen: its icon and, under it, its name as a line. */
function AppTile({ className }: { className: string }) {
  return (
    <div className="flex flex-col items-center gap-[0.3rem]">
      <span className={cn("aspect-square w-full rounded-[24%]", className)} />
      <span className="h-[0.3rem] w-3/4 rounded-full bg-white/10" />
    </div>
  );
}

/** One of the sheet's other actions, unread. */
function SheetRow() {
  return (
    <div className="flex items-center justify-between border-t border-white/[0.06] px-[6%] py-[5.5%] first:border-t-0">
      <span className="h-[0.35rem] w-2/5 rounded-full bg-white/20" />
      <span className="size-[0.6rem] rounded-[0.15rem] bg-white/15" />
    </div>
  );
}
