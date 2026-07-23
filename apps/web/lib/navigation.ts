import {
  ArrowsLeftRight,
  CalendarBlank,
  ChartLine,
  ChartPieSlice,
  Repeat,
  User,
} from "@phosphor-icons/react";

export const APP_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: ChartPieSlice },
  { href: "/investments", label: "Wallets", icon: ChartLine },
  { href: "/transactions", label: "Transactions", icon: ArrowsLeftRight },
  { href: "/calendar", label: "Calendar", icon: CalendarBlank },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/profile", label: "Profile", icon: User },
] as const;
