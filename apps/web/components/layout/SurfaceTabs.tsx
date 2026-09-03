"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SurfaceTab {
  href: string;
  label: string;
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
  const pathname = usePathname();

  return (
    <nav
      aria-label="View"
      className={cn("flex items-center gap-1 overflow-x-auto", className)}
    >
      {tabs.map(({ href, label }) => {
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
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The Ledger's views: the same record, looked at three ways. */
export const LEDGER_TABS: SurfaceTab[] = [
  { href: "/transactions", label: "List" },
  { href: "/calendar", label: "Calendar" },
  { href: "/history", label: "By category" },
];

/** The Plan's views: what repeats, and what it adds up to. */
export const PLAN_TABS: SurfaceTab[] = [
  { href: "/recurring", label: "Charges" },
  { href: "/budgets", label: "Caps & goals" },
];
