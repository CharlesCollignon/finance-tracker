"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_NAV_ITEMS } from "@/lib/navigation";
import { SHELL_HEADER_BAND_CLASS } from "@/lib/layout-shell";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Logo } from "@/components/layout/Logo";

export function SideNav({
  displayName,
  initial,
}: {
  displayName: string;
  initial: string;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden md:flex md:w-56 lg:w-64",
        "sticky top-0 h-screen flex-col",
        "border-r border-border bg-background",
      )}
    >
      <div
        className={cn(
          SHELL_HEADER_BAND_CLASS,
          "flex items-center justify-center px-5",
        )}
      >
        <Logo />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {APP_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-md px-3 py-2",
                "text-sm font-medium transition-colors duration-200",
                active
                  ? "bg-primary/10 text-primary-ink"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon size={18} weight={active ? "fill" : "light"} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 flex-col border-t border-border p-3">
        <AccountMenu
          variant="side"
          displayName={displayName}
          initial={initial}
        />
      </div>
    </aside>
  );
}
