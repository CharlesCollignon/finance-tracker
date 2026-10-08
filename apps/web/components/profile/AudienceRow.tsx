"use client";

import { useOptimistic, useTransition } from "react";
import { ChartBar } from "@phosphor-icons/react";
import { resolveMessage } from "@finance/core/i18n/t";
import { useToast } from "@/components/layout/ToastProvider";
import { ListRow } from "@/components/ui/ListRow";
import { Switch } from "@/components/ui/Switch";
import { setAudienceMeasurement } from "@/lib/actions/push";
import { useT } from "@/lib/locale-context";

/**
 * « Mesure d'audience »: whether the days this account opens Pluclair are
 * counted (migration 058), for the account rather than the browser. Turned
 * off here, the phone stops counting too.
 */
export function AudienceRow({ on }: { on: boolean }) {
  const t = useT();
  const { toast } = useToast();
  const [shown, setShown] = useOptimistic(on);
  const [, startTransition] = useTransition();

  function change(wanted: boolean) {
    startTransition(async () => {
      setShown(wanted);
      const result = await setAudienceMeasurement(wanted);
      if (!result.success) {
        toast(resolveMessage(t, result.error), "error");
      }
    });
  }

  return (
    <ListRow
      icon={ChartBar}
      label={t("profile.audience")}
      hint={t("profile.audienceHint")}
      trailing={
        <Switch
          label={t("profile.audience")}
          checked={shown}
          onChange={change}
        />
      }
    />
  );
}
