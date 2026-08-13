"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/retroui/Button";
import { Logo } from "@/components/layout/Logo";
import { MarketingThemeToggle } from "@/components/marketing/MarketingThemeToggle";
import { cn } from "@/lib/utils";
import {
  featureHref,
  landingCopy,
} from "@/components/marketing/landing-copy";

interface LandingCtasProps {
  isLoggedIn: boolean;
  size?: "sm" | "md";
  layout?: "header" | "block" | "primary";
}

export function LandingCtas({
  isLoggedIn,
  size = "sm",
  layout = "header",
}: LandingCtasProps) {
  const wide = layout === "block" || layout === "primary";
  const blockClass = wide ? "min-w-36" : undefined;

  const headerPrimary = layout === "header" ? "rounded-full px-4" : undefined;

  if (isLoggedIn) {
    return (
      <Link
        href="/dashboard"
        className={cn(buttonVariants({ size }), blockClass, headerPrimary)}
      >
        {layout === "header"
          ? landingCopy.cta.openApp
          : landingCopy.cta.goToDashboard}
      </Link>
    );
  }

  if (layout === "primary") {
    return (
      <Link
        href="/signup"
        className={cn(buttonVariants({ size }), blockClass)}
      >
        {landingCopy.cta.getStarted}
      </Link>
    );
  }

  if (layout === "header") {
    return (
      <>
        <Link
          href="/login"
          className={cn(buttonVariants({ size, variant: "ghost" }))}
        >
          {landingCopy.cta.signIn}
        </Link>
        <Link
          href="/signup"
          className={cn(buttonVariants({ size }), headerPrimary)}
        >
          {landingCopy.cta.getStarted}
        </Link>
      </>
    );
  }

  return (
    <>
      <Link
        href="/signup"
        className={cn(buttonVariants({ size }), blockClass)}
      >
        {landingCopy.cta.getStarted}
      </Link>
      <Link
        href="/login"
        className={cn(buttonVariants({ size, variant: "ghost" }), blockClass)}
      >
        {landingCopy.cta.signIn}
      </Link>
    </>
  );
}

function FeatureLinks({
  pathname,
  onNavigate,
  className,
  id,
}: {
  pathname: string;
  onNavigate?: () => void;
  className?: string;
  id?: string;
}) {
  return (
    <nav id={id} className={className} aria-label="Features">
      <Link
        href="/"
        onClick={onNavigate}
        className={cn(
          "text-sm transition-colors",
          pathname === "/"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Home
      </Link>
      {landingCopy.pages.map((page) => {
        const href = featureHref(page.id);
        const active = pathname === href;
        return (
          <Link
            key={page.id}
            href={href}
            onClick={onNavigate}
            className={cn(
              "text-sm transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {page.title}
          </Link>
        );
      })}
    </nav>
  );
}

interface LandingHeaderProps {
  isLoggedIn: boolean;
}

export function LandingHeader({ isLoggedIn }: LandingHeaderProps) {
  const pathname = usePathname();
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const open = openForPath === pathname;

  const pillClass =
    "border border-foreground/10 bg-background/40 backdrop-blur-xl";

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 md:px-6 md:pt-6">
      <div
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full px-4 py-2 md:px-5",
          pillClass,
        )}
      >
        <Link href="/" className="inline-flex shrink-0">
          <Logo size="nav" className="text-xl md:text-2xl" />
        </Link>

        <div className="flex min-w-0 items-center gap-4 md:gap-6">
          <FeatureLinks
            pathname={pathname}
            className="hidden items-center gap-6 lg:flex xl:gap-8"
          />
          <div className="flex shrink-0 items-center gap-1">
            <div className="hidden lg:flex">
              <MarketingThemeToggle />
            </div>
            <LandingCtas isLoggedIn={isLoggedIn} size="sm" layout="header" />
            <button
              type="button"
              className={cn(
                buttonVariants({ size: "icon", variant: "ghost" }),
                "lg:hidden",
              )}
              aria-expanded={open}
              aria-controls="marketing-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpenForPath(open ? null : pathname)}
            >
              {open ? <X size={20} /> : <List size={20} />}
            </button>
          </div>
        </div>
      </div>

      <div
        id="marketing-nav"
        className={cn(
          "mx-auto mt-2 flex max-w-6xl flex-col gap-5 rounded-3xl px-5 py-4 lg:hidden",
          pillClass,
          open ? undefined : "hidden",
        )}
      >
        <FeatureLinks
          pathname={pathname}
          onNavigate={() => setOpenForPath(null)}
          className="flex flex-col gap-5"
        />
        <MarketingThemeToggle />
      </div>
    </header>
  );
}
