"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type MouseEvent } from "react";
import { LazyMotion, m, MotionConfig } from "motion/react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";
import type { Key } from "@finance/core/i18n/t";

/** Motion's layout engine, fetched after the page — see `lib/motion-features`. */
const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

/** The notch's spring: quick and a little springy, answering a click. */
const PILL_SPRING = { type: "spring", stiffness: 400, damping: 30 } as const;

/** A click the browser handles itself: a new tab, a new window, a download. */
function opensElsewhere(event: MouseEvent): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

export interface SurfaceTab {
  href: string;
  /** The message key for the tab's label, not the label. */
  labelKey: Key;
}

interface SurfaceTabsProps {
  tabs: SurfaceTab[];
  className?: string;
}

/**
 * Views within one surface.
 *
 * The app used to give a nav slot to every way of looking at the same thing —
 * a list, a calendar and a per-category history were three destinations for
 * one body of data. They are views, and views belong to the surface they show,
 * not to the top-level bar. Six destinations became four this way, which is
 * the difference between a phone bar that fits and one that does not.
 *
 * Links rather than state, so each view keeps its own address and the browser
 * back button means what it says.
 *
 * Drawn by the surface's layout, so it stays put while the view under it
 * loads, and the pill slides to the tab pressed at once — before the view
 * has arrived, which is what the press is asking about. `aria-current` waits
 * for the view: it says where the reader is, not where they are going.
 */
export function SurfaceTabs({ tabs, className }: SurfaceTabsProps) {
  const t = useT();
  const pathname = usePathname();
  const pillId = useId();
  // The tab pressed, while its view is on its way. Forgotten as soon as the
  // address moves, wherever it moved to.
  const [pressed, setPressed] = useState<{ from: string; href: string } | null>(
    null,
  );
  const shown = pressed && pressed.from === pathname ? pressed.href : pathname;

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <nav
          aria-label={t("common.view")}
          className={cn("flex items-center gap-1 overflow-x-auto", className)}
        >
          {tabs.map(({ href, labelKey }) => {
            const active = shown === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                onClick={(event) => {
                  if (!opensElsewhere(event)) {
                    setPressed({ from: pathname, href });
                  }
                }}
                className={cn(
                  "relative shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium",
                  "transition-colors duration-hover",
                  active
                    ? "text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {active ? (
                  <m.span
                    layoutId={pillId}
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-foreground"
                    transition={PILL_SPRING}
                  />
                ) : null}
                <span className="relative">{t(labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </MotionConfig>
    </LazyMotion>
  );
}

/**
 * The surface whose views `pathname` is one of, or null: what the shell
 * keys its page on instead of the address, so that moving between a
 * surface's views keeps its layout — and these tabs — where they are.
 */
export function tabbedSurfaceOf(pathname: string): string | null {
  if (LEDGER_TABS.some((tab) => tab.href === pathname)) {
    return "ledger";
  }
  if (WALLET_TABS.some((tab) => tab.href === pathname)) {
    return "wallets";
  }
  return null;
}

/** The Ledger's views: the same record, looked at three ways. */
export const LEDGER_TABS: SurfaceTab[] = [
  { href: "/transactions", labelKey: "nav.ledgerList" },
  { href: "/calendar", labelKey: "nav.ledgerCalendar" },
  { href: "/history", labelKey: "nav.ledgerByCategory" },
];

/**
 * Placements' views: the accounts one at a time, all of them at once, and
 * what they are made of.
 *
 * Comptes answers "what do I hold in this account and what is it worth".
 * Analyse asks of every account together what it earns, how the money is
 * spread and what it costs. The look-through answers "what is it actually
 * made of" — the same holdings resolved to their constituents. Views of one
 * body of data, so they are tabs on the surface rather than more entries in
 * a nav bar that is already at its ceiling of five.
 */
export const WALLET_TABS: SurfaceTab[] = [
  { href: "/investments", labelKey: "nav.walletsPositions" },
  { href: "/investments/analysis", labelKey: "nav.walletsAnalysis" },
  { href: "/investments/look-through", labelKey: "nav.walletsLookThrough" },
];
