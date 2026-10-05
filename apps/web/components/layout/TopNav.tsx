"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { LazyMotion, m, MotionConfig } from "motion/react";
import { cn } from "@/lib/utils";
import { activeNavHref, navItems } from "@/lib/navigation";
import { badgeFor, NO_BADGES, type NavBadges } from "@/lib/nav-badges";
import {
  NOTCH_CENTRE_CLASS,
  NOTCH_ITEM_ACTIVE_CLASS,
  NOTCH_ITEM_CLASS,
  NOTCH_ITEM_IDLE_CLASS,
  NOTCH_PILL_CLASS,
  TOPBAR_END_CLASS,
  TOPBAR_START_CLASS,
} from "@/lib/nav-notch";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Logo } from "@/components/layout/Logo";
import { PrivacyToggle } from "@/components/layout/PrivacyToggle";
import { NotchWing } from "@/components/layout/NotchWing";
import { useQuickAdd } from "@/components/layout/QuickAddProvider";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

/**
 * Whether to spell the quick-add shortcut with a Command glyph.
 *
 * Read from the browser rather than passed down, because the shortcut is
 * decided by the keyboard in front of the reader and nothing the server knows.
 * `navigator.platform` is deprecated but is the only field that still answers
 * this in every engine; the optional chain keeps it safe before hydration.
 */
