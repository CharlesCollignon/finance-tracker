"use client";

import { Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { GLASS_CHROME } from "@/lib/glass";
import { SHELL_HEADER_BAND_CLASS } from "@/lib/layout-shell";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { BranchedNav } from "@/components/layout/BranchedNav";
import { Logo } from "@/components/layout/Logo";
import { useQuickAdd } from "@/components/layout/QuickAddProvider";
import { RefreshButton } from "@/components/layout/RefreshButton";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

/**
 * Whether to spell the quick-add shortcut with a Command glyph.
 *
 * Read from the browser rather than passed down, because the shortcut is
 * decided by the keyboard in front of the reader and nothing the server knows.
 * `navigator.platform` is deprecated but is the only field that still answers
 * this in every engine; the optional chain keeps it safe before hydration.
 */
function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /mac|iphone|ipad|ipod/i.test(
    (navigator as { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ?? navigator.platform,
  );
}

/** The app's primary action, given the top slot rather than a page to visit. */
function QuickAddButton() {
  const t = useT();
  const quickAdd = useQuickAdd();

  if (!quickAdd) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => quickAdd.open()}
      className={cn(
        "flex min-h-10 w-full items-center gap-3 rounded-control px-3 py-2",
        "bg-primary text-sm font-medium text-primary-foreground",
        "transition-colors duration-hover hover:bg-primary-hover",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <Plus size={ICON.lg} weight="bold" className="shrink-0" />
      {/* A flex item of its own rather than a bare text node, because a bare
          one wraps: "Ajouter une transaction" is half again as long as "Add
          transaction" and broke this button onto two lines in French, which
          moved the rail's primary action out of line with every row under it.
          `truncate` carries `whitespace-nowrap`, so the label stays on one
          line in any language and ellipsises rather than wrapping if a longer
          one ever arrives. `min-w-0` is what lets it shrink at all inside a
          flex row. */}
      <span className="min-w-0 flex-1 truncate text-left">
        {t("common.addTransaction")}
      </span>
      {/* The badge used to read `N`, and the binding behind it was removed
          because a bare letter opens this sheet over whatever a screen reader
          is in the middle of (WCAG 2.1 SC 2.1.4). The badge stayed, which left
          the only keyboard hint in the app teaching a key that does nothing.
          It names the surviving shortcut instead, and reads the platform so a
          Windows or Linux reader is not told to press a key their keyboard
          does not have. */}
      <kbd className="shrink-0 rounded-control bg-black/15 px-1.5 py-0.5 text-xs font-normal">
        {isApplePlatform() ? "\u2318K" : "Ctrl K"}
      </kbd>
    </button>
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
        <Logo />
      </div>

      <div className="flex flex-col gap-1 px-3 pt-3">
        <QuickAddButton />
        {/* Under the primary action rather than in the header band: it is a
            frequent press but never the first one, and here it has room to
            say when the figures were last checked. */}
        <RefreshButton variant="wide" />
      </div>

      <BranchedNav ledgerBadge={ledgerBadge} />

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
