"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavHref, APP_NAV_ITEMS } from "@/lib/navigation";
import {
  branchPath,
  childrenHeight,
  INDENT,
  reachPath,
  ROW_HEIGHT,
  trunkPath,
} from "@/lib/nav-tree";
import { useT } from "@/lib/locale-context";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";

/**
 * The sidebar's destinations, drawn as a tree.
 *
 * Adapted from React Bits' BranchedMenu. What it contributes is the drawing:
 * a trunk down the left of a surface's views, a curved branch out to each
 * one, and — on the view you are actually in — the same path redrawn in the
 * accent colour and animated in with `stroke-dashoffset`. The app already
 * draws that way; `bearing/Spine` animates a ring with the same property and
 * the same `cssEasing()` curve, which is why none of this needed a library.
 *
 * What was deliberately not taken from it:
 *
 * Its rows are buttons calling `onSelect`. These are `next/link`s, because a
 * destination that cannot be middle-clicked, opened in a new tab, or
 * prefetched on hover is not a link — it is a button that happens to
 * navigate, and the sidebar would have quietly lost three behaviours the app
 * had.
 *
 * Its section headers fold. These do not, and nothing here does: every
 * surface's views are always drawn and always reachable. There was a caret
 * beside each header once, and openness was derived — the surface you were in
 * was open unless you had said otherwise — which meant the Ledger's three
 * views and the Wallets' two were hidden whenever you were anywhere else. A
 * sidebar that hides most of the app until you are already in it is a menu
 * that answers questions you have stopped asking, so the fold, its state, its
 * caret and the row that held them are gone. A header is only a link now.
 *
 * Its colours arrive as hex props. These are the app's CSS variables, so the
 * tree follows the theme instead of pinning a second palette beside it.
 *
 * Its geometry is props too. Here it is the constants in `lib/nav-tree`,
 * because a sidebar has one shape and the alternative is five numbers that
 * can be set to values that do not meet. They live in their own module
 * rather than here so the marketing mock can draw the same tree instead of a
 * flat list beside a screenshot of one.
 */

/**
 * How many things are waiting behind a destination.
 *
 * Deliberately a count and not a dot. "Something needs you here" is a nudge;
 * "three things need you here" is information, and the difference decides
 * whether it is worth the trip.
 */
function NavBadge({ count }: { count: number }) {
  const t = useT();

  if (count <= 0) {
    return null;
  }

  return (
    <span
      aria-label={t("nav.waiting", { count })}
      className={cn(
        "ml-auto inline-flex min-w-5 items-center justify-center rounded-full",
        "bg-primary px-1.5 py-0.5 text-[10px] leading-none font-semibold",
        "text-primary-foreground tabular-nums",
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function BranchedNav({ ledgerBadge = 0 }: { ledgerBadge?: number }) {
  const t = useT();
  const pathname = usePathname();
  const here = activeNavHref(pathname);

  return (
    <nav
      className={cn(
        "relative flex flex-1 flex-col overflow-y-auto p-3",
        // The rail the whole tree hangs from, fading out at the bottom so it
        // reads as an edge rather than as a border with an end.
        "before:absolute before:top-4 before:bottom-3 before:left-1.5 before:w-px",
        "before:bg-gradient-to-b before:from-hairline-strong before:via-hairline-strong",
        "before:to-transparent before:content-['']",
      )}
    >
      {APP_NAV_ITEMS.map((item) => (
        <Section
          key={item.href}
          item={item}
          here={here}
          pathname={pathname}
          badge={item.href === "/transactions" ? ledgerBadge : 0}
          t={t}
        />
      ))}
    </nav>
  );
}

type NavItem = (typeof APP_NAV_ITEMS)[number];

function Section({
  item,
  here,
  pathname,
  badge,
  t,
}: {
  item: NavItem;
  here: string | null;
  pathname: string;
  badge: number;
  t: ReturnType<typeof useT>;
}) {
  const Icon = item.icon;
  const kids = item.children;
  const active = here === item.href;
  // Which view of this surface is being looked at, if any. `-1` means none,
  // which is what leaves the accent path undrawn.
  const current = kids.findIndex((kid) => kid.href === pathname);

  const blockHeight = childrenHeight(kids.length);
  const label = t(item.labelKey);

  const branches = useMemo(
    () => kids.map((kid, index) => ({ key: kid.href, d: branchPath(index) })),
    [kids],
  );

  return (
    <div className="relative flex flex-col">
      {/* The marker on the rail. Present only for the surface you are in, so
          the rail says where you are before any of the words do. */}
      {active ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-3 -left-1.5 z-10 h-4 w-0.5 rounded-full bg-primary",
          )}
        />
      ) : null}

      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-control px-3 py-2",
          "text-sm font-medium transition-colors duration-hover",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          active
            ? "text-primary-ink bg-primary/10"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon size={ICON.lg} weight={active ? "fill" : "light"} />
        {label}
        <NavBadge count={badge} />
      </Link>

      {kids.length > 0 ? (
        <div className="relative" style={{ height: blockHeight }}>
          <svg
            width={INDENT}
            height={blockHeight}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 overflow-visible"
          >
            <path
              d={trunkPath(kids.length)}
              className="fill-none stroke-hairline-strong"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            {branches.map((branch) => (
              <path
                key={branch.key}
                d={branch.d}
                className="fill-none stroke-hairline-strong"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* The accent, traced from the top of the trunk to the view
                    you are in. One path, redrawn when the view changes, which
                    is what makes it travel between branches rather than blink
                    from one to the next. */}
            {current >= 0 ? (
              <path
                d={reachPath(current)}
                className="stroke-primary fill-none"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </svg>

          {kids.map((kid) => {
            const on = kid.href === pathname;
            return (
              <Link
                key={kid.href}
                href={kid.href}
                aria-current={on ? "page" : undefined}
                style={{ height: ROW_HEIGHT, paddingLeft: INDENT }}
                className={cn(
                  "flex items-center rounded-control pr-3 text-sm",
                  "transition-colors duration-hover",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  on
                    ? "text-primary-ink font-medium"
                    : "hover:text-foreground text-muted-foreground",
                  // Dimmer while you are elsewhere, so the surface you are
                  // actually in still reads as the one you are in.
                  !active && !on && "text-muted-foreground/60",
                )}
              >
                {t(kid.labelKey)}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