function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /mac|iphone|ipad|ipod/i.test(
    (navigator as { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ?? navigator.platform,
  );
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Motion's layout engine, fetched after the page — see `lib/motion-features`. */
const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

/**
 * Whether the page has scrolled away from its top, for the scrim behind the
 * bar's two sides.
 *
 * An observer on a strip at the top of the document rather than a scroll
 * listener: it answers once when the strip leaves the window and once when it
 * comes back, and nothing runs while the page is moving. This used to be a
 * scroll-driven animation in CSS alone, which fell back to "always on" in
 * browsers without `animation-timeline` — and "always on" was a band at the
 * top of the page that hid the notch in exactly those browsers.
 */
function useScrolledPastTop() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setScrolled(!entry.isIntersecting);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return { sentinelRef, scrolled };
}

/** Quick and a little springy, and settled well inside the enter token's
 * 500ms: the pill is answering a click, not making an entrance. */
const PILL_SPRING = { type: "spring", stiffness: 400, damping: 30 } as const;

/**
 * The app's primary action, at the end of the notch after the five surfaces:
 * the one thing in the notch that is not a destination, so it is the gold
 * disc and not another row, and nothing slides behind it.
 *
 * The "+" alone. Its name is kept `sr-only` rather than dropped, so the
 * button still says what it does, and the tooltip carries the name and the
 * shortcut together.
 */
function QuickAddButton() {
  const t = useT();
  const quickAdd = useQuickAdd();

  if (!quickAdd) {
    return null;
  }

  // The shortcut the app actually has. The badge used to read `N`, and the
  // binding behind it was removed because a bare letter opens this sheet over
  // whatever a screen reader is in the middle of (WCAG 2.1 SC 2.1.4); it
  // names the surviving shortcut, and reads the platform so a Windows or
  // Linux reader is not told to press a key their keyboard does not have.
  const shortcut = isApplePlatform() ? "\u2318K" : "Ctrl K";
  const label = t("add.open");

  return (
    <button
      type="button"
      onClick={() => quickAdd.open()}
      title={`${label} (${shortcut})`}
      className={cn(
        // `cursor-pointer` because Tailwind 4's preflight gives every button
        // the default arrow; the notch's other rows are links and have the
        // pointer already, so without it the one action in the row felt dead.
        "ml-1 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full",
        "bg-primary text-primary-foreground",
        "transition-colors duration-hover hover:bg-primary-hover",
        FOCUS_RING,
      )}
    >
      <Plus size={ICON.lg} weight="bold" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

/**
 * How many things are waiting behind a destination.
 *
 * Deliberately a count and not a dot. "Something needs you here" is a nudge;
 * "three things need you here" is information, and the difference decides
 * whether it is worth the trip.
 */
function NavBadge({ count }: { count: number }) {
  const t = useT();

  if (count <= 0) {
    return null;
  }

  return (
    <span
      aria-label={t("nav.waiting", { count })}
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full",
        "bg-foreground px-1.5 py-0.5 text-[10px] leading-none font-semibold",
        // The inverted neutral badge the design system already carries, as
        // `Badge`'s `solid` variant. A count is information, not emphasis,
        // and it does not need the accent to be the loudest thing in the bar.
        "text-background tabular-nums",
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/**
 * The desktop nav: a notch cut from the bezel at the top of the window
 * holding the five surfaces and the add button, with the wordmark on the page
 * to its left and the controls every screen shares — refresh, the privacy
 * blur, the account — on the page to its right. From `md` up;
 * below that the phone's bottom bar is the nav and this renders nothing.
 *
 * It replaced a 256px side rail. The rail spent a quarter of a laptop's width
 * on five links and a tree of views, and the views were the part worth the
 * room — but each of those surfaces already opens on a tab strip naming its
 * views, at every width, so the notch names only the surfaces and the tabs
 * say the rest.
 *
 * The bezel (`.app-frame`) and the bar are fixed over the page rather than
 * wrapped round it, so the document still scrolls as a document. The notch is
 * opaque and content passing under it goes behind the bezel; the wordmark
 * and the actions have no ground of their own, so once the page has scrolled
 * a frost comes up behind them (`.app-topbar-scrim`) and nothing is read
 * through them. The shell pads the page down by the bezel
 * and the notch to start below it all.
 *
 * The notch sits on the window's centre line whatever the two sides hold.
 * Below `lg` the surfaces you are not in drop to their icon, with the name
 * kept for screen readers and in a tooltip; the one you are in keeps its
 * label, which is what the bar most needs to say.
 *
 * The pill behind the surface you are in is one `layoutId`, so moving to
 * another surface slides it there instead of lighting a second one. The shell
 * outlives the navigation, which is what gives it somewhere to slide from.
 * `MotionConfig` hands `prefers-reduced-motion` to Motion, which then moves
 * the pill without the slide.
 */
export function TopNav({
  displayName,
  initial,
  badges = NO_BADGES,
  showProperty = false,
}: {
  displayName: string;
  initial: string;
  badges?: NavBadges;
  /** The Immobilier surface, for an account with `property.track`. */
  showProperty?: boolean;
}) {
  const t = useT();
  const pathname = usePathname();
  const here = activeNavHref(pathname);
  const items = navItems({ property: showProperty });
  const { sentinelRef, scrolled } = useScrolledPastTop();

  return (
    <div className="hidden md:block">
      {/* The strip the scrim watches: absolute against the document, so it
          scrolls with the page, and 3rem deep, so the scrim arrives once
          content has actually reached the bar rather than on the first
          pixel of scroll. */}
      <div
        ref={sentinelRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-12 w-px"
      />
      <div aria-hidden className="app-frame" />
      <div
        aria-hidden
        className="app-topbar-scrim"
        data-scrolled={scrolled ? "" : undefined}
      />
      <header className="pointer-events-none fixed left-[var(--shell-edge)] right-[var(--shell-frame)] top-[var(--shell-edge)] z-40">
        <div className={TOPBAR_START_CLASS}>
          <Logo className="md:text-[1.625rem]" />
        </div>

        <nav className={NOTCH_CENTRE_CLASS}>
          <NotchWing side="start" />
          <NotchWing side="end" />
          <LazyMotion features={loadMotionFeatures} strict>
            <MotionConfig reducedMotion="user">
              {items.map((item) => {
                const Icon = item.icon;
                const active = here === item.href;
                const label = t(item.labelKey);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={label}
                    className={cn(
                      NOTCH_ITEM_CLASS,
                      active ? NOTCH_ITEM_ACTIVE_CLASS : NOTCH_ITEM_IDLE_CLASS,
                      FOCUS_RING,
                    )}
                  >
                    {active ? (
                      <m.span
                        layoutId="notch-pill"
                        aria-hidden
                        className={NOTCH_PILL_CLASS}
                        transition={PILL_SPRING}
                      />
                    ) : null}
                    <span className="relative flex items-center gap-2">
                      <Icon
                        size={ICON.lg}
                        weight={active ? "fill" : "light"}
                        className="shrink-0"
                      />
                      <span
                        className={cn(
                          "whitespace-nowrap",
                          // Six labelled surfaces need the room `xl` gives,
                          // or the notch reaches the wordmark.
                          !active &&
                            (items.length > 5
                              ? "sr-only xl:not-sr-only"
                              : "sr-only lg:not-sr-only"),
                        )}
                      >
                        {label}
                      </span>
                      <NavBadge count={badgeFor(item.href, badges)} />
                    </span>
                  </Link>
                );
              })}
            </MotionConfig>
          </LazyMotion>
          <QuickAddButton />
        </nav>

        <div className={TOPBAR_END_CLASS}>
          {/* The rail had room to print how old the figures were; the bar
              does not, so the age is in the button's name and tooltip. */}
          <RefreshButton tone="bar" />
          {/* Up from the page's own header, which from `md` no longer holds
              anything every page shares: the blur is for the whole app, so
              it sits with the other controls for the whole app. */}
          <PrivacyToggle tone="bar" />
          <AccountMenu displayName={displayName} initial={initial} />
        </div>
      </header>
    </div>
  );
}
