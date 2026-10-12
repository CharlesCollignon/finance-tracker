"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  m,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import {
  ArrowRight,
  CaretDown,
  Check,
  Desktop,
  DeviceMobile,
  LinkSimple,
} from "@phosphor-icons/react";
import type { ChangeKind } from "@finance/core/changelog";
import {
  CHANGELOG_REACTIONS,
  changelogTarget,
  type ReactionTally,
} from "@finance/core/reactions";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";
import { featureHref } from "@/components/marketing/landing-copy";
import { FeatureMock } from "@/components/marketing/LandingMocks";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import {
  nouveautesEntryHref,
  type NouveautesCopy,
} from "@/components/marketing/nouveautes-copy";
import { PAGE_ICON } from "@/components/marketing/page-icons";
import { Reactions } from "@/components/marketing/nouveautes/Reactions";
import type { RiverEntry } from "@/components/marketing/nouveautes/river-entry";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/**
 * Each kind's dot: the status green for what is new — the same green as the
 * live dot, meaning « arrived » — and the two greys for what was improved
 * and what was mended. No gold: nothing here is a figure or a moment.
 */
export const KIND_DOT: Record<ChangeKind, string> = {
  new: "bg-success",
  better: "bg-white/85",
  fixed: "bg-white/50",
};

/** How long « Lien copié » holds before the link mark comes back. */
const COPIED_MS = 1600;

/**
 * One entry: its kind, where it is, its day, what changed and what that
 * means. « Plus » opens the rest in place, the entry growing and the ones
 * below sliding down to make room (the list's layout does that part).
 *
 * Most entries are rows, ruled off from each other like a ledger's; a
 * featured one is a glass card drawn wide, with its screen beside it — the
 * landing's own mock of the feature, mounted as the card nears the screen
 * and tilting up from its bottom edge as it is scrolled into view, as the
 * feature pages' screens do. That difference in weight is the list's
 * rhythm. A compact row is a fix unfolded from its week.
 */
export function EntryCard({
  entry,
  copy,
  fresh,
  open,
  onToggle,
  tally,
  signedIn,
  compact = false,
}: {
  entry: RiverEntry;
  copy: NouveautesCopy;
  fresh: boolean;
  open: boolean;
  onToggle: () => void;
  /** What readers have said about it, and what this reader did. */
  tally: ReactionTally;
  signedIn: boolean;
  compact?: boolean;
}) {
  const featured = entry.featured && !compact;
  return (
    <article
      id={`entry-${entry.id}`}
      className={cn(
        "relative isolate scroll-mt-32",
        featured
          ? "glass-flat my-3 overflow-hidden rounded-[1.75rem] p-5 md:p-7"
          : cn("border-b border-white/[0.07]", compact ? "py-4 pl-4" : "py-6"),
      )}
    >
      {fresh ? (
        <span
          className={cn(
            "absolute w-0.5 rounded-full bg-success",
            featured ? "inset-y-6 left-0" : "inset-y-6 -left-4 md:-left-5",
          )}
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          featured &&
            "grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,13rem)] md:items-start",
        )}
      >
        <div className="min-w-0">
          <Meta entry={entry} copy={copy} fresh={fresh} />
          <h3
            className={cn(
              "mt-2 font-head text-marketing-ink",
              featured
                ? "mt-4 text-xl md:text-2xl"
                : compact
                  ? "text-base"
                  : "text-lg",
            )}
          >
            {entry.title}
          </h3>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-marketing-muted">
            {entry.body}
          </p>
          <AnimatePresence initial={false}>
            {open && entry.detail ? (
              <m.div
                key="detail"
                className="overflow-hidden"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: DURATION.panel / 1000, ease: EASE }}
              >
                <p className="pt-3 text-[0.95rem] leading-relaxed text-marketing-ink">
                  {entry.detail}
                </p>
              </m.div>
            ) : null}
          </AnimatePresence>
          <Actions entry={entry} copy={copy} open={open} onToggle={onToggle} />
          {compact ? null : (
            <div className="-ml-1 mt-3">
              <Reactions
                target={changelogTarget(entry.id)}
                kinds={CHANGELOG_REACTIONS}
                initial={tally}
                copy={copy.reactions}
                signedIn={signedIn}
                loginHref={`/login?next=${encodeURIComponent(nouveautesEntryHref(entry.id))}`}
              />
            </div>
          )}
        </div>
        {featured && entry.feature ? (
          <FeatureScreen pageId={entry.feature.id} />
        ) : null}
      </div>
    </article>
  );
}

