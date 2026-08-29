import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { buttonVariants } from "@/components/retroui/Button";
import { cn } from "@/lib/utils";
import { featureHref, landingCopy } from "@/components/marketing/landing-copy";

interface LandingFooterProps {
  isLoggedIn: boolean;
}

export function LandingFooter({ isLoggedIn }: LandingFooterProps) {
  return (
    <footer className="relative z-10 px-6 py-12 md:py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="inline-flex shrink-0">
            <Logo size="nav" className="text-xl" />
          </Link>
          <nav
            className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:gap-8"
            aria-label="Footer"
          >
            <Link
              href="/"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Home
            </Link>
            {landingCopy.pages.map((page) => (
              <Link
                key={page.id}
                href={featureHref(page.id)}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {page.title}
              </Link>
            ))}
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
              >
                {landingCopy.cta.openApp}
              </Link>
            ) : (
              <Link
                href="/login"
                className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
              >
                {landingCopy.cta.signIn}
              </Link>
            )}
          </nav>
        </div>
        <p className="text-sm text-muted-foreground">© 2026 Pluclair</p>
      </div>
    </footer>
  );
}
