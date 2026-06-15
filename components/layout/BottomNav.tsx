"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowsLeftRight,
  ChartPieSlice,
  Repeat,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: ChartPieSlice,
  },
  {
    href: "/transactions",
    label: "Transactions",
    icon: ArrowsLeftRight,
  },
  {
    href: "/recurring",
    label: "Recurring",
    icon: Repeat,
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t-2 border-border md:hidden",
        "bg-background pb-safe",
      )}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-14 min-w-[44px] flex-1 flex-col items-center",
                "justify-center gap-1 px-2 py-2 text-xs font-medium",
                "transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon size={22} weight={active ? "fill" : "regular"} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
