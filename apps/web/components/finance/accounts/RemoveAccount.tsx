"use client";

import { useState, useTransition } from "react";
import { Trash } from "@phosphor-icons/react";
import { useToast } from "@/components/layout/ToastProvider";
import { Button } from "@/components/ui/Button";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

/**
 * "Retirer ce compte", then the sentence that says what goes, then the
 * press that does it — on the spot rather than in a dialog, since the
 * question is about the panel it sits in.
 */
export function RemoveAccount({
  confirmText,
  onRemove,
  label,
}: {
  confirmText: string;
  onRemove: () => Promise<{ error?: string; message?: string }>;
  /** What the first press says, when it is not an account being removed. */
  label?: string;
}) {
  const t = useT();
  const { toast } = useToast();
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!asking) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setAsking(true)}
        className="text-muted-foreground"
      >
        <Trash size={ICON.sm} aria-hidden className="mr-1.5" />
        {label ?? t("accounts.remove")}
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label={label ?? t("accounts.remove")}
      className="flex flex-col gap-2 rounded-control border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm">{confirmText}</p>
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAsking(false)}
        >
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          className="border-destructive text-destructive hover:bg-destructive/10"
          onClick={() =>
            startTransition(async () => {
              const result = await onRemove();
              if (result.error) {
                toast(result.error, "error");
                return;
              }
              if (result.message) {
                toast(result.message, "success");
              }
            })
          }
        >
          {t("common.remove")}
        </Button>
      </div>
    </div>
  );
}
