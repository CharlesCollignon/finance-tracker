"use client";

import Link from "next/link";
import { AskButton } from "@/components/ask/AskButton";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Logo } from "@/components/layout/Logo";
import { OwnerSwitch } from "@/components/layout/OwnerSwitch";
import { PrivacyToggle } from "@/components/layout/PrivacyToggle";
import { useQuickAdd } from "@/components/layout/QuickAddProvider";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { NO_BADGES, type NavBadges } from "@/lib/nav-badges";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import { useNavEntries } from "./use-nav";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface NavProps {
  displayName: string;
  initial: string;
  nouveautes?: number;
  badges?: NavBadges;
  showProperty?: boolean;
}

/** Today, the way a front page dates itself: « vendredi 6 novembre 2026 ». */
function useDateline(): string {
  const locale = useLocale();
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

/**
 * « Papier », from `md`: a masthead, as a ledger or a newspaper has one. The
 * date and the controls every screen shares on a line of their own, then,
 * between a double rule and a single one, the logo — the same orb and
 * wordmark as every design, only larger — the surfaces as words, and « Noter »
 * in ink. It sits in the page's flow and scrolls away with it: a front page
 * does not follow you down.
 *
 * The surface you are in is underlined in the accent; a count of what waits
 * behind a surface follows its name in figures, as a ledger would write it.
 */
export function PapierMasthead({
  displayName,
  initial,
  nouveautes = 0,
  badges = NO_BADGES,
  showProperty = false,
}: NavProps) {
  const t = useT();
  const quickAdd = useQuickAdd();
  const entries = useNavEntries(showProperty, badges);
  const dateline = useDateline();

  return (
    <header className="hidden md:block">
      <div className="mx-auto w-full max-w-6xl px-6 pt-4">
        <div className="flex items-center justify-between gap-4 pb-2">
          <span
            suppressHydrationWarning
            className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground first-letter:uppercase"
          >
            {dateline}
          </span>
          <div className="flex items-center gap-1">
            <AskButton tone="bar" />
            <RefreshButton tone="bar" />
            <PrivacyToggle tone="bar" />
            <AccountMenu
              displayName={displayName}
              initial={initial}
              nouveautes={nouveautes}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-foreground py-4 [border-top-width:3px]">
          <Logo className="md:text-[2.25rem]" />
          <OwnerSwitch />
          <nav
            aria-label={t("nav.main")}
            className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-1"
          >
            {entries.map((entry) => (
              <Link
                key={entry.href}
                href={entry.href}
                aria-current={entry.active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 border-b-[3px] font-serif text-lg transition-colors duration-hover",
                  entry.active
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                  FOCUS_RING,
                )}
              >
                {entry.label}
                {entry.waiting > 0 ? (
                  <span
                    aria-label={t("nav.waiting", { count: entry.waiting })}
                    className="text-sm font-normal tabular-nums text-primary-ink"
                  >
                    ({entry.waiting > 9 ? "9+" : entry.waiting})
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
          {quickAdd ? (
            <button
              type="button"
              onClick={() => quickAdd.open()}
              className={cn(
                "h-11 shrink-0 rounded-control bg-foreground px-5 text-sm font-semibold text-background",
                "transition-opacity duration-hover hover:opacity-85",
                FOCUS_RING,
              )}
            >
              {t("add.open")}
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/**
 * « Papier », below `md`: the surfaces as words on a ruled line at the foot
 * of the screen, no icons and no glass. The one you are in is set heavier,
 * under a bar of the accent; a dot says something waits behind another.
 */
export function PapierTabs({
  badges = NO_BADGES,
  showProperty = false,
}: Pick<NavProps, "badges" | "showProperty">) {
  const t = useT();
  const entries = useNavEntries(showProperty, badges);

  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-foreground bg-background pb-[env(safe-area-inset-bottom,0px)] md:hidden"
    >
      <div
        className="mx-auto grid h-[var(--shell-bottom-nav-height)] max-w-lg"
        style={{
          gridTemplateColumns: `repeat(${entries.length}, minmax(0, 1fr))`,
        }}
      >
        {entries.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            aria-current={entry.active ? "page" : undefined}
            className={cn(
              "@container relative -mt-px flex items-center justify-center border-t-[3px] px-0.5",
              entry.active
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground",
              FOCUS_RING,
            )}
          >
            <span className="max-w-full truncate font-serif text-[clamp(11px,16cqi,15px)]">
              {entry.label}
            </span>
            {entry.waiting > 0 ? (
              <span
                aria-label={t("nav.waiting", { count: entry.waiting })}
                className="absolute right-1 top-2 size-1.5 rounded-full bg-primary"
              />
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}
