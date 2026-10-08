"use client";

import { useId, useOptimistic, useTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LazyMotion, m, MotionConfig } from "motion/react";
import { useToast } from "@/components/layout/ToastProvider";
import { initialOf, useSpace } from "@/components/layout/SpaceContext";
import { showJointAction } from "@/lib/actions/space";
import { useT } from "@/lib/locale-context";
import { isSharedPath } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((module) => module.default);

/** The thumb's spring: quick, with the least overshoot that still reads. */
const THUMB_SPRING = { type: "spring", stiffness: 520, damping: 38 } as const;

/** Whether this screen draws the switch: someone in a space, on a shared screen. */
export function useOwnerSwitchShown(): boolean {
  const space = useSpace();
  const pathname = usePathname();
  return space !== null && isSharedPath(pathname);
}

/**
 * « Moi · Commun »: whose money the shared screens show.
 *
 * The thumb slides under the choice before the server has answered — the
 * screens redraw behind it as the space's rows arrive. Under « Commun » the
 * partners' initials close in on each other, which is the whole idea of the
 * space said without a word. Reduced motion lands on the same places
 * without the travel.
 */
export function OwnerSwitch({ className }: { className?: string }) {
  const t = useT();
  const space = useSpace();
  const shown = useOwnerSwitchShown();
  const { toast } = useToast();
  const thumbId = useId();
  const [pending, startTransition] = useTransition();
  const [joint, setJoint] = useOptimistic(space?.joint ?? false);

  if (!space || !shown) {
    return null;
  }

  function choose(next: boolean) {
    if (next === joint) {
      return;
    }
    startTransition(async () => {
      setJoint(next);
      const result = await showJointAction(next);
      if (result.error) {
        toast(result.error, "error");
      }
    });
  }

  const options: { joint: boolean; label: ReactNode; aria: string }[] = [
    { joint: false, label: t("space.mine"), aria: t("space.mine") },
    {
      joint: true,
      label: (
        <>
          <Initials
            names={space.members.map((member) => member.name)}
            together={joint}
          />
          <span className="max-w-[7rem] truncate">{space.name}</span>
        </>
      ),
      aria: space.name,
    },
  ];

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <div
          role="radiogroup"
          aria-label={t("space.switchLabel")}
          aria-busy={pending || undefined}
          className={cn(
            "flex items-center rounded-full border bg-muted/50 p-0.5",
            "text-xs font-medium",
            className,
          )}
        >
          {options.map((option) => {
            const selected = option.joint === joint;
            return (
              <button
                key={String(option.joint)}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={option.aria}
                onClick={() => choose(option.joint)}
                className={cn(
                  "relative isolate flex h-7 items-center gap-1.5 rounded-full px-3",
                  "transition-colors duration-hover",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {selected ? (
                  <m.span
                    layoutId={`owner-thumb-${thumbId}`}
                    aria-hidden
                    transition={THUMB_SPRING}
                    className="absolute inset-0 -z-10 rounded-full bg-background shadow-sm ring-1 ring-border"
                  />
                ) : null}
                {option.label}
              </button>
            );
          })}
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

/** Two small discs that move together when the space is the one on screen. */
function Initials({ names, together }: { names: string[]; together: boolean }) {
  return (
    <span aria-hidden className="relative flex h-4 items-center">
      {names.slice(0, 2).map((name, index) => (
        <m.span
          key={`${index}-${name}`}
          initial={false}
          animate={{
            x: index === 0 ? 0 : together ? -5 : -1,
            scale: together ? 1 : 0.9,
          }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
          className={cn(
            "flex size-4 items-center justify-center rounded-full",
            "border border-background text-[8px] font-semibold leading-none",
            index === 0
              ? "bg-foreground text-background"
              : "bg-muted-foreground text-background",
          )}
        >
          {initialOf(name)}
        </m.span>
      ))}
    </span>
  );
}

/**
 * The page title in the phone's header band, or the switch in its place on
 * a shared screen: the bar below already names the screen, and the band
 * has no room for both.
 */
export function HeaderTitle({ children }: { children: ReactNode }) {
  const shown = useOwnerSwitchShown();
  return (
    <>
      <h1
        className={cn(
          "truncate font-head text-lg leading-none md:sr-only",
          shown && "sr-only",
        )}
      >
        {children}
      </h1>
      {shown ? <OwnerSwitch className="md:hidden" /> : null}
    </>
  );
}
