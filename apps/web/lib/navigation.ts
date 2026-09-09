import type { Key } from "@finance/core/i18n/t";
import {
  ArrowsLeftRight,
  ChartLine,
  Compass,
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
 * Organised by time rather than by table: Bearing is where you stand, Ledger
 * is the record, Charges is what repeats, Plan is what those add up to,
 * Wallets is what is being built. Seven destinations became five, which is
 * what let the phone bar hold all of them with a legible label under each,
 * and it is still five — that ceiling is why the Bearing took Month's place
 * rather than being added beside it.
 *
 * Month is now a view under the Bearing, the way Calendar and History sit
 * under the Ledger. That is a demotion of position and not of importance: the
 * Bearing answers "where do I stand" and every one of its tiles is a figure
 * some other surface explains, so the screen that explains this month is one
 * press from the tile that states it. What the swap fixes is that the app's
 * front door used to be a single month, which is the right question on the
 * 28th and the wrong one on the 2nd.
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
 * installed app — which is also why Month kept `/dashboard` when it stopped
 * being the dashboard.
 */
export const APP_NAV_ITEMS = [
  {
    href: "/bearing",
    labelKey: "nav.bearing" satisfies Key,
    icon: Compass,
    children: [{ href: "/dashboard", labelKey: "nav.month" }] as NavChild[],
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
