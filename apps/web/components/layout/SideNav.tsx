"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { GLASS_CHROME } from "@/lib/glass";
import { activeNavHref, APP_NAV_ITEMS } from "@/lib/navigation";
import { SHELL_HEADER_BAND_CLASS } from "@/lib/layout-shell";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Logo } from "@/components/layout/Logo";
import { useQuickAdd } from "@/components/layout/QuickAddProvider";
import { RefreshButton } from "@/components/layout/RefreshButton";

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

/**
 * How many things are waiting behind a destination.
 *
 * Deliberately a count and not a dot. "Something needs you here" is a nudge;
 * "three things need you here" is information, and the difference decides
 * whether it is worth the trip.
 */
function NavBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      aria-label={`${count} waiting`}
      className={cn(
        "ml-auto inline-flex min-w-5 items-center justify-center rounded-full",
        "bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none",
        "text-primary-foreground tabular-nums",
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function SideNav({
  displayName,
  initial,
  ledgerBadge = 0,
}: {
  displayName: string;
  initial: string;
  ledgerBadge?: number;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden md:flex md:w-56 lg:w-64",
        "sticky top-0 h-screen flex-col",
        "border-r",
        GLASS_CHROME,
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

      <div className="flex flex-col gap-1 px-3 pt-3">
        <QuickAddButton />
        {/* Under the primary action rather than in the header band: it is a
            frequent press but never the first one, and here it has room to
            say when the figures were last checked. */}
        <RefreshButton variant="wide" />
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
                {href === "/transactions" ? (
                  <NavBadge count={ledgerBadge} />
                ) : null}
              </Link>

              {/* Always expanded, at the owner's request. The nav was
                  collapsed to five destinations because eight was too many to
                  scan, and revealing a surface's views only while you stood
                  in it kept that count honest — but it also hid the fact that
                  the Ledger has a calendar and a per-category history at all,
                  which is a poor trade for anyone who knows the app. Only the
                  Ledger has views, so this is three extra rows, not eight. */}
              {children.length > 0 ? (
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
                            // Dimmer while you are elsewhere, so the active
                            // surface still reads as the one you are in.
                            !active && !here && "text-muted-foreground/60",
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
