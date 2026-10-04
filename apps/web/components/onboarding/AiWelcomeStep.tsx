"use client";

import { useState } from "react";
import { AI_BRANDS, AI_BRAND_MARKS } from "@finance/core/ai-brands";
import { AiMark } from "@/components/finance/AiMark";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/layout/ToastProvider";
import { useT } from "@/lib/locale-context";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

/**
 * The welcome flow's last step, behind `ai.account`: what the written reads
 * are, and that they are written on the reader's own AI account — the one
 * thing about Pluclair a new user cannot guess, and the one that costs them
 * something. Said before OpenRouter opens, with what is sent and where it
 * goes, as the Profile says it; then « Connecter avec OpenRouter », or later.
 *
 * OpenRouter's callback lands back on `/welcome?ai=…` (the round trip's
 * origin, carried in its state), where the flow says how it went and ends.
 */
export function AiWelcomeStep({ onSkip }: { onSkip: () => void }) {
  const t = useT();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function connect() {
    setPending(true);
    const response = await fetch("/api/ai/openrouter/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "redirect", origin: "welcome" }),
    }).catch(() => null);
    const body = (await response?.json().catch(() => null)) as {
      url?: unknown;
      error?: unknown;
    } | null;
    if (!response?.ok || typeof body?.url !== "string") {
      setPending(false);
      toast(
        typeof body?.error === "string" ? body.error : "aiAccount.unavailable",
        "error",
      );
      return;
    }
    // Pending until the page goes: OpenRouter opens in its place.
    window.location.assign(body.url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3" aria-hidden="true">
          {AI_BRANDS.map((brand) => (
            <span
              key={brand}
              title={AI_BRAND_MARKS[brand].name}
              className="flex size-10 items-center justify-center rounded-full border border-border bg-card"
            >
              <AiMark brand={brand} className="size-5" />
            </span>
          ))}
        </div>
        <h1 className="font-head text-2xl">{t("aiAccount.welcomeTitle")}</h1>
        <p className="text-muted-foreground">{t("aiAccount.welcomeBody")}</p>
      </div>
      <Card.Bezel innerClassName="flex flex-col gap-3 p-5 text-sm">
        <p>{t("aiAccount.welcomeHow")}</p>
        <p>{t("aiAccount.welcomeCost")}</p>
        <p className={cn("text-muted-foreground", MICRO)}>
          {t("aiAccount.consentSent")}
        </p>
        <p className={cn("text-muted-foreground", MICRO)}>
          {t("aiAccount.consentWhere")}
        </p>
      </Card.Bezel>
      <div className="flex flex-col gap-2">
        <Button size="lg" onClick={connect} disabled={pending}>
          {pending ? t("aiAccount.continuing") : t("aiAccount.welcomeConnect")}
        </Button>
        <Button variant="ghost" onClick={onSkip} disabled={pending}>
          {t("onboarding.skipForNow")}
        </Button>
        <p className={cn("text-center text-muted-foreground", MICRO)}>
          {t("aiAccount.welcomeLater")}
        </p>
      </div>
    </div>
  );
}
