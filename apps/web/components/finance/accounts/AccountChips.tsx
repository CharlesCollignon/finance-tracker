"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { LazyMotion, m, MotionConfig } from "motion/react";
import { moveAccount } from "@finance/core/account-order";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import { accountShortName, type AccountId } from "./account-format";

/** Motion's layout engine, fetched after the page — see `lib/motion-features`. */
const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

/** How far a mouse moves with the button down before a press is a drag. */
const DRAG_THRESHOLD = 6;
/**
 * How long a finger rests on a chip before it can be dragged. A finger that
 * moves sooner is scrolling the page, which is what it usually is.
 */
const TOUCH_HOLD_MS = 350;
/** How far a finger may wander while it holds. */
const TOUCH_SLOP = 8;
/** The other chips making room: quick, and no spring (see DESIGN.md). */
const SLIDE = { duration: 0.15, ease: "easeOut" } as const;

interface Press {
  id: AccountId;
  pointerId: number;
  x: number;
  y: number;
  touch: boolean;
  /** Whether a move now drags: at once for a mouse, after the hold for a finger. */
  armed: boolean;
  dragging: boolean;
  /**
   * The chip last swapped with, ignored until the pointer leaves it. Two
   * chips of different widths would otherwise trade places on every frame
   * the pointer sat over the wider one.
   */
  passed: AccountId | null;
  /** The order when the press began, to tell whether the drag moved anything. */
  before: readonly AccountId[];
}

