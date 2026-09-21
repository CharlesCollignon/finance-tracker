"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretDown, List, X } from "@phosphor-icons/react";
import { Orb } from "@/components/brand/Orb";
import { LandingCtas } from "@/components/marketing/LandingCtas";
import { LocaleChoices, LocaleMenu } from "@/components/marketing/LocaleSwitch";
import { cn } from "@/lib/utils";
import {
  featureHref,
  landingCopyFor,
} from "@/components/marketing/landing-copy";
import { useKeyedMenu } from "@/lib/use-keyed-menu";
import { useLocale, useT } from "@/lib/locale-context";

/** Section anchors on the homepage. Written absolute so they also work from a
 * feature page, where the section itself is not on screen. The href is a
 * route and lives here; the word is copy and lives with the rest of it. */
const SECTION_LINKS = [
  { href: "/#how", key: "howItWorks" },
  { href: "/#privacy", key: "privacy" },
] as const;

function Wordmark() {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 shrink-0 items-center gap-2.5 font-logo text-2xl leading-none text-white"
      aria-label="Pluclair"
    >
      <Orb size="26px" tone="mark" className="shrink-0" />
      Pluclair
    </Link>
  );
}

const linkClass =
  "text-sm text-marketing-muted transition-colors duration-hover hover:text-white";

/** The seven feature pages, behind one nav entry.
 *
 * They were seven flat links before, which at this width wrapped the pill and
 * gave a marketing nav the density of an app sidebar. Grouping them is also
 * more honest about the shape of the product: one ledger, seven readings. */
function ProductMenu({ pathname }: { pathname: string }) {
  const t = useT();
  const copy = landingCopyFor(useLocale());
  // Keyed by path, and dismissed by a click outside or Escape. Both live in
  // `useKeyedMenu`, which this menu invented and the language menu shares.
  const { open, ref, toggle, close } = useKeyedMenu(pathname);

  const active = pathname.startsWith("/features/");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={cn(
          "flex items-center gap-1.5 text-sm transition-colors duration-hover",
          active || open
            ? "text-white"
            : "text-marketing-muted hover:text-white",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
      >
        {t("common.product")}
        <CaretDown
          size={12}
          weight="bold"
          className={cn(
            "transition-transform duration-hover",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="account-menu-panel glass-menu absolute left-1/2 top-full z-50 mt-3 w-[22rem] -translate-x-1/2 rounded-card p-2"
        >
          {copy.pages.map((page) => {
            const href = featureHref(page.id);
            return (
              <Link
                key={page.id}
                href={href}
                role="menuitem"
                onClick={close}
                className={cn(
                  "flex flex-col gap-0.5 rounded-control px-3 py-2.5 transition-colors duration-hover",
                  pathname === href ? "bg-white/10" : "hover:bg-white/[0.07]",
                )}
              >
                <span className="text-sm font-medium text-white">
                  {page.title}
                </span>
                <span className="text-xs leading-snug text-marketing-muted">
                  {page.body}
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function LandingHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = useT();
  const copy = landingCopyFor(useLocale());
  const pathname = usePathname();
  // Keyed by path so navigating from inside the sheet closes it. Not
  // `useKeyedMenu`: the button that opens this sheet sits outside it, so the
  // hook's outside-click dismissal would close the sheet on pointerdown and
  // the button's own click would then find it already closed.
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const open = openForPath === pathname;

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 md:px-6 md:pt-6">
      <div className="relative mx-auto max-w-6xl">
        {/* The pill's glass is a layer behind the nav, not the box around it.
            `backdrop-filter` makes an element a backdrop root for everything
            inside it, so a menu nested in the pill could only blur what the
            pill itself paints — and the menus hang below the pill, over
            nothing. That is why the Product menu read as flat tinted glass
            while the mobile sheet, which is a sibling of the pill rather than
            a child, frosted correctly. Sibling here too, so both do. */}
        <div
          className="glass-panel pointer-events-none absolute inset-0 rounded-full"
          aria-hidden
        />

        <div className="relative flex items-center justify-between gap-4 py-2 pl-5 pr-2 md:pr-2.5">
          <Wordmark />

          <nav
            className="hidden items-center gap-8 lg:flex"
            aria-label={t("common.marketing")}
          >
            <ProductMenu pathname={pathname} />
            {SECTION_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass}>
                {copy.nav[link.key]}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {/* Only where the rest of the nav is. Below `lg` the pill is down
                to a wordmark, a call to action and a hamburger, and the sheet
                behind that hamburger carries the same choice with room to
                spell both languages out. */}
            <div className="hidden lg:block">
              <LocaleMenu pathname={pathname} />
            </div>
            <LandingCtas
              isLoggedIn={isLoggedIn}
              size="md"
              layout="pair-compact"
            />
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full text-marketing-ink transition-colors hover:bg-white/10 hover:text-white lg:hidden"
              aria-expanded={open}
              aria-controls="marketing-nav"
              aria-label={open ? t("common.closeMenu") : t("common.openMenu")}
              onClick={() => setOpenForPath(open ? null : pathname)}
            >
              {open ? <X size={18} /> : <List size={18} />}
            </button>
          </div>
        </div>
      </div>

      <div
        id="marketing-nav"
        className={cn(
          "glass-menu mx-auto mt-2 max-w-6xl rounded-card p-row lg:hidden",
          open ? undefined : "hidden",
        )}
      >
        <div className="grid gap-1 sm:grid-cols-2">
          {copy.pages.map((page) => (
            <Link
              key={page.id}
              href={featureHref(page.id)}
              onClick={() => setOpenForPath(null)}
              className="flex min-h-11 items-center rounded-control px-3 text-sm text-marketing-ink transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              {page.title}
            </Link>
          ))}
        </div>
        <div className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2">
          {SECTION_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpenForPath(null)}
              className="flex min-h-11 items-center rounded-control px-3 text-sm text-marketing-muted transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              {copy.nav[link.key]}
            </Link>
          ))}
          {isLoggedIn ? null : (
            <Link
              href="/login"
              onClick={() => setOpenForPath(null)}
              className="flex min-h-11 items-center rounded-control px-3 text-sm text-marketing-muted transition-colors hover:bg-white/[0.07] hover:text-white sm:hidden"
            >
              {copy.cta.signIn}
            </Link>
          )}
        </div>

        {/* Last, under its own rule: it is the one control here that changes
            the page rather than leaving it. The sheet is not closed on
            choosing — the action revalidates the layout, and a sheet that
            vanished mid-swap would leave the reader nothing to watch change. */}
        <div className="mt-2 border-t border-white/10 pt-2">
          <h2 className="px-3 text-xs font-medium uppercase tracking-[0.16em] text-marketing-faint">
            {t("locale.settingLabel")}
          </h2>
          <LocaleChoices variant="sheet" className="mt-1" />
        </div>
      </div>
    </header>
  );
}
