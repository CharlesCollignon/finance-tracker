import {
  ArrowsLeftRight,
  CalendarBlank,
  ChartLine,
  ChartPieSlice,
  Repeat,
  User,
} from "@phosphor-icons/react";

/** Primary app chrome. Categories live under Profile to keep the
 * bottom nav to six items. */
export const APP_NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: ChartPieSlice },
  { href: "/transactions", label: "Money", icon: ArrowsLeftRight },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/calendar", label: "Calendar", icon: CalendarBlank },
  { href: "/investments", label: "Wallets", icon: ChartLine },
  { href: "/profile", label: "Profile", icon: User },
] as const;
