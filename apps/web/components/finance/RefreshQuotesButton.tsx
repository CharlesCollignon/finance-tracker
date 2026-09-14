"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";

import { Button } from "@/components/retroui/Button";
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
 * `router.refresh()` after the action, because invalidating the tag tells the
 * cache to forget; it does not re-render what is already on screen.
 */
export function RefreshQuotesButton({ className }: { className?: string }) {
  const t = useT();
  const router = useRouter();
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
          router.refresh();
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
