"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_NAV_ITEMS, PROFILE_NAV_ITEM } from "@/lib/navigation";
import { SHELL_HEADER_BAND_CLASS } from "@/lib/layout-shell";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function SideNav() {
  const pathname = usePathname();
  const ProfileIcon = PROFILE_NAV_ITEM.icon;
  const profileActive = pathname.startsWith(PROFILE_NAV_ITEM.href);

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
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon size={18} weight={active ? "fill" : "regular"} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 flex-col items-center gap-2 border-t border-border p-3">
        <ThemeToggle />
        <Link
          href={PROFILE_NAV_ITEM.href}
          className={cn(
            "flex w-full min-h-10 items-center gap-3 rounded-md px-3 py-2",
            "text-sm font-medium transition-colors duration-200",
            profileActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <ProfileIcon size={18} weight={profileActive ? "fill" : "regular"} />
          {PROFILE_NAV_ITEM.label}
        </Link>
      </div>
    </aside>
  );
}
