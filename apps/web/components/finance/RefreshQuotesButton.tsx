"use client";

import { useTransition } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/layout/ToastProvider";
import { refreshQuotesAction } from "@/lib/actions/market";
import { resolveMessage } from "@finance/core/i18n/t";
import { useT } from "@/lib/locale-context";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";

/**
 * Take fresh prices on demand.
 *
 * Quotes are cached for five minutes, which is the right default for a
 * portfolio measured in years — but "the right default" and "I want to see it
 * now" are different questions, and only one of them was answerable. This
 * answers the other without putting a polling loop on a surface that is
 * otherwise rendered entirely on the server.
 *
 * No `router.refresh()` after it: the action's `updateTag` already sends
 * back the page in view, rendered with the new prices.
 */
export function RefreshQuotesButton({ className }: { className?: string }) {
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await refreshQuotesAction();
          if ("error" in result) {
            toast(resolveMessage(t, result.error), "error");
            return;
          }
          toast(t("wallets.quotesRefreshed"), "success");
        })
      }
    >
      <ArrowsClockwise
        size={ICON.sm}
        weight="light"
        className={cn("mr-2", pending && "animate-spin")}
      />
      {pending ? t("wallets.refreshingQuotes") : t("wallets.refreshQuotes")}
    </Button>
  );
}
