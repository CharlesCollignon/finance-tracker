"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gear, SignOut } from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { UserInitial } from "@/components/layout/UserInitial";
import { signOut } from "@/lib/actions/finance";
import { PROFILE_NAV_ITEM } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const GLASS_PANEL =
  "border border-foreground/10 bg-background/70 backdrop-blur-xl";

interface AccountMenuProps {
  variant: "bottom" | "side";
  displayName: string;
  initial: string;
}

export function AccountMenu({
  variant,
  displayName,
  initial,
}: AccountMenuProps) {
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const profileActive = pathname.startsWith(PROFILE_NAV_ITEM.href);
  const active = profileActive || open;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const first = panelRef.current?.querySelector<HTMLElement>(
      "button, a[href]",
    );
    first?.focus();
  }, [open]);

  const rowClass =
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm " +
    "font-medium text-foreground transition-colors hover:bg-foreground/5";

  const panel =
    open && mounted
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close account menu"
              className="fixed inset-0 z-[60] bg-black/25 md:bg-black/15"
              onClick={() => setOpen(false)}
            />
            <div
              className={cn(
                "fixed z-[70] flex",
                variant === "bottom"
                  ? "inset-x-0 justify-center px-4 bottom-[calc(var(--shell-bottom-nav-height)+var(--shell-bottom-nav-inset)+0.5rem+env(safe-area-inset-bottom,0px))]"
                  : "left-3",
              )}
              style={
                variant === "side"
                  ? sidePanelStyle(triggerRef.current)
                  : undefined
              }
            >
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={cn(
                  "account-menu-panel flex w-full max-w-[18rem] flex-col gap-1 p-2",
                  "rounded-3xl",
                  GLASS_PANEL,
                )}
              >
                <p id={titleId} className="sr-only">
                  Account
                </p>
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-sm font-medium">Theme</span>
                  <ThemeToggle />
                </div>
                <Link
                  href={PROFILE_NAV_ITEM.href}
                  className={rowClass}
                  onClick={() => setOpen(false)}
                >
                  <Gear size={18} />
                  Settings
                </Link>
                <form action={signOut}>
                  <button type="submit" className={rowClass}>
                    <SignOut size={18} />
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  if (variant === "bottom") {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={displayName}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "relative flex min-w-[44px] flex-1 flex-col items-center",
            "justify-center gap-0.5 rounded-full mx-0.5 my-1 px-1 py-1",
            "text-[10px] font-medium sm:text-xs",
            "transition-colors duration-200",
            active
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <UserInitial initial={initial} name={displayName} />
          <span className="truncate">{initial}</span>
        </button>
        {panel}
      </>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={displayName}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full min-h-10 items-center gap-3 rounded-md px-3 py-2",
          "text-sm font-medium transition-colors duration-200",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <UserInitial initial={initial} name={displayName} size="md" />
        <span className="min-w-0 truncate">{displayName}</span>
      </button>
      {panel}
    </>
  );
}

function sidePanelStyle(
  trigger: HTMLButtonElement | null,
): CSSProperties | undefined {
  if (!trigger) {
    return { bottom: "4.5rem" };
  }
  const rect = trigger.getBoundingClientRect();
  return {
    bottom: `calc(${window.innerHeight - rect.top}px + 0.5rem)`,
    width: Math.max(rect.width, 220),
  };
}
