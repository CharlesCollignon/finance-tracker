import type { Key } from "@finance/core/i18n/t";
import {
  ArrowsLeftRight,
  ChartLine,
  ChartPieSlice,
  Repeat,
  Target,
  User,
} from "@phosphor-icons/react";

export interface NavChild {
  href: string;
  /**
   * The message key for the label, not the label.
   *
   * This module is imported by the sidebar, the phone's bottom bar, the
   * account menu and the marketing mocks. Holding a key rather than a word
   * keeps all four naming the surfaces identically in whichever language the
   * reader chose, which is what the file already promised about English.
   */
  labelKey: Key;
}

/**
 * The five surfaces.
 *
 * Organised by time rather than by table: Month is now, Ledger is the record,
 * Charges is what repeats, Plan is what those add up to, Wallets is what is
 * being built. Seven destinations became five, which is what let the phone bar
 * hold all of them with a legible label under each.
 *
 * Charges spent a while as a view inside Plan, on the reasoning that a
 * standing charge is part of the plan. That is true about the data and wrong
 * about the use: it is the list people edit most, and burying the app's most
 * frequent destination one click inside another surface made it the slowest
 * thing to reach. Plan is now caps, goals, the projection and the month
 * close — the things you read — and Charges is the thing you write.
 *
 * The paths are the old ones. Renaming them would have touched twenty-five
 * revalidation calls and the manifest to change strings nobody reads in an
 * installed app.
 */
export const APP_NAV_ITEMS = [
  {
    href: "/dashboard",
    labelKey: "nav.month" satisfies Key,
    icon: ChartPieSlice,
    children: [] as NavChild[],
  },
  {
    href: "/transactions",
    labelKey: "nav.ledger" satisfies Key,
    icon: ArrowsLeftRight,
    // The one surface with more than one way of looking at it. On a phone
    // these are the tabs at the top of the surface; the sidebar has the room
    // to show them without being asked.
    children: [
      { href: "/transactions", labelKey: "nav.ledgerList" },
      { href: "/calendar", labelKey: "nav.ledgerCalendar" },
      { href: "/history", labelKey: "nav.ledgerByCategory" },
    ] as NavChild[],
  },
  {
    href: "/recurring",
    labelKey: "nav.charges" satisfies Key,
    icon: Repeat,
    children: [] as NavChild[],
  },
  {
    href: "/budgets",
    labelKey: "nav.plan" satisfies Key,
    icon: Target,
    children: [] as NavChild[],
  },
  {
    href: "/investments",
    labelKey: "nav.wallets" satisfies Key,
    icon: ChartLine,
    children: [] as NavChild[],
  },
] as const;

export const PROFILE_NAV_ITEM = {
  href: "/profile",
  labelKey: "nav.profile" satisfies Key,
  icon: User,
} as const;

/**
 * Which top-level surface a path belongs to.
 *
 * `startsWith` on its own would light two items at once — /transactions is
 * both its own surface and the Ledger's first view — and would leave the
 * Ledger dark on /calendar, which is one of its views.
 */
export function activeNavHref(pathname: string): string | null {
  for (const item of APP_NAV_ITEMS) {
    if (
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`) ||
      item.children.some(
        (child) =>
          pathname === child.href || pathname.startsWith(`${child.href}/`),
      )
    ) {
      return item.href;
    }
  }
  return null;
}

/**
 * The phone's bottom bar. Five destinations and the account trigger, which is
 * the most the bar holds before the labels start truncating.
 */
export const BOTTOM_NAV_ITEMS = APP_NAV_ITEMS;
