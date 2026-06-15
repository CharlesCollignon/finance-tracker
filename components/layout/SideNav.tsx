"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { APP_NAV_ITEMS } from "@/lib/navigation";
import { SignOutButton } from "@/components/layout/SignOutButton";

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden md:flex md:w-56 lg:w-64",
        "flex-col border-r-2 border-border bg-background",
        "sticky top-0 h-screen pt-safe",
      )}
    >
      <div className="flex items-center gap-2 border-b-2 border-border px-5 py-5">
        <Wallet size={28} weight="fill" className="text-primary" />
        <span className="font-head text-lg">Finance</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {APP_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded px-3 py-2",
                "text-sm font-medium transition-colors",
                active
                  ? "border-2 border-border bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon size={20} weight={active ? "fill" : "regular"} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t-2 border-border p-3">
        <SignOutButton className="w-full justify-start px-3" />
      </div>
    </aside>
  );
}
