"use client";

import { useTransition } from "react";
import { CaretDown, Check, Globe } from "@phosphor-icons/react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@finance/core/i18n/locale";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { setLocalePreference } from "@/lib/actions/locale";
import { useLocale, useT } from "@/lib/locale-context";
import { useKeyedMenu } from "@/lib/use-keyed-menu";
import { cn } from "@/lib/utils";

/**
 * Choosing the language, on the pages a visitor meets before signing in.
 *
 * The app has had this setting all along, in the profile — which is behind
 * the login, so the one reader who most needs it, somebody who landed on a
 * French marketing page in English, was the one reader who could not reach
 * it. The suggestion banner only fires when a geo-aware edge disagrees with
 * the browser, and never at all on a laptop, so it was never the answer here.
 *
 * Both shapes below call the same server action the profile row calls, so a
 * choice made on the marketing site is the same choice: the cookie for the
 * next request, and the stored row too once there is a user to attach it to.
 * That is also why this is a round trip rather than a class toggle — most of
 * these words are rendered on the server, and the action revalidates the
 * layout so they all come back in the new language at once.
 */
function useLocaleChoice() {
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale || pending) return;
    startTransition(async () => {
      const result = await setLocalePreference(next);
      // No toast on the marketing shell to put this in, and nothing useful to
      // say: the cookie is written before the row, so the page has already
      // changed language even when the stored preference did not take.
      if (result.error) {
        console.error("Failed to set language", result.error);
      }
    });
  }

  return { locale, pending, choose };
}

/**
 * The header's language control: the current language, and a menu of the two.
 *
 * A menu rather than the profile's tap-to-cycle. Cycling is defensible on a
 * settings row where the label above says what it is and the value beside it
 * says what it will become; on a 32px pill in a nav bar it is a button whose
 * effect a visitor can only learn by pressing it, and pressing it changes
 * every word on the page.
 */
export function LocaleMenu({ pathname }: { pathname: string }) {
  const t = useT();
  const { locale, pending, choose } = useLocaleChoice();
  const { open, ref, toggle, close } = useKeyedMenu(pathname);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={cn(
          "flex h-11 items-center gap-1.5 rounded-full px-2.5 text-sm transition-colors duration-hover",
          marketingFocus,
          open ? "text-white" : "text-marketing-muted hover:text-white",
          pending && "opacity-60",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-busy={pending}
        aria-label={`${t("locale.settingLabel")}: ${LOCALE_LABELS[locale]}`}
        onClick={toggle}
      >
        <Globe size={16} weight="regular" aria-hidden />
        <span className="font-medium uppercase">{locale}</span>
        <CaretDown
          size={12}
          weight="bold"
          aria-hidden
          className={cn(
            "transition-transform duration-hover",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="account-menu-panel glass-menu absolute right-0 top-full z-50 mt-3 w-48 rounded-card p-1.5"
        >
          {LOCALES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === locale}
              onClick={() => {
                choose(option);
                close();
              }}
              className={cn(
                "flex min-h-11 w-full items-center justify-between gap-3 rounded-control px-3 text-sm transition-colors duration-hover",
                marketingFocus,
                option === locale
                  ? "bg-white/10 font-medium text-white"
                  : "text-marketing-muted hover:bg-white/[0.07] hover:text-white",
              )}
            >
              {/* The endonyms, never translated: somebody hunting for a
                  language they can read finds "Français", not "French". */}
              {LOCALE_LABELS[option]}
              {option === locale ? (
                <Check size={14} weight="bold" aria-hidden />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The same choice laid out flat, for the two places with room for it: the
 * footer's link columns and the mobile nav sheet.
 *
 * No dropdown in either — both are already a list of things to tap, and a
 * menu inside a menu is a second dismissal a thumb has to get right.
 */
export function LocaleChoices({
  variant,
  className,
}: {
  variant: "footer" | "sheet";
  className?: string;
}) {
  const { locale, pending, choose } = useLocaleChoice();

  return (
    <ul
      className={cn(
        variant === "footer"
          ? "mt-2 flex flex-col lg:mt-4 lg:gap-3"
          : "flex flex-col",
        pending && "opacity-60",
        className,
      )}
      aria-busy={pending}
    >
      {LOCALES.map((option) => {
        const current = option === locale;
        return (
          <li key={option}>
            <button
              type="button"
              aria-current={current ? "true" : undefined}
              onClick={() => choose(option)}
              className={cn(
                "flex min-h-11 items-center rounded-control text-sm transition-colors duration-hover",
                marketingFocus,
                variant === "footer"
                  ? "lg:min-h-0"
                  : "w-full px-3 hover:bg-white/[0.07]",
                current
                  ? "font-medium text-white"
                  : "text-marketing-muted hover:text-white",
              )}
            >
              {LOCALE_LABELS[option]}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
