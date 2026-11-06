"use client";

import Link from "next/link";
import { Plus } from "@phosphor-icons/react";
import { AskButton } from "@/components/ask/AskButton";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Logo } from "@/components/layout/Logo";
import { OwnerSwitch } from "@/components/layout/OwnerSwitch";
import { PrivacyToggle } from "@/components/layout/PrivacyToggle";
import { useQuickAdd } from "@/components/layout/QuickAddProvider";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { ICON } from "@/lib/icon-scale";
import { NO_BADGES, type NavBadges } from "@/lib/nav-badges";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import { useNavEntries, type NavEntry } from "./use-nav";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface NavProps {
  displayName: string;
  initial: string;
  nouveautes?: number;
  badges?: NavBadges;
  showProperty?: boolean;
}

/**
 * « Bento », from `md`: the surfaces in a dark tile of their own down the
 * left, the one tile on the page that is not white. `.bento-rail` restates
 * the palette inside it (`globals.css`), so everything it holds — the
 * switch, the account, the add in lime — is drawn for a dark ground without
 * knowing it is on one. The logo is the same orb and wordmark as anywhere.
 */
export function BentoRail({
  displayName,
  initial,
  nouveautes = 0,
  badges = NO_BADGES,
  showProperty = false,
}: NavProps) {
  const t = useT();
  const quickAdd = useQuickAdd();
  const entries = useNavEntries(showProperty, badges);

  return (
    <aside className="bento-rail fixed bottom-4 left-4 top-4 z-40 hidden w-56 flex-col gap-5 rounded-[28px] p-4 md:flex">
      <div className="px-2 pt-1">
        <Logo />
      </div>
      <OwnerSwitch className="self-start" />
      <nav aria-label={t("nav.main")} className="flex flex-col gap-1">
        {entries.map((entry) => (
          <RailLink key={entry.href} entry={entry} />
        ))}
      </nav>
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <AskButton tone="bar" />
        <RefreshButton tone="bar" />
        <PrivacyToggle tone="bar" />
        <span className="flex-1" />
        <AccountMenu
          displayName={displayName}
          initial={initial}
          nouveautes={nouveautes}
        />
      </div>
      {quickAdd ? (
        <button
          type="button"
          onClick={() => quickAdd.open()}
          className={cn(
            "flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground",
            "transition-colors duration-hover hover:bg-primary-hover",
            FOCUS_RING,
          )}
        >
          <Plus size={ICON.md} weight="bold" aria-hidden />
          {/* « Ajouter », short enough for the rail; the sheet names the rest. */}
          {t("add.title")}
        </button>
      ) : null}
    </aside>
  );
}

function RailLink({ entry }: { entry: NavEntry }) {
  const t = useT();
  const Icon = entry.icon;
  return (
    <Link
      href={entry.href}
      aria-current={entry.active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-2xl px-3 text-[15px] transition-colors duration-hover",
        entry.active
          ? "bg-muted font-semibold text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        FOCUS_RING,
      )}
    >
      <Icon
        size={ICON.lg}
        weight={entry.active ? "fill" : "regular"}
        aria-hidden
      />
      <span className="flex-1 truncate">{entry.label}</span>
      {entry.waiting > 0 ? (
        <span
          aria-label={t("nav.waiting", { count: entry.waiting })}
          className="min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-primary-foreground tabular-nums"
        >
          {entry.waiting > 9 ? "9+" : entry.waiting}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * « Bento », below `md`: a dark pill floating over the foot of the screen,
 * the surfaces as icons (their names kept for screen readers and the
 * tooltip) and the add as a lime disc in the middle of them — the one action
 * every screen shares, where the thumb is. The floating add of the other
 * designs is not drawn here (`.quick-add-fab` in `globals.css`).
 */
export function BentoDock({
  badges = NO_BADGES,
  showProperty = false,
}: Pick<NavProps, "badges" | "showProperty">) {
  const t = useT();
  const quickAdd = useQuickAdd();
  const entries = useNavEntries(showProperty, badges);
  const middle = Math.ceil(entries.length / 2);

  const link = (entry: NavEntry) => {
    const Icon = entry.icon;
    return (
      <Link
        key={entry.href}
        href={entry.href}
        aria-current={entry.active ? "page" : undefined}
        title={entry.label}
        className={cn(
          "relative flex size-12 shrink-0 items-center justify-center rounded-full transition-colors duration-hover",
          entry.active
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground",
          FOCUS_RING,
        )}
      >
        <Icon
          size={ICON.xl}
          weight={entry.active ? "fill" : "regular"}
          aria-hidden
        />
        <span className="sr-only">{entry.label}</span>
        {entry.waiting > 0 ? (
          <span
            aria-label={t("nav.waiting", { count: entry.waiting })}
            className="absolute right-2 top-2 size-2 rounded-full bg-primary"
          />
        ) : null}
      </Link>
    );
  };

  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:hidden"
    >
      <div className="bento-rail mx-auto flex h-16 max-w-lg items-center justify-around rounded-full px-2">
        {entries.slice(0, middle).map(link)}
        {quickAdd ? (
          <button
            type="button"
            aria-label={t("add.open")}
            onClick={() => quickAdd.open()}
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground",
              "transition-transform duration-hover active:scale-95",
              FOCUS_RING,
            )}
          >
            <Plus size={ICON.xl} weight="bold" aria-hidden />
          </button>
        ) : null}
        {entries.slice(middle).map(link)}
      </div>
    </nav>
  );
}
