"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { activeNavHref, APP_NAV_ITEMS } from "@/lib/navigation";
import { SHELL_HEADER_BAND_CLASS } from "@/lib/layout-shell";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Logo } from "@/components/layout/Logo";
import { useQuickAdd } from "@/components/layout/QuickAddProvider";

/** The app's primary action, given the top slot rather than a page to visit. */
function QuickAddButton() {
  const quickAdd = useQuickAdd();

  if (!quickAdd) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => quickAdd.open()}
      className={cn(
        "flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2",
        "bg-primary text-sm font-medium text-primary-foreground",
        "transition-colors duration-200 hover:bg-primary-hover",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <Plus size={18} weight="bold" />
      Add transaction
      <kbd className="ml-auto rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-normal">
        N
      </kbd>
    </button>
  );
}

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
        <Logo mark="full" />
      </div>

      <div className="px-3 pt-3">
        <QuickAddButton />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {APP_NAV_ITEMS.map(({ href, label, icon: Icon, children }) => {
          const active = activeNavHref(pathname) === href;

          return (
            <div key={href} className="flex flex-col gap-0.5">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
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

              {/* Only while you are in the surface: a permanently expanded
                  tree turns five destinations back into eight, which is the
                  thing the nav was collapsed to avoid. */}
              {active && children.length > 0 ? (
                <ul className="ml-[1.65rem] flex flex-col border-l border-border">
                  {children.map((child) => {
                    const here = pathname === child.href;
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={here ? "page" : undefined}
                          className={cn(
                            "-ml-px flex min-h-9 items-center border-l pl-3 text-sm",
                            "transition-colors duration-200",
                            here
                              ? "border-primary-rim font-medium text-foreground"
                              : "border-transparent text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
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
