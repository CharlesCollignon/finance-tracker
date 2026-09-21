import Link from "next/link";
import { Orb } from "@/components/brand/Orb";
import { LocaleChoices } from "@/components/marketing/LocaleSwitch";
import {
  featureHref,
  landingCopyFor,
} from "@/components/marketing/landing-copy";
import { getLocale, getT } from "@/lib/locale";

/**
 * A footer link is 14px of text, which draws an 18px box — less than half the
 * 44px a finger needs, and this is the surface most visitors meet on a phone.
 * `min-h-11` gives the link the height without changing the type, and the row
 * gap goes with it: two 44px boxes touching are already further apart than
 * two 18px boxes twelve pixels apart.
 *
 * It relaxes at `lg`, where a pointer is doing the aiming and the tighter
 * column is the better-looking of the two. Not at `md`: a tablet is a touch
 * device and 768px is squarely one. The relaxed rows are 20px, which clears
 * WCAG 2.5.8 on the spacing exemption — 32px of pitch leaves each one its own
 * 24px circle.
 *
 * `flex` rather than `inline-flex` so the box is the column and not the word:
 * "Plan" is 27px of text, and a target can miss the minimum on its width just
 * as easily as on its height.
 */
const footerLink =
  "flex min-h-11 items-center text-sm text-marketing-muted " +
  "transition-colors duration-hover hover:text-white lg:min-h-0";

const footerList = "mt-2 flex flex-col lg:mt-4 lg:gap-3";

export async function LandingFooter({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = await getT();
  const copy = landingCopyFor(await getLocale());
  return (
    <footer className="relative z-10 border-t border-white/10 px-6 py-14 md:py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2.5 font-logo text-2xl leading-none text-white"
              aria-label="Pluclair"
            >
              <Orb size="26px" tone="mark" className="shrink-0" />
              Pluclair
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-marketing-faint">
              {copy.footer.tagline}
            </p>
          </div>

          <nav aria-label={t("common.product")}>
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-marketing-faint">
              {t("common.product")}
            </h2>
            <ul className={footerList}>
              {copy.pages.map((page) => (
                <li key={page.id}>
                  <Link href={featureHref(page.id)} className={footerLink}>
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t("common.account")}>
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-marketing-faint">
              {t("common.account")}
            </h2>
            <ul className={footerList}>
              {isLoggedIn ? (
                <li>
                  <Link href="/bearing" className={footerLink}>
                    {copy.cta.openApp}
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link href="/signup" className={footerLink}>
                      {copy.cta.getStarted}
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className={footerLink}>
                      {copy.cta.signIn}
                    </Link>
                  </li>
                </>
              )}
              <li>
                <Link href="/#privacy" className={footerLink}>
                  {copy.nav.privacy}
                </Link>
              </li>
            </ul>
          </nav>

          {/* The second home for the language, and the conventional one: a
              visitor who has read to the bottom without finding the control in
              the header looks here, because every other site has put it here.
              A section rather than a `nav` — the two buttons go nowhere, they
              change the page you are on. */}
          <section aria-labelledby="footer-language">
            <h2
              id="footer-language"
              className="text-xs font-medium uppercase tracking-[0.16em] text-marketing-faint"
            >
              {t("locale.settingLabel")}
            </h2>
            <LocaleChoices variant="footer" />
          </section>
        </div>

        <div className="marketing-rule" />

        <div className="flex flex-col gap-2 text-sm text-marketing-faint sm:flex-row sm:items-center sm:justify-between">
          <p>{copy.footer.copyright}</p>
          <p>{copy.footer.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
