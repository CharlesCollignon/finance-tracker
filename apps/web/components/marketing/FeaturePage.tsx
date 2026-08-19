"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import AnimatedContent from "@/components/react-bits/AnimatedContent";
import FadeContent from "@/components/react-bits/FadeContent";
import { LandingCtas } from "@/components/marketing/LandingHeader";
import { LandingDeviceStack } from "@/components/marketing/LandingDeviceStack";
import {
  adjacentLandingPages,
  featureHref,
  getLandingPage,
  type LandingPageId,
} from "@/components/marketing/landing-copy";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";

function MotionFade({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <FadeContent className={className} duration={0.6} threshold={0.15}>
      {children}
    </FadeContent>
  );
}

function MotionRise({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return <>{children}</>;
  }
  return (
    <AnimatedContent distance={24} duration={0.7} threshold={0.15}>
      {children}
    </AnimatedContent>
  );
}

interface FeaturePageProps {
  pageId: LandingPageId;
  isLoggedIn: boolean;
}

export function FeaturePage({ pageId, isLoggedIn }: FeaturePageProps) {
  const page = getLandingPage(pageId);
  const { prev, next } = adjacentLandingPages(pageId);

  return (
    <article className="mx-auto w-full max-w-6xl px-6 pt-28 pb-16 md:pt-32 md:pb-24">
      <div className="mx-auto max-w-2xl text-center">
        <MotionFade>
          <h1 className="font-head text-3xl tracking-tight md:text-4xl">
            {page.title}
          </h1>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            {page.utility}
          </p>
          <ol className="mt-10 flex flex-col gap-8 text-left">
            {page.steps.map((step, index) => (
              <li key={step.title}>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-1 font-head text-xl tracking-tight">
                  {step.title}
                </h2>
                <p className="mt-2 text-base text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex justify-center">
            <LandingCtas isLoggedIn={isLoggedIn} size="md" layout="primary" />
          </div>
        </MotionFade>
      </div>

      <div className="mt-16 md:mt-20">
        <MotionRise>
          <LandingDeviceStack pageId={pageId} />
        </MotionRise>
      </div>

      <nav
        className="mt-16 flex w-full items-center justify-between gap-6 text-sm"
        aria-label="Nearby pages"
      >
        {prev ? (
          <Link
            href={featureHref(prev.id)}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={featureHref(next.id)}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {next.title}
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
