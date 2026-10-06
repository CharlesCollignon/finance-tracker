"use client";

import { useState, useTransition } from "react";
import { X } from "@phosphor-icons/react";
import {
  describeTransferInvitation,
  type TransferInvitation,
} from "@finance/core/dca-need";
import {
  acceptDcaTransferInvite,
  dismissDcaTransferInvite,
} from "@/lib/actions/finance";
import { useToast } from "@/components/layout/ToastProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";

/**
 * « Faire suivre vos DCA » — for someone who buys DCAs at the broker and has
 * no transfer following them (`transferInvitation`): their transfer to the
 * broker switched to « Selon vos DCA », or one created on the salary's day,
 * in one press. « Non merci » puts it away on every device.
 *
 * Gone at once either way; a failure is toasted and brings it back.
 */
export function TransferInvite({
  invitation,
}: {
  invitation: TransferInvitation;
}) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [answered, setAnswered] = useState(false);

  if (answered) {
    return null;
  }

  function answer(work: () => Promise<{ error?: string; message?: string }>) {
    setAnswered(true);
    startTransition(async () => {
      const result = await work();
      if (result.error) {
        setAnswered(false);
        toast(result.error, "error");
      } else if (result.message) {
        toast(result.message, "success");
      }
    });
  }

  return (
    <section aria-label={t("dcaInvite.title")} className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-foreground/10 py-1 pr-1 pl-4">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("dcaInvite.title")}
        </h3>
        <button
          type="button"
          disabled={pending}
          onClick={() => answer(dismissDcaTransferInvite)}
          aria-label={t("dcaInvite.dismiss")}
          className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={ICON.sm} />
        </button>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="privacy-sensitive text-sm text-muted-foreground">
          {describeTransferInvitation(invitation, t, locale)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => answer(acceptDcaTransferInvite)}
            className="rounded-full"
          >
            {invitation.kind === "follow"
              ? t("dcaInvite.followAction")
              : t("dcaInvite.createAction")}
          </Button>
          <button
            type="button"
            disabled={pending}
            onClick={() => answer(dismissDcaTransferInvite)}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full px-3 text-sm",
              "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              "disabled:opacity-60",
            )}
          >
            {t("dcaInvite.dismiss")}
          </button>
        </div>
      </div>
    </section>
  );
}
