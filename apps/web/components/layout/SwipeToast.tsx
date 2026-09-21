"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { X } from "@phosphor-icons/react";
import { cssEasing, DURATION } from "@finance/core/motion";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";

/**
 * A toast you can throw away.
 *
 * Adapted from React Bits' SwipeToast, with its one dependency removed. The
 * original drives the drag and the exit through `motion/react`; this app has
 * no animation runtime — `knip.jsonc` records `motion` as a dependency
 * "nothing in the app imports any more", pending deletion — and does its
 * moving with CSS transitions over `cssEasing()`, the way `bearing/Panel`,
 * `bearing/Tile` and `bearing/Spine` already do. So the drag is pointer
 * events writing a transform, and the exit is a transition on it.
 *
 * Three things this has that a `setTimeout` did not. The fuse is the timer:
 * it is a real animation, so pausing it on hover pauses the dismissal too,
 * and a toast you are reading cannot vanish mid-sentence. It can be thrown
 * away in either direction, which matters because these are anchored to the
 * top of a phone and the bottom of a desktop and "away" is not the same way
 * on both. And it can carry a button, which is what lets a destructive action
 * offer to undo itself in the one place the reader is already looking.
 */

export type ToastVariant = "default" | "success" | "error";

export type SwipeToastCloseReason =
  "timeout" | "swipe" | "action" | "close" | "escape";

export interface SwipeToastProps {
  title: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  actionLabel?: ReactNode;
  onAction?: () => void;
  /** Milliseconds until it closes itself. Zero keeps it until dismissed. */
  duration?: number;
  onClose: (reason: SwipeToastCloseReason) => void;
  closeButton?: boolean;
}

/** How far a slow drag must travel before letting go dismisses it. */
const SWIPE_DISTANCE = 44;

/** Past this, a flick dismisses however short it was. Pixels per millisecond. */
const FLICK_VELOCITY = 0.35;

/** Movement below this is a press, not a drag — so a button press still works. */
const DEAD_ZONE = 4;

/** How long the card takes to leave, and the row beneath it to close up. */
const EXIT_MS = Math.round(DURATION.panel * 0.6);

/**
 * The three cards.
 *
 * The error is the only one that fills. A save that worked is the expected
 * outcome, and lighting the whole card for it spent the accent on every
 * successful edit in the app. But with the fill gone the confirmation read
 * exactly like the neutral notice, so it keeps a rim in `--success` — the
 * same green the semantic palette already gives income, carried as a border
 * rather than a ground so it distinguishes without shouting. The failure
 * keeps its fill, because that is the one a reader must not scroll past.
 */
const SURFACE: Record<ToastVariant, string> = {
  default: "border-border bg-background text-foreground",
  success: "border-success bg-secondary text-foreground",
  error: "border-destructive bg-destructive text-destructive-foreground",
};

/** The fuse, which has to stay legible against all three surfaces. */
const FUSE: Record<ToastVariant, string> = {
  default: "bg-muted-foreground",
  success: "bg-muted-foreground",
  error: "bg-destructive-foreground/50",
};

