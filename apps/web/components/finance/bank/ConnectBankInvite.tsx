"use client";

import { useState, useTransition } from "react";
import { Bank, X } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { ConnectBankSheet } from "@/components/finance/bank/ConnectBankSheet";
import { dismissBankInvite } from "@/lib/actions/bank-connect";
import type { BankInviteSurface } from "@/lib/bank/invite";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";
import type { Key } from "@finance/core/i18n/t";

/** What each surface promises, in its own words. */
const PROMISE: Record<BankInviteSurface, Key> = {
  bearing: "bankConnect.inviteBearing",
  welcome: "bankConnect.inviteWelcome",
  ledger: "bankConnect.inviteLedger",
  plan: "bankConnect.invitePlan",
};

/**
 * An invitation to connect a bank.
 *
 * The page decides whether it appears at all (`shouldInviteToConnect`); this
 * only draws it and lets it be dismissed for good on its surface. Each one
 * says what connecting would change *there* — the balance on the Bearing,
 * the typing on the Ledger — and the price, which is open-banking.io's, in
 * the same sentence, so nobody is surprised by it on the next screen.
 */
export function ConnectBankInvite({
  surface,
  variant = "line",
  className,
}: {
  surface: BankInviteSurface;
  variant?: "card" | "line";
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const [, startTransition] = useTransition();

  if (gone) {
    return null;
  }

  function dismiss() {
    setGone(true);
    startTransition(async () => {
      await dismissBankInvite(surface);
    });
  }

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-control border border-primary/30 bg-accent",
          variant === "card" ? "px-4 py-4" : "px-3 py-2.5",
          className,
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bank size={ICON.md} weight="bold" />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-sm font-medium">{t(PROMISE[surface])}</p>
          <p className="text-xs text-muted-foreground">
            {t("bankConnect.priceNote")}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          onClick={() => setOpen(true)}
        >
          {t("bankConnect.sheetTitle")}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("bankConnect.dismissInvite")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-hover hover:bg-muted hover:text-foreground"
        >
          <X size={ICON.sm} />
        </button>
      </div>
      <ConnectBankSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
