import {
  ArrowsLeftRight,
  CalendarBlank,
  ChartBar,
  ChartLine,
  ChartPieSlice,
  Repeat,
  Target,
  User,
} from "@phosphor-icons/react";

/** The side nav's main list, where there is room for all of it. Profile opens
 * an account menu (theme, settings, sign out). */
export const APP_NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: ChartPieSlice },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/transactions", label: "Transaction", icon: ArrowsLeftRight },
  { href: "/calendar", label: "Calendar", icon: CalendarBlank },
  { href: "/investments", label: "Wallets", icon: ChartLine },
  { href: "/budgets", label: "Planning", icon: Target },
  { href: "/history", label: "History", icon: ChartBar },
] as const;

export const PROFILE_NAV_ITEM = {
  href: "/profile",
  label: "Profile",
  icon: User,
} as const;

/**
 * The phone's bottom bar: the side nav's list, one item shorter.
 *
 * Seven destinations plus the account trigger leaves each slot at about the
 * 44px touch minimum on a 375px screen, with 10px labels truncated to
 * nothing. History is the one you go to deliberately rather than repeatedly,
 * so it is reached from Planning instead and the bar stays legible.
 *
 * Profile is not in the list because the bar renders an account menu of its
 * own for thumb reach.
 */
export const BOTTOM_NAV_ITEMS = APP_NAV_ITEMS.filter(
  (item) => item.href !== "/history",
);
