import Image from "next/image";
import Link from "next/link";
import { featureHref, landingCopy } from "@/components/marketing/landing-copy";

const footerLink =
  "text-sm text-white/45 transition-colors duration-200 hover:text-white";

export function LandingFooter({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <footer className="relative z-10 border-t border-white/10 px-6 py-14 md:py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 font-logo text-2xl leading-none text-white"
              aria-label="Pluclair"
            >
              <Image
                src="/logo-mark.png"
                alt=""
                aria-hidden
                width={26}
                height={26}
                className="shrink-0"
                style={{ width: 26, height: 26 }}
              />
              Pluclair
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/40">
              One person&rsquo;s money: what came in, what went out, what is set
              aside, and what is invested — reconciled month by month.
            </p>
          </div>

          <nav aria-label="Product">
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-white/30">
              Product
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {landingCopy.pages.map((page) => (
                <li key={page.id}>
                  <Link href={featureHref(page.id)} className={footerLink}>
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Account">
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-white/30">
              Account
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {isLoggedIn ? (
                <li>
                  <Link href="/dashboard" className={footerLink}>
                    {landingCopy.cta.openApp}
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link href="/signup" className={footerLink}>
                      {landingCopy.cta.getStarted}
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className={footerLink}>
                      {landingCopy.cta.signIn}
                    </Link>
                  </li>
                </>
              )}
              <li>
                <Link href="/#privacy" className={footerLink}>
                  Privacy
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="marketing-rule" />

        <div className="flex flex-col gap-2 text-sm text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Pluclair</p>
          <p>No bank connection. No aggregator. No advice.</p>
        </div>
      </div>
    </footer>
  );
}
