"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import {
  ArrowRight,
  HandHeart,
  HandsClapping,
  Heart,
  Hourglass,
  ThumbsUp,
  type Icon,
} from "@phosphor-icons/react";
import {
  toggledTally,
  type ReactionKind,
  type ReactionTally,
} from "@finance/core/reactions";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";
import { setReaction } from "@/lib/actions/reactions";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** The pop of a reaction said: quick, a little springy, then still. */
const POP = { type: "spring", stiffness: 520, damping: 14 } as const;

const ICONS: Record<ReactionKind, Icon> = {
  love: Heart,
  useful: ThumbsUp,
  finally: HandsClapping,
  want: Hourglass,
  thanks: HandHeart,
};

/**
 * The words around the buttons: each reaction's name, and what is said to
 * a visitor who presses one, or when a write is refused.
 */
export type ReactionsCopy<K extends ReactionKind> = Record<K, string> & {
  label: string;
  signIn: string;
  signInCta: string;
  failed: string;
};

/**
 * What readers say about a change — « J'adore », « Utile », « Enfin ! » —
 * or, on an item of « Bientôt », « J'attends ça »; in Entraide, « Utile »
 * and « Merci » on a question or an answer.
 *
 * Counts for everyone; saying needs an account, and a visitor's press opens
 * the way to sign in, back to this change after. A press shows at once: the
 * mark pops filled, the count rolls, and the write follows; if it is
 * refused, both go back and say so. Ink, not gold: a reaction is not a
 * figure or a moment (DESIGN.md, The Rare Accent Rule).
 */
export function Reactions<K extends ReactionKind>({
  target,
  kinds,
  initial,
  copy,
  signedIn,
  loginHref,
  vote = false,
}: {
  target: string;
  kinds: readonly K[];
  initial: ReactionTally;
  copy: ReactionsCopy<K>;
  signedIn: boolean;
  loginHref: string;
  /** One button with its words, for « Bientôt »'s vote. */
  vote?: boolean;
}) {
  const [tally, setTally] = useState(initial);
  const [pops, setPops] = useState<Partial<Record<ReactionKind, number>>>({});
  const [ask, setAsk] = useState(false);
  const [failed, setFailed] = useState(false);

  async function press(kind: K) {
    if (!signedIn) {
      setAsk((open) => !open);
      return;
    }
    const before = tally;
    const on = !tally.mine.includes(kind);
    setTally(toggledTally(tally, kind, on));
    setFailed(false);
    if (on) {
      setPops((current) => ({ ...current, [kind]: (current[kind] ?? 0) + 1 }));
    }
    const result = await setReaction(target, kind, on);
    if (!result.success) {
      setTally(before);
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div
        role="group"
        aria-label={copy.label}
        className="flex flex-wrap items-center gap-1.5"
      >
        {kinds.map((kind) => {
          const Mark: Icon = ICONS[kind];
          const mine = tally.mine.includes(kind);
          const count = tally.counts[kind] ?? 0;
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={mine}
              aria-label={`${copy[kind]}${count > 0 ? ` (${count})` : ""}`}
              title={copy[kind]}
              onClick={() => void press(kind)}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors duration-hover",
                marketingFocus,
                mine
                  ? "border-white/20 bg-white/[0.08] text-marketing-ink"
                  : "border-white/[0.07] text-marketing-muted hover:border-white/15 hover:text-white",
              )}
            >
              <m.span
                key={pops[kind] ?? 0}
                className="flex"
                initial={pops[kind] ? { scale: 0.55 } : false}
                animate={{ scale: 1 }}
                transition={POP}
              >
                <Mark
                  size={16}
                  weight={mine ? "fill" : "regular"}
                  aria-hidden
                />
              </m.span>
              {vote ? <span>{copy[kind]}</span> : null}
              <Count value={count} />
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {ask ? (
          <Reveal key="ask">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-marketing-muted">
              {copy.signIn}
              <Link
                href={loginHref}
                className={cn(
                  "group inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-marketing-ink",
                  marketingFocus,
                )}
              >
                {copy.signInCta}
                <ArrowRight
                  size={14}
                  aria-hidden
                  className="transition-transform duration-hover group-hover:translate-x-0.5"
                />
              </Link>
            </p>
          </Reveal>
        ) : null}
        {failed ? (
          <Reveal key="failed">
            <p role="status" className="text-sm text-marketing-muted">
              {copy.failed}
            </p>
          </Reveal>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** A count that rolls to its new value; nothing at all for none yet. */
function Count({ value }: { value: number }) {
  return (
    <span className="relative inline-flex min-w-[1ch] justify-center overflow-hidden tabular-nums">
      <AnimatePresence mode="wait" initial={false}>
        {value > 0 ? (
          <m.span
            key={value}
            initial={{ y: "70%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "-70%", opacity: 0 }}
            transition={{ duration: DURATION.press / 1000, ease: EASE }}
          >
            {value}
          </m.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

function Reveal({ children }: { children: ReactNode }) {
  return (
    <m.div
      className="overflow-hidden"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: DURATION.panel / 1000, ease: EASE }}
    >
      {children}
    </m.div>
  );
}
