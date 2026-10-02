"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  WarningCircle,
} from "@phosphor-icons/react";
import type { BankAttention } from "@finance/core/bank-attention";
import { formatShortDate } from "@finance/core/constants";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ConnectBankSheet } from "@/components/finance/bank/ConnectBankSheet";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

/**
 * A connected bank that is about to stop, or has.
 *
 * The in-app half of the renewal reminder (the push is the other). It sits
 * above the figures because a feed that has stopped makes every one of them
 * quietly stale — the balance card still shows a number, just yesterday's —
 * and it carries the fix itself rather than a link to a page that has it.
 * A consent is renewed, and a wallet topped up, in the user's own
 * open-banking.io account, so those two go straight there; a file that no
 * longer works is replaced right here, in the upload sheet.
 */
export function BankAttentionBanner({
  attention,
  className,
}: {
  attention: BankAttention;
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const renewing = attention.kind === "renew";
  const message =
    attention.kind === "renew"
      ? attention.daysLeft >= 0
        ? t("bankConnect.consentSoon", {
            date: formatShortDate(attention.validUntil, locale),
          })
        : t("bankConnect.consentEnded")
      : attention.kind === "expired"
        ? t("bankConnect.expiredTitle")
        : t("bankConnect.pausedBody");

  return (
    <>
      <div
        role="status"
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-control border px-3 py-2.5",
          renewing
            ? "border-primary/30 bg-accent"
            : "border-warning/40 bg-warning/10",
          className,
        )}
      >
        {renewing ? (
          <ArrowsClockwise
            size={ICON.lg}
            weight="bold"
            aria-hidden
            className="shrink-0 text-primary"
          />
        ) : (
          <WarningCircle
            size={ICON.lg}
            weight="fill"
            aria-hidden
            className="shrink-0 text-warning"
          />
        )}
        <p className="min-w-0 flex-1 basis-48 text-sm font-medium">{message}</p>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/bank"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            {t("bankConnect.details")}
          </Link>
          {attention.kind === "expired" ? (
            <Button type="button" size="sm" onClick={() => setOpen(true)}>
              {t("bankConnect.reconnect")}
            </Button>
          ) : (
            <a
              href="https://open-banking.io/app"
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            >
              {renewing ? t("bankConnect.renew") : t("bankConnect.openSite")}
              <ArrowSquareOut size={ICON.sm} aria-hidden />
            </a>
          )}
        </div>
      </div>
      {attention.kind === "expired" ? (
        <ConnectBankSheet open={open} onOpenChange={setOpen} />
      ) : null}
    </>
  );
}
