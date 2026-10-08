"use client";

import {
  createContext,
  useContext,
  useOptimistic,
  useTransition,
  type ReactNode,
} from "react";
import { domAnimation, LazyMotion, m, MotionConfig } from "motion/react";
import { useToast } from "@/components/layout/ToastProvider";
import { showMyShareAction } from "@/lib/actions/space";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/** The knob's spring: a flick, settled. */
const KNOB_SPRING = { type: "spring", stiffness: 600, damping: 34 } as const;

interface MyShareValue {
  on: boolean;
  pending: boolean;
  toggle: () => void;
}

const MyShareContext = createContext<MyShareValue | null>(null);

/**
 * « Avec ma part du commun » (6b), one state for every card that draws the
 * switch: flipped at once under the finger, the figures following when the
 * server has counted them again.
 */
export function MyShareProvider({
  on,
  children,
}: {
  on: boolean;
  children: ReactNode;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(on);

  function toggle() {
    const next = !shown;
    startTransition(async () => {
      setShown(next);
      const result = await showMyShareAction(next);
      if (result.error) {
        toast(result.error, "error");
      }
    });
  }

  return (
    <MyShareContext.Provider value={{ on: shown, pending, toggle }}>
      {children}
    </MyShareContext.Provider>
  );
}

/** Whether the spending shown counts the person's part of the space. */
export function useMyShare(): MyShareValue | null {
  return useContext(MyShareContext);
}

/** The switch itself, small enough for a card's header. */
export function MyShareToggle({ className }: { className?: string }) {
  const t = useT();
  const share = useMyShare();
  if (!share) {
    return null;
  }
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <button
          type="button"
          role="switch"
          aria-checked={share.on}
          aria-busy={share.pending || undefined}
          onClick={share.toggle}
          className={cn(
            "flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium",
            "transition-colors duration-hover hover:bg-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            share.on ? "text-foreground" : "text-muted-foreground",
            className,
          )}
        >
          <span className="hidden sm:inline">{t("space.myShare")}</span>
          <span
            aria-hidden
            className={cn(
              "relative flex h-4 w-7 items-center rounded-full px-0.5 transition-colors duration-hover",
              share.on ? "bg-foreground" : "bg-foreground/20",
            )}
          >
            <m.span
              initial={false}
              animate={{ x: share.on ? 12 : 0 }}
              transition={KNOB_SPRING}
              className="size-3 rounded-full bg-background shadow-sm"
            />
          </span>
          <span className="sr-only sm:hidden">{t("space.myShare")}</span>
        </button>
      </MotionConfig>
    </LazyMotion>
  );
}
