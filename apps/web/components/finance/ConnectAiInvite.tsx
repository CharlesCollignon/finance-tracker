"use client";

import Link from "next/link";
import { domAnimation, LazyMotion, m, MotionConfig } from "motion/react";
import { ArrowRight, Sparkle } from "@phosphor-icons/react";
import { EASE_STANDARD } from "@finance/core/motion";
import { Button, ButtonNub } from "@/components/ui/Button";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** Where the invitation leads: Profile, with the connect row open. */
const CONNECT_HREF = "/profile?ai=connect";

const STEPS = [
  { title: "aiAccount.step1Title", body: "aiAccount.step1Body" },
  { title: "aiAccount.step2Title", body: "aiAccount.step2Body" },
  { title: "aiAccount.step3Title", body: "aiAccount.step3Body" },
] as const;

/**
 * The three steps to having an AI write in Pluclair — an OpenRouter
 * account, a few euros of credit there, a model — each arriving in turn.
 * Pluclair has no model of its own: this is the whole way in.
 */
export function AiSetupSteps({ className }: { className?: string }) {
  const t = useT();
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <ol className={cn("flex flex-col gap-3", className)}>
          {STEPS.map((step, index) => (
            <m.li
              key={step.title}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: EASE, delay: 0.08 * index }}
              className="flex items-start gap-3"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {t(step.title)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t(step.body)}
                </span>
              </span>
            </m.li>
          ))}
        </ol>
      </MotionConfig>
    </LazyMotion>
  );
}

/**
 * Where an AI would write, for someone with no AI account connected: the
 * way to connect one. `card` where the read or the questions would be —
 * what it is, the three steps, one button; `line` beside other controls.
 */
export function ConnectAiInvite({
  variant = "line",
  bare = false,
  className,
}: {
  variant?: "line" | "card";
  /** A card inside a card: no glass and no padding of its own. */
  bare?: boolean;
  className?: string;
}) {
  const t = useT();

  if (variant === "line") {
    return (
      <Link
        href={CONNECT_HREF}
        className={cn(
          "group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        <Sparkle
          size={ICON.md}
          className="transition-transform duration-hover group-hover:rotate-12"
        />
        {t("aiAccount.connectFirst")}
      </Link>
    );
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <m.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className={cn(
            "flex flex-col gap-4",
            !bare && cn(GLASS_CARD, "rounded-card p-card"),
            className,
          )}
        >
          <header className="flex items-start gap-3">
            <m.span
              initial={{ rotate: -20, scale: 0.6 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"
            >
              <Sparkle size={ICON.lg} weight="fill" />
            </m.span>
            <span className="min-w-0">
              <span className="block font-head text-lg">
                {t("aiAccount.ctaTitle")}
              </span>
              <span className="block text-sm text-muted-foreground">
                {t("aiAccount.ctaBody")}
              </span>
            </span>
          </header>
          <AiSetupSteps />
          <Button
            variant="pill"
            className="self-start"
            render={<Link href={CONNECT_HREF} />}
          >
            {t("aiAccount.ctaButton")}
            <ButtonNub>
              <ArrowRight size={ICON.md} />
            </ButtonNub>
          </Button>
        </m.section>
      </MotionConfig>
    </LazyMotion>
  );
}
