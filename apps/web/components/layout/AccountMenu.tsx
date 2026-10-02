"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
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

/**
 * The avatar that opens the account's menu: in the desktop's top bar, and in
 * the page header on a phone (`HeaderAccountMenu`). It used to sit at the end
 * of the phone's bottom bar, as a sixth target among five surfaces.
 */
interface AccountMenuProps {
  displayName: string;
  initial: string;
}

/** Nothing to subscribe to: the answer only differs between server and client. */
function subscribeToNothing() {
  return () => {};
}

export function AccountMenu({ displayName, initial }: AccountMenuProps) {
  const t = useT();
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The page the menu was opened on. Open only while still on that page, so
  // navigating closes it by derivation rather than through an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  // Clears the moment the path no longer matches, including a path reached
  // by browser Back/Forward rather than a click here — adjusted while
  // rendering, the pattern React documents for "adjust state when an input
  // changes", already used in the phone's BiometricLockProvider. An effect
  // would instead leave the menu visible for one frame after Back returns to
  // the page it was opened on, because nothing else ever clears `openAt`.
  if (openAt !== null && openAt !== pathname) {
    setOpenAt(null);
  }
  const open = openAt === pathname;
  // Measured when the menu opens, in the press handler, because reading the
  // trigger's box during render reads a ref during render.
  const [panelStyle, setPanelStyle] = useState<CSSProperties | undefined>();
  // False on the server and during hydration, true after: the portal needs
  // `document.body`, which only exists on the client.
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  function toggle() {
    if (open) {
      setOpenAt(null);
      return;
    }
    setPanelStyle(topPanelStyle(triggerRef.current));
    setOpenAt(pathname);
  }
  const titleId = useId();
  const profileActive = pathname.startsWith(PROFILE_NAV_ITEM.href);
  const active = profileActive || open;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpenAt(null);
        triggerRef.current?.focus();
      }
    }

    const close = () => setOpenAt(null);
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
              onClick={() => setOpenAt(null)}
            />
            <div className="fixed z-[70] flex justify-end" style={panelStyle}>
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
                    the row cannot name a surface the nav does not. It
                    said "Settings", which is not one of this app's screens. */}
                <Link
                  href={PROFILE_NAV_ITEM.href}
                  className={rowClass}
                  onClick={() => setOpenAt(null)}
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
                  onClick={() => setOpenAt(null)}
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

  // The avatar alone. The rail had the width to print the name beside it;
  // the bar keeps the name for the button's label and the initial's tooltip.
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={displayName}
        onClick={toggle}
        className={cn(
          "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full",
          "transition-colors duration-hover",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "bg-muted" : "hover:bg-muted",
        )}
      >
        <UserInitial initial={initial} name={displayName} size="md" />
      </button>
      {panel}
    </>
  );
}

/** Under the avatar, its right edge on the avatar's, so it opens down and
 * inward rather than off the side of the window. */
function topPanelStyle(
  trigger: HTMLButtonElement | null,
): CSSProperties | undefined {
  if (!trigger) {
    return { top: "4.25rem", right: "1rem", width: "18rem" };
  }
  const rect = trigger.getBoundingClientRect();
  return {
    top: `calc(${rect.bottom}px + 0.5rem)`,
    right: `${window.innerWidth - rect.right}px`,
    width: "18rem",
  };
}
