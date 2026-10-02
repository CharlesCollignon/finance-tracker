"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { activeNavHref, navItems } from "@/lib/navigation";
import { GLASS_PANEL } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

/**
 * The surfaces, at phone width. The account menu is in the page header, as
 * on the phone app, so every target here is a surface.
 */
export function BottomNav({
  ledgerBadge = 0,
  showProperty = false,
}: {
  ledgerBadge?: number;
  /** The Immobilier surface, for an account with `property.track`. */
  showProperty?: boolean;
}) {
  const t = useT();
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
          "border",
          GLASS_PANEL,
        )}
      >
        {navItems({ property: showProperty }).map(
          ({ href, labelKey, icon: Icon }) => {
            const active = activeNavHref(pathname) === href;

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  // A container, so its label can size itself to the slot.
                  "@container relative flex min-w-[44px] flex-1 flex-col items-center",
                  "justify-center gap-0.5 rounded-full my-1 py-1",
                  "font-medium",
                  "transition-colors duration-hover",
                  // Foreground colour and a filled glyph, not a pill. The
                  // Navigation section of DESIGN.md says the active state is
                  // carried by colour, and the gold wash behind it was the
                  // accent spent on a state that two other channels — the step
                  // up from muted foreground and the icon's `fill` weight —
                  // already make unmistakable.
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={ICON.xl} weight={active ? "fill" : "light"} />
                {/* A dot rather than a count down here. The bar is five or six
                  targets across a phone; a numeral beside a 10px label is
                  unreadable and the number is on the Bearing anyway. */}
                {href === "/transactions" && ledgerBadge > 0 ? (
                  <span
                    aria-label={t("nav.waiting", { count: ledgerBadge })}
                    className="absolute right-1.5 top-1 size-1.5 rounded-full bg-foreground"
                  />
                ) : null}
                {/* 10px where the slot allows it, down to 8px rather than
                  cutting « Placements » to « Placeme… » on a 360px phone:
                  at 15cqi the longest label, « Placements », fits its slot at
                  every width measured from 320px to 414px. Truncating stays as the last resort. */}
                <span className="max-w-full truncate px-0.5 text-[clamp(8px,15cqi,10px)] sm:text-xs">
                  {t(labelKey)}
                </span>
              </Link>
            );
          },
        )}
      </div>
    </nav>
  );
}
