"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_ITEMS } from "@/lib/navigation";

export function BottomNav({
  displayName,
  initial,
}: {
  displayName: string;
  initial: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 md:hidden",
        "px-4 pb-[calc(var(--shell-bottom-nav-inset)+env(safe-area-inset-bottom,0px))]",
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-[var(--shell-bottom-nav-height)] max-w-lg",
          "items-stretch justify-around rounded-full",
          "border border-border bg-background/40 backdrop-blur-xl",
        )}
      >
        {BOTTOM_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex min-w-[44px] flex-1 flex-col items-center",
                "justify-center gap-0.5 rounded-full mx-0.5 my-1 px-1 py-1",
                "text-[10px] font-medium sm:text-xs",
                "transition-colors duration-200",
                active
                  ? "bg-primary/15 text-primary-ink"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={20} weight={active ? "fill" : "light"} />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
        <AccountMenu
          variant="bottom"
          displayName={displayName}
          initial={initial}
        />
      </div>
    </nav>
  );
}
