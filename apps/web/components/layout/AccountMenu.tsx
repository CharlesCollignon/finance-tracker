"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Gear, SignOut } from "@phosphor-icons/react";
import { UserInitial } from "@/components/layout/UserInitial";
import { signOut } from "@/lib/actions/finance";
import { PROFILE_NAV_ITEM } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { GLASS_PANEL } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

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
  const t = useT();
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
    const first =
      panelRef.current?.querySelector<HTMLElement>("button, a[href]");
    first?.focus();
  }, [open]);

  const rowClass =
    "flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-sm " +
    "font-medium text-foreground transition-colors hover:bg-foreground/5";

  const panel =
    open && mounted
      ? createPortal(
          <>
            <button
              type="button"
              aria-label={t("common.closeAccountMenu")}
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
                  "rounded-card",
                  GLASS_PANEL,
                )}
              >
                <p id={titleId} className="sr-only">
                  {t("common.account")}
                </p>
                {/* The label comes off the nav item the href comes off, so
                    the row cannot name a surface the sidebar does not. It
                    said "Settings", which is not one of this app's screens. */}
                <Link
                  href={PROFILE_NAV_ITEM.href}
                  className={rowClass}
                  onClick={() => setOpen(false)}
                >
                  <Gear size={ICON.lg} />
                  {t(PROFILE_NAV_ITEM.labelKey)}
                </Link>
                {/* The only re-findable route to `/welcome` on web.
                    `MonthFirstRun` carried it and went with the screen it
                    described; what was left was a single `router.push` the
                    instant a sign-up succeeded, so a reader who skipped the
                    walkthrough — or who signed in later on another device,
                    where that push never fired — could not get back to it.
                    The phone has no equivalent gap: its onboarding flag is
                    checked on every launch in `_layout.tsx`. Here rather
                    than on any one screen for the same reason: this menu is
                    on every screen, and a route that only exists while an
                    account is empty is not re-findable. */}
                <Link
                  href="/welcome"
                  className={rowClass}
                  onClick={() => setOpen(false)}
                >
                  <Compass size={ICON.lg} />
                  {t("onboarding.reopen")}
                </Link>
                <form action={signOut}>
                  <button type="submit" className={rowClass}>
                    <SignOut size={ICON.lg} />
                    {t("common.signOut")}
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
              ? "bg-primary/15 text-primary-ink"
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
          "flex w-full min-h-10 items-center gap-3 rounded-control px-3 py-2",
          "text-sm font-medium transition-colors duration-200",
          active
            ? "bg-primary/10 text-primary-ink"
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
