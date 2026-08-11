"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_ITEMS } from "@/lib/navigation";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 md:hidden",
        "border-t border-border bg-background/95 backdrop-blur-sm pb-safe",
      )}
    >
      <div className="mx-auto flex h-[var(--shell-bottom-nav-height)] max-w-lg items-stretch justify-around">
        {BOTTOM_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex min-w-[44px] flex-1 flex-col items-center",
                "justify-center gap-0.5 px-1 py-1 text-[10px] font-medium sm:text-xs",
                "transition-colors duration-200",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active ? (
                <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary" />
              ) : null}
              <Icon size={20} weight={active ? "fill" : "regular"} />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
