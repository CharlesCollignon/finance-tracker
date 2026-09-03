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
  label: string;
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
    label: "Month",
    icon: ChartPieSlice,
    children: [] as NavChild[],
  },
  {
    href: "/transactions",
    label: "Ledger",
    icon: ArrowsLeftRight,
    // The one surface with more than one way of looking at it. On a phone
    // these are the tabs at the top of the surface; the sidebar has the room
    // to show them without being asked.
    children: [
      { href: "/transactions", label: "List" },
      { href: "/calendar", label: "Calendar" },
      { href: "/history", label: "By category" },
    ] as NavChild[],
  },
  {
    href: "/recurring",
    label: "Charges",
    icon: Repeat,
    children: [] as NavChild[],
  },
  { href: "/budgets", label: "Plan", icon: Target, children: [] as NavChild[] },
  {
    href: "/investments",
    label: "Wallets",
    icon: ChartLine,
    children: [] as NavChild[],
  },
] as const;

export const PROFILE_NAV_ITEM = {
  href: "/profile",
  label: "Profile",
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
