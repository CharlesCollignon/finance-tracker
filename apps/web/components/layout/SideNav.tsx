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
      <Plus size={ICON.lg} weight="bold" />
      {t("common.addTransaction")}
      <kbd className="ml-auto rounded-control bg-black/15 px-1.5 py-0.5 text-[10px] font-normal">
        N
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