function sameAccounts(left: readonly AccountId[], right: readonly AccountId[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

/**
 * Placements' accounts as a row of pills, in the reader's order, and the
 * way to change it: drag a pill with the mouse, hold one with a finger and
 * then drag it, or move the focused one with Alt and an arrow key. The
 * others slide aside as it passes them; the new order is handed to
 * `onReorder` when the pill is let go.
 *
 * A group of toggles, not tabs. `role="tablist"` over `role="tab"` was a
 * promise the markup did not keep: the panel below is not a `tabpanel`,
 * nothing carries `aria-controls`, and there was neither a roving
 * `tabIndex` nor a key handler — so a screen reader announced a tab set and
 * then the arrow keys did nothing. `aria-pressed` on plain buttons says
 * which account is in force and claims no keys the control does not handle.
 */
export function AccountChips({
  accounts,
  selected,
  onSelect,
  onReorder,
  trailing,
}: {
  accounts: readonly AccountId[];
  selected: AccountId | null;
  onSelect: (id: AccountId) => void;
  /** The accounts in their new order, once a drag or a key has moved one. */
  onReorder: (order: AccountId[]) => void;
  /** After the pills: the button that adds an account. */
  trailing?: ReactNode;
}) {
  const t = useT();
  const locale = useLocale();
  // The order the reader has made here, while it holds the same accounts as
  // the page's: an account added or removed hands the order back to it.
  const [order, setOrder] = useState<AccountId[] | null>(null);
  const [lifted, setLifted] = useState<AccountId | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const shown = order && sameAccounts(order, accounts) ? order : accounts;
  // What the handlers read between renders: a drag moves faster than React
  // draws, and each move has to start from the one before it.
  const shownRef = useRef(shown);
  useLayoutEffect(() => {
    shownRef.current = shown;
  });
  const press = useRef<Press | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chips = useRef(new Map<AccountId, HTMLButtonElement>());
  const swallowClick = useRef(false);
  const row = useRef<HTMLDivElement>(null);
  const movable = accounts.length > 1;

  // A finger that has held long enough drags the pill, not the page. Only a
  // listener that is not passive may say so, which React's are.
  useEffect(() => {
    const element = row.current;
    if (!element) {
      return;
    }
    const stopScroll = (event: TouchEvent) => {
      if (press.current?.armed) {
        event.preventDefault();
      }
    };
    element.addEventListener("touchmove", stopScroll, { passive: false });
    return () => element.removeEventListener("touchmove", stopScroll);
  }, []);

  useEffect(
    () => () => {
      if (hold.current) {
        clearTimeout(hold.current);
      }
    },
    [],
  );

  function announce(id: AccountId, next: readonly AccountId[]) {
    setAnnouncement(
      t("accounts.movedTo", {
        name: accountShortName(id, locale),
        position: next.indexOf(id) + 1,
        count: next.length,
      }),
    );
  }

  /**
   * The pill under the pointer, where the layout puts it rather than where
   * its slide has got to: the others are still moving aside for a few
   * frames after each swap, and a pill sliding under a still pointer must
   * not count as the pointer moving onto it.
   */
  function chipAt(x: number, y: number): AccountId | null {
    const origin = row.current?.getBoundingClientRect();
    if (!origin) {
      return null;
    }
    const left = x - origin.left;
    const top = y - origin.top;
    for (const [id, element] of chips.current) {
      if (
        left >= element.offsetLeft &&
        left <= element.offsetLeft + element.offsetWidth &&
        top >= element.offsetTop &&
        top <= element.offsetTop + element.offsetHeight
      ) {
        return id;
      }
    }
    return null;
  }

  function onPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    id: AccountId,
  ) {
    swallowClick.current = false;
    if (!movable || event.button !== 0) {
      return;
    }
    const touch = event.pointerType === "touch";
    press.current = {
      id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      touch,
      armed: !touch,
      dragging: false,
      passed: null,
      before: shownRef.current,
    };
    if (!touch) {
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    hold.current = setTimeout(() => {
      if (press.current?.id === id) {
        press.current.armed = true;
        setLifted(id);
        navigator.vibrate?.(10);
      }
    }, TOUCH_HOLD_MS);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = press.current;
    if (!current || event.pointerId !== current.pointerId) {
      return;
    }
    const distance = Math.hypot(
      event.clientX - current.x,
      event.clientY - current.y,
    );
    if (!current.dragging) {
      if (!current.armed) {
        if (distance > TOUCH_SLOP) {
          release();
        }
        return;
      }
      if (!current.touch && distance < DRAG_THRESHOLD) {
        return;
      }
      current.dragging = true;
      setLifted(current.id);
    }

    const over = chipAt(event.clientX, event.clientY);
    if (over !== current.passed && over !== current.id) {
      current.passed = null;
    }
    if (over === null || over === current.id || over === current.passed) {
      return;
    }
    const now = shownRef.current;
    const next = moveAccount(now, now.indexOf(current.id), now.indexOf(over));
    current.passed = over;
    shownRef.current = next;
    setOrder(next);
  }

  function release() {
    if (hold.current) {
      clearTimeout(hold.current);
      hold.current = null;
    }
    const current = press.current;
    press.current = null;
    setLifted(null);
    if (!current?.dragging) {
      return;
    }
    // The click that ends a drag is not a choice of account.
    swallowClick.current = true;
    const next = shownRef.current;
    if (next.some((id, index) => current.before[index] !== id)) {
      announce(current.id, next);
      onReorder([...next]);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: AccountId) {
    if (!movable || !event.altKey) {
      return;
    }
    const step =
      event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : 0;
    const from = shown.indexOf(id);
    const to = from + step;
    if (step === 0 || to < 0 || to >= shown.length) {
      return;
    }
    event.preventDefault();
    const next = moveAccount(shown, from, to);
    setOrder(next);
    announce(id, next);
    onReorder(next);
  }

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <div
          ref={row}
          className="relative flex w-full min-w-0 flex-wrap justify-center gap-2"
          role="group"
          aria-label={t("accounts.yourAccounts")}
        >
          {shown.map((id) => {
            const active = selected === id;
            return (
              <m.button
                key={id}
                layout="position"
                transition={SLIDE}
                ref={(element: HTMLButtonElement | null) => {
                  if (element) {
                    chips.current.set(id, element);
                  } else {
                    chips.current.delete(id);
                  }
                }}
                type="button"
                aria-pressed={active}
                aria-keyshortcuts={
                  movable ? "Alt+ArrowLeft Alt+ArrowRight" : undefined
                }
                title={movable ? t("accounts.reorderHint") : undefined}
                onClick={() => {
                  if (swallowClick.current) {
                    swallowClick.current = false;
                    return;
                  }
                  onSelect(id);
                }}
                onPointerDown={(event) => onPointerDown(event, id)}
                onPointerMove={onPointerMove}
                onPointerUp={release}
                onPointerCancel={release}
                onKeyDown={(event) => onKeyDown(event, id)}
                onContextMenu={(event) => {
                  if (press.current?.touch) {
                    event.preventDefault();
                  }
                }}
                className={cn(
                  "min-h-11 shrink-0 select-none rounded-full border px-4 py-2 text-sm font-semibold [-webkit-touch-callout:none] lg:min-h-0",
                  "transition-colors duration-hover",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                  lifted === id &&
                    "relative z-10 scale-105 cursor-grabbing ring-2 ring-primary",
                )}
              >
                {accountShortName(id, locale)}
              </m.button>
            );
          })}
          {trailing}
          <span className="sr-only" aria-live="polite">
            {announcement}
          </span>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
