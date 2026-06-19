"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_NAV_ITEMS } from "@/lib/navigation";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 md:hidden",
        "border-t-2 border-border bg-background pb-safe",
      )}
    >
      <div className="mx-auto flex h-[var(--shell-bottom-nav-height)] max-w-lg items-stretch justify-around">
        {APP_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-[44px] flex-1 flex-col items-center",
                "justify-center gap-0.5 px-1 py-1 text-[10px] font-medium sm:text-xs",
                "transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon size={20} weight={active ? "fill" : "regular"} />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
