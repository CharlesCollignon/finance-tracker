"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Plus } from "@phosphor-icons/react";
import type { MerchantRule } from "@finance/core/merchant-memory";
import type { Category, Tag } from "@finance/core/types/database";
import { QuickAddSheet } from "@/components/finance/QuickAddSheet";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

interface QuickAddValue {
  /** Opens the sheet, optionally on a specific date. */
  open: (date?: string) => void;
  isOpen: boolean;
}

const QuickAddContext = createContext<QuickAddValue | null>(null);

/**
 * Adding a transaction from anywhere.
 *
 * Lives in the app layout rather than on the transactions page, because the
 * thing the app exists for should not require navigating somewhere first. The
 * data it needs is fetched once by the layout, so the sheet opens with no
 * loading state.
 */
export function QuickAddProvider({
  children,
  categories,
  tags,
  recentCategoryIds,
  merchants,
}: {
  children: ReactNode;
  categories: Category[];
  tags: Tag[];
  recentCategoryIds: string[];
  merchants: MerchantRule[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState<string | undefined>(undefined);

  const open = useCallback((nextDate?: string) => {
    setDate(nextDate);
    setIsOpen(true);
  }, []);

  // The installed app's "Add transaction" shortcut lands on /transactions?add=1.
  // Read from location rather than useSearchParams, which would force every
  // page under this provider into a Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("add") !== "1") {
      return;
    }
    // Reading a launch intent out of the URL is a genuine synchronise-with-an-
    // external-system case, and it runs at most once per navigation. A lazy
    // useState initializer would be the usual alternative, but the server
    // cannot see the query string, so it would desync hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOpen(true);
    params.delete("add");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, []);

  /**
   * One shortcut, and it carries a modifier.
   *
   * There were two. Beside Cmd/Ctrl+K there was a bare `n`, bound on `window`
   * for the whole app and guarded only by "the focus is not in a field". That
   * is WCAG 2.1 SC 2.1.4 Character Key Shortcuts at Level A, which PRODUCT.md
   * makes blocking rather than advisory, and the failure it describes is not
   * hypothetical here: a screen reader in browse mode sends single letters to
   * the page as navigation keys — `n` is a quick-nav key in several of them —
   * and voice dictation puts whatever was said onto whatever has focus. Either
   * one opened a transaction sheet over the reader's place on the page, from a
   * keystroke meant for something else.
   *
   * The guidance offers three remedies: let the shortcut be turned off,
   * let it be remapped, or require a modifier. A single-user app with no
   * settings surface for keybindings has one of those, so `n` is gone and
   * Cmd/Ctrl+K — which is exempt, being modified — is the whole of it.
   */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setDate(undefined);
        setIsOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const value = useMemo<QuickAddValue>(
    () => ({ open, isOpen }),
    [open, isOpen],
  );

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      <QuickAddFab />
      <QuickAddSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        categories={categories}
        tags={tags}
        recentCategoryIds={recentCategoryIds}
        merchants={merchants}
        defaultDate={date}
      />
    </QuickAddContext.Provider>
  );
}

/** Null outside the app shell (marketing, auth), so callers can no-op. */
export function useQuickAdd(): QuickAddValue | null {
  return useContext(QuickAddContext);
}

/**
 * Thumb-reachable add button on small screens. The bottom nav is already full,
 * so this floats clear of it rather than competing for a slot.
 */
function QuickAddFab() {
  const t = useT();
  const quickAdd = useQuickAdd();

  if (!quickAdd || quickAdd.isOpen) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={t("common.addTransaction")}
      onClick={() => quickAdd.open()}
      className={cn(
        "fixed right-4 z-40 md:hidden",
        "bottom-[calc(var(--shell-bottom-nav-height)+var(--shell-bottom-nav-inset)+env(safe-area-inset-bottom,0px)+1rem)]",
        "flex h-14 w-14 items-center justify-center rounded-full",
        "bg-primary text-primary-foreground shadow-lg",
        "transition-transform duration-hover active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <Plus size={ICON.hero} weight="bold" />
    </button>
  );
}
