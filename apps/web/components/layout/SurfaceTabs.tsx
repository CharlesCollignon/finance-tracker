"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";
import type { Key } from "@finance/core/i18n/t";

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
 */
export function SurfaceTabs({ tabs, className }: SurfaceTabsProps) {
  const t = useT();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("common.view")}
      className={cn("flex items-center gap-1 overflow-x-auto", className)}
    >
      {tabs.map(({ href, labelKey }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium",
              "transition-colors duration-200",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

/** The Ledger's views: the same record, looked at three ways. */
export const LEDGER_TABS: SurfaceTab[] = [
  { href: "/transactions", labelKey: "nav.ledgerList" },
  { href: "/calendar", labelKey: "nav.ledgerCalendar" },
  { href: "/history", labelKey: "nav.ledgerByCategory" },
];

/**
 * Wallets' views: where the value sits, and what it is made of.
 *
 * The positions list answers "what do I hold and what is it worth". The
 * look-through answers "what is it actually made of" — the same holdings
 * resolved to their constituents. Two views of one body of data, so they are
 * tabs on the surface rather than a second entry in a nav bar that is already
 * at its ceiling of five.
 */
export const WALLET_TABS: SurfaceTab[] = [
  { href: "/investments", labelKey: "nav.walletsPositions" },
  { href: "/investments/look-through", labelKey: "nav.walletsLookThrough" },
];
