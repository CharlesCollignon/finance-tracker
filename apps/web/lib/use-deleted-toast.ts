"use client";

import { useCallback } from "react";
import { resolveMessage } from "@finance/core/i18n/t";
import { useToast } from "@/components/layout/ToastProvider";
import { restoreDeletion } from "@/lib/actions/finance";
import { useT } from "@/lib/locale-context";

/**
 * "Deleted", with the Undo that takes it back.
 *
 * A delete is only marked (migration 036) and hands back a token; this is
 * the toast every delete in the app reports with, so the offer is made the
 * same way wherever something was deleted. No token — a database that has
 * not run 036 — and the toast says what happened and offers nothing it
 * could not do.
 */
export function useDeletedToast(): (
  message: string,
  undo: string | null | undefined,
) => void {
  const { toast } = useToast();
  const t = useT();

  return useCallback(
    (message, undo) => {
      if (!undo) {
        toast(message, "success");
        return;
      }
      toast({
        title: message,
        variant: "success",
        actionLabel: t("common.undo"),
        onAction: () => {
          void restoreDeletion(undo).then((result) => {
            if (result.success) {
              toast(t("common.putBack"), "success");
            } else {
              toast(resolveMessage(t, result.error), "error");
            }
          });
        },
      });
    },
    [toast, t],
  );
}
