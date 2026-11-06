"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AskButton } from "@/components/ask/AskButton";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Logo } from "@/components/layout/Logo";
import { OwnerSwitch } from "@/components/layout/OwnerSwitch";
import { PrivacyToggle } from "@/components/layout/PrivacyToggle";
import { useQuickAdd } from "@/components/layout/QuickAddProvider";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { NO_BADGES, type NavBadges } from "@/lib/nav-badges";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import { paletteShortcut, useNavEntries } from "./use-nav";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

interface NavProps {
  displayName: string;
  initial: string;
  nouveautes?: number;
  badges?: NavBadges;
  showProperty?: boolean;
}

/** The letter after `g` that goes to each surface. */
const SHORTCUT: Record<string, string> = {
  "/bearing": "p",
  "/calendar": "j",
  "/recurring": "r",
  "/investments": "i",
  "/property": "m",
  "/plan": "l",
};

const subscribeToNothing = () => () => {};

/**
 * The palette's shortcut: « Ctrl K » on the server and while hydrating, the
 * reader's own keyboard's after (it depends on the OS).
 */
function useShortcutLabel(): string {
  return useSyncExternalStore(
    subscribeToNothing,
    paletteShortcut,
    () => "Ctrl K",
  );
}

/**
 * `g` then a letter goes to a surface, as in a terminal or a mail client.
 *
 * Bare letters, which WCAG 2.1 SC 2.1.4 allows only when the shortcut can be
 * turned off — and it can: these exist in « Console » alone, a design the
 * reader picks, and choosing any other turns them off. They never fire from
 * a field, a modifier held, or an editable element, so typing is never taken
 * for navigating.
 */
function useSurfaceShortcuts(hrefList: string) {
  const router = useRouter();
  useEffect(() => {
    const hrefs = hrefList.split(",");
    let armedAt = 0;
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "g") {
        armedAt = Date.now();
        return;
      }
      if (armedAt && Date.now() - armedAt < 1200) {
        armedAt = 0;
        const href = hrefs.find((h) => SHORTCUT[h] === key);
        if (href) {
          event.preventDefault();
          router.push(href);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hrefList, router]);
}

/**
 * The field that is not a field: a button drawn as a prompt, which opens
 * the palette — where « 23,45 courses » adds an entry and a page's name goes
 * to it. A real input here would be a second, weaker palette.
 */
function CommandField({ className }: { className?: string }) {
  const t = useT();
  const quickAdd = useQuickAdd();
  const shortcut = useShortcutLabel();
  if (!quickAdd) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={() => quickAdd.openPalette()}
      className={cn(
        "flex h-11 min-w-0 items-center gap-3 border border-hairline-strong bg-card px-3 text-left font-mono text-[13px] text-muted-foreground",
        "transition-colors duration-hover hover:text-foreground",
        FOCUS_RING,
        className,
      )}
    >
      <span aria-hidden className="text-primary">
        ›
      </span>
      <span className="min-w-0 flex-1 truncate">{t("nav.command")}</span>
      <kbd className="hidden border border-hairline-strong px-1.5 py-0.5 text-[11px] sm:inline">
        {shortcut}
      </kbd>
    </button>
  );
}

/**
 * « Console », from `md`: a command bar across the top — the logo, the
 * switch, the prompt, the controls — and the surfaces as a list down the
 * left, each with its shortcut. Square, ruled, in the mono face; the logo is
 * the same orb and wordmark as every other design.
 */
export function ConsoleBar({
  displayName,
  initial,
  nouveautes = 0,
  badges = NO_BADGES,
  showProperty = false,
}: NavProps) {
  const t = useT();
  const entries = useNavEntries(showProperty, badges);
  useSurfaceShortcuts(entries.map((entry) => entry.href).join(","));

  return (
    <div className="hidden md:block">
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-background px-4">
        <Logo className="md:text-[1.5rem]" />
        <OwnerSwitch />
        <CommandField className="mx-auto w-full max-w-xl" />
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
      </header>
      <nav
        aria-label={t("nav.main")}
        className="fixed bottom-0 left-0 top-14 z-30 flex w-52 flex-col border-r border-border bg-background py-3 font-mono text-xs uppercase tracking-[0.06em]"
      >
        {entries.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            aria-current={entry.active ? "page" : undefined}
            aria-keyshortcuts={
              SHORTCUT[entry.href] ? `g ${SHORTCUT[entry.href]}` : undefined
            }
            className={cn(
              "flex min-h-10 items-center justify-between gap-2 border-l-2 px-4 transition-colors duration-hover",
              entry.active
                ? "border-primary bg-muted text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
              FOCUS_RING,
            )}
          >
            <span className="truncate">
              {entry.label}
              {entry.waiting > 0 ? (
                <span
                  aria-label={t("nav.waiting", { count: entry.waiting })}
                  className="ml-2 text-primary tabular-nums"
                >
                  {entry.waiting > 9 ? "9+" : entry.waiting}
                </span>
              ) : null}
            </span>
            {SHORTCUT[entry.href] ? (
              <span aria-hidden className="text-muted-foreground">
                G {SHORTCUT[entry.href]!.toUpperCase()}
              </span>
            ) : null}
          </Link>
        ))}
        <p className="mt-auto px-4 normal-case tracking-normal text-muted-foreground">
          {t("nav.shortcuts")}
        </p>
      </nav>
    </div>
  );
}

/**
 * « Console », below `md`: the prompt over a row of square tabs, numbered
 * as a terminal's would be; the one you are in is filled with the accent.
 * The prompt is the add here, so the floating add is not drawn
 * (`.quick-add-fab` in `globals.css`).
 */
export function ConsoleTabs({
  badges = NO_BADGES,
  showProperty = false,
}: Pick<NavProps, "badges" | "showProperty">) {
  const t = useT();
  const entries = useNavEntries(showProperty, badges);

  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-2 pb-[env(safe-area-inset-bottom,0px)] pt-2 md:hidden"
    >
      <CommandField className="mb-2 w-full" />
      <div
        className="grid h-12 font-mono text-[10px] uppercase tracking-[0.04em]"
        style={{
          gridTemplateColumns: `repeat(${entries.length}, minmax(0, 1fr))`,
        }}
      >
        {entries.map((entry, index) => (
          <Link
            key={entry.href}
            href={entry.href}
            aria-current={entry.active ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 px-0.5",
              entry.active
                ? "bg-primary font-semibold text-primary-foreground"
                : "text-muted-foreground",
              FOCUS_RING,
            )}
          >
            <span aria-hidden className="text-[11px] tabular-nums">
              {index + 1}
            </span>
            <span className="max-w-full truncate">{entry.label}</span>
            {entry.waiting > 0 ? (
              <span
                aria-label={t("nav.waiting", { count: entry.waiting })}
                className={cn(
                  "absolute right-1 top-1 size-1.5",
                  entry.active ? "bg-primary-foreground" : "bg-primary",
                )}
              />
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}
