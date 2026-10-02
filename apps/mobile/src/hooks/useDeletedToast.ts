import { useCallback } from "react";

import { restoreDeletion } from "@/lib/mutations";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";

/**
 * "Deleted", with the Undo that takes it back — the web's
 * `useDeletedToast`, so both apps make the offer the same way.
 *
 * No token (a database that has not run migration 036) and the toast says
 * what happened and offers nothing it could not do.
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
      toast(message, "success", {
        actionLabel: t("common.undo"),
        onAction: () => {
          void restoreDeletion(undo).then((result) => {
            toast(
              result.success ? t("common.putBack") : result.error,
              result.success ? "success" : "error",
            );
          });
        },
      });
    },
    [toast, t],
  );
}