export function SwipeToast({
  title,
  description,
  variant = "default",
  actionLabel,
  onAction,
  duration = 3500,
  onClose,
  closeButton = false,
}: SwipeToastProps) {
  const t = useT();
  const reducedMotion = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const fuseRef = useRef<HTMLSpanElement>(null);
  const burn = useRef<Animation | null>(null);

  /** Where the finger has dragged it to, in pixels. */
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const drag = useRef<{
    id: number;
    from: number;
    grabbed: boolean;
    at: number;
    was: number;
    velocity: number;
  } | null>(null);

  // Held in a ref so the fuse effect below can call the latest one without
  // listing it as a dependency — which would re-arm the timer on every render
  // of the parent, and a timer that keeps restarting never fires.
  //
  // Synced in an effect rather than assigned during render: `react-hooks/refs`
  // refuses the latter, and rightly — a ref written while rendering is a write
  // React may discard. Declared before the fuse effect so it has run by the
  // time that one reads it.
  const latest = useRef({ onClose, onAction });
  useEffect(() => {
    latest.current = { onClose, onAction };
  });

  /**
   * Leave, then report.
   *
   * The report is what removes this from the provider's list, so it waits for
   * the exit to finish — otherwise the card is unmounted mid-transition and
   * the row below it jumps rather than closing up.
   */
  const close = useCallback(
    (reason: SwipeToastCloseReason, direction = 0) => {
      setLeaving((already) => {
        if (already) {
          return already;
        }
        burn.current?.cancel();
        if (direction !== 0) {
          setOffset(direction * (cardRef.current?.offsetHeight ?? 80) * 1.5);
        }
        window.setTimeout(
          () => latest.current.onClose(reason),
          reducedMotion ? 0 : EXIT_MS,
        );
        return true;
      });
    },
    [reducedMotion],
  );

  /**
   * The fuse is the timer.
   *
   * A real animation rather than a `setTimeout`, because the two must not be
   * able to disagree: a line that is paused while the countdown behind it
   * keeps running is a toast that vanishes while you hover it, which is
   * exactly what makes a toast with a button in it useless.
   */
  useEffect(() => {
    const line = fuseRef.current;
    if (!line || duration <= 0 || leaving) {
      return undefined;
    }

    const animation = line.animate(
      [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }],
      { duration, easing: "linear", fill: "forwards" },
    );
    animation.onfinish = () => latest.current.onClose("timeout");
    burn.current = animation;

    return () => {
      animation.onfinish = null;
      animation.cancel();
    };
  }, [duration, leaving]);

  /** Escape closes the one you are focused on. */
  useEffect(() => {
    const card = cardRef.current;
    if (!card) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close("escape");
      }
    };
    card.addEventListener("keydown", onKeyDown);
    return () => card.removeEventListener("keydown", onKeyDown);
  }, [close]);

  const hold = () => burn.current?.pause();
  const release = () => {
    if (!dragging && burn.current?.playState === "paused") {
      burn.current.play();
    }
  };

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Never start a drag on a button: the action and the close have to stay
    // pressable, and a press that becomes a drag swallows the click.
    if (
      event.button !== 0 ||
      leaving ||
      (event.target as HTMLElement).closest("button")
    ) {
      return;
    }
    cardRef.current?.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      from: event.clientY,
      grabbed: false,
      at: event.timeStamp,
      was: 0,
      velocity: 0,
    };
    hold();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) {
      return;
    }

    const travelled = event.clientY - current.from;
    if (!current.grabbed) {
      if (Math.abs(travelled) < DEAD_ZONE) {
        return;
      }
      current.grabbed = true;
      setDragging(true);
    }

    const elapsed = event.timeStamp - current.at;
    if (elapsed > 0) {
      current.velocity = (travelled - current.was) / elapsed;
      current.at = event.timeStamp;
      current.was = travelled;
    }
    setOffset(travelled);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) {
      return;
    }
    drag.current = null;
    cardRef.current?.releasePointerCapture(event.pointerId);
    setDragging(false);

    if (!current.grabbed) {
      release();
      return;
    }

    // Either direction dismisses. These sit at the top of a phone and the
    // bottom of a desktop, so there is no single direction that means "away".
    const thrown =
      Math.abs(current.velocity) > FLICK_VELOCITY ||
      Math.abs(current.was) >= SWIPE_DISTANCE;

    if (thrown) {
      close("swipe", Math.sign(current.was || current.velocity) || 1);
      return;
    }

    setOffset(0);
    release();
  }

  const settling = !dragging && !reducedMotion;

  return (
    <div
      // The row that closes up as the card leaves, so the toasts below it
      // slide rather than jump. `bearing/Panel` opens with the same trick.
      className="grid w-full max-w-sm"
      style={{
        gridTemplateRows: leaving ? "0fr" : "1fr",
        transition: reducedMotion
          ? undefined
          : `grid-template-rows ${EXIT_MS}ms ${cssEasing()}`,
      }}
    >
      {/* `min-h-0`, because a grid item will not shrink below its content. */}
      <div className="min-h-0 overflow-hidden">
        <div
          ref={cardRef}
          // No `role="status"` here. It carries an implicit `aria-live`, and
          // this card is already inside the provider's live region — nesting
          // the two announces every toast twice. Focusable all the same, so
          // Escape has something to be pressed against.
          tabIndex={0}
          data-leaving={leaving ? "" : undefined}
          className={cn(
            "pointer-events-auto relative mt-2 flex touch-none items-center gap-3",
            "overflow-hidden rounded-control border px-4 py-3",
            "text-sm font-medium shadow-lg outline-none select-none",
            "focus-visible:ring-2 focus-visible:ring-ring",
            dragging ? "cursor-grabbing" : "cursor-grab",
            SURFACE[variant],
          )}
          style={{
            transform: `translateY(${offset}px)`,
            opacity: leaving
              ? 0
              : Math.max(0, 1 - Math.abs(offset) / (SWIPE_DISTANCE * 4)),
            transition: settling
              ? `transform ${EXIT_MS}ms ${cssEasing()}, opacity ${EXIT_MS}ms ${cssEasing()}`
              : undefined,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") {
              hold();
            }
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") {
              release();
            }
          }}
          onFocus={hold}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              release();
            }
          }}
        >
          <span className="flex min-w-0 flex-auto flex-col gap-0.5">
            <span className="break-words">{title}</span>
            {/* 80%, not 70. The description is the line that says what
                actually went wrong, and on the error variant — the one
                surface here a reader must not scroll past — `--destructive-
                foreground` at 70% over `--destructive` composites to 4.45:1,
                which misses the 4.5:1 AA floor by the width of a rounding
                error. At 80% it reads 5.45:1 against the error fill, and the
                other two variants, which already passed, go from 8.36:1 to
                10.76:1 (default) and 7.59:1 to 9.52:1 (success).

                One step for all three rather than a per-variant opacity: the
                description is one thing and should be one weight, and the
                title still leads it on font weight rather than on colour. */}
            {description ? (
              <span className="font-normal break-words opacity-80">
                {description}
              </span>
            ) : null}
          </span>

          {actionLabel ? (
            <button
              type="button"
              className={cn(
                "shrink-0 rounded-control border border-current/30 px-2 py-1",
                "text-xs font-semibold transition-opacity duration-hover",
                "hover:opacity-80 focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-current",
              )}
              onClick={() => {
                latest.current.onAction?.();
                close("action");
              }}
            >
              {actionLabel}
            </button>
          ) : null}

          {closeButton ? (
            <button
              type="button"
              aria-label={t("common.close")}
              className="shrink-0 rounded-control opacity-60 transition-opacity duration-hover hover:opacity-100"
              onClick={() => close("close")}
            >
              <X size={ICON.sm} weight="bold" />
            </button>
          ) : null}

          {duration > 0 ? (
            <span
              ref={fuseRef}
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left",
                FUSE[variant],
              )}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