function Meta({
  entry,
  copy,
  fresh,
}: {
  entry: RiverEntry;
  copy: NouveautesCopy;
  fresh: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      <span className="inline-flex items-center gap-1.5 font-medium text-marketing-ink">
        <span
          className={cn("size-1.5 rounded-full", KIND_DOT[entry.kind])}
          aria-hidden
        />
        {copy.filters.kinds[entry.kind]}
      </span>
      <span className="inline-flex items-center gap-1.5 text-marketing-muted">
        {entry.platforms.map((platform) => {
          const Icon = platform === "web" ? Desktop : DeviceMobile;
          return (
            <span key={platform} title={copy.filters.platforms[platform]}>
              <Icon size={14} aria-hidden />
              <span className="sr-only">
                {copy.filters.platforms[platform]}
              </span>
            </span>
          );
        })}
      </span>
      {fresh ? (
        <span className="font-medium text-success">{copy.fresh.badge}</span>
      ) : null}
      <time
        dateTime={entry.date}
        className="ml-auto tabular-nums text-marketing-muted"
      >
        {entry.dateLabel}
      </time>
      <CopyLink
        href={nouveautesEntryHref(entry.id)}
        label={copy.entry.copyLink}
        copiedLabel={copy.entry.copied}
      />
    </div>
  );
}

function Actions({
  entry,
  copy,
  open,
  onToggle,
}: {
  entry: RiverEntry;
  copy: NouveautesCopy;
  open: boolean;
  onToggle: () => void;
}) {
  const PageIcon = entry.feature ? PAGE_ICON[entry.feature.id] : null;
  if (!entry.detail && !PageIcon) {
    return null;
  }
  return (
    <div className="-ml-1 mt-3 flex flex-wrap items-center gap-2">
      {entry.detail ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/12 px-4 text-sm text-marketing-ink transition-colors duration-hover hover:bg-white/[0.07]",
            marketingFocus,
          )}
        >
          {open ? copy.entry.less : copy.entry.more}
          <m.span
            className="flex"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: DURATION.hover / 1000, ease: EASE }}
          >
            <CaretDown size={12} weight="bold" aria-hidden />
          </m.span>
        </button>
      ) : null}
      {entry.feature && PageIcon ? (
        <Link
          href={featureHref(entry.feature.id)}
          aria-label={`${copy.entry.featurePage} ${entry.feature.title}`}
          className={cn(
            "group inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-marketing-muted transition-colors duration-hover hover:text-white",
            marketingFocus,
          )}
        >
          <PageIcon size={16} aria-hidden />
          {entry.feature.title}
          <ArrowRight
            size={14}
            aria-hidden
            className="transition-transform duration-hover group-hover:translate-x-0.5"
          />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * The entry's own address, to the clipboard. The link mark turns to a tick
 * on the spot, and « Lien copié » is said to a screen reader; nothing else
 * happens, because nothing else needs to.
 */
function CopyLink({
  href,
  label,
  copiedLabel,
}: {
  href: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        new URL(href, window.location.origin).toString(),
      );
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      className={cn(
        "-my-3 -mr-3 grid size-11 shrink-0 place-items-center rounded-full text-marketing-muted transition-colors duration-hover hover:bg-white/[0.07] hover:text-white",
        marketingFocus,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={copied ? "copied" : "link"}
          className={cn("flex", copied && "text-success")}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: DURATION.press / 1000, ease: EASE }}
        >
          {copied ? (
            <Check size={16} weight="bold" aria-hidden />
          ) : (
            <LinkSimple size={16} aria-hidden />
          )}
        </m.span>
      </AnimatePresence>
      <span className="sr-only" aria-live="polite">
        {copied ? copiedLabel : ""}
      </span>
    </button>
  );
}

/**
 * The feature's screen beside a featured entry: the landing's mock, cropped
 * to the top of a phone and fading out at the bottom, as on the feature
 * pages. Mounted as the card comes within a screen of view, so a long list
 * does not draw a dozen screens nobody has reached.
 */
function FeatureScreen({
  pageId,
}: {
  pageId: NonNullable<RiverEntry["feature"]>["id"];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, margin: "400px 0px" });
  const still = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });
  const rotateX = useTransform(
    scrollYProgress,
    [0, 1],
    still ? [0, 0] : [22, 0],
  );
  const y = useTransform(scrollYProgress, [0, 1], still ? [0, 0] : [40, 0]);

  return (
    <div ref={ref} className="[perspective:1400px]">
      <m.div
        style={{ rotateX, y, transformOrigin: "50% 100%" }}
        className="mx-auto aspect-[9/14] w-full max-w-[15rem] overflow-hidden rounded-[1.4rem] bg-background ring-1 ring-white/10 [mask-image:linear-gradient(to_bottom,black_80%,transparent)]"
      >
        {near ? (
          <div className="aspect-[9/20] w-full">
            <FeatureMock pageId={pageId} variant="mobile" />
          </div>
        ) : null}
      </m.div>
    </div>
  );
}
