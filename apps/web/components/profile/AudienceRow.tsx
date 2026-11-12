"use client";

import { useOptimistic, useTransition } from "react";
import { ChartBar } from "@phosphor-icons/react";
import { resolveMessage } from "@finance/core/i18n/t";
import { useToast } from "@/components/layout/ToastProvider";
import { ListRow } from "@/components/ui/ListRow";
import { Switch } from "@/components/ui/Switch";
import { setAudienceMeasurement } from "@/lib/actions/push";
import { setMeasured } from "@/lib/measurement";
import { useT } from "@/lib/locale-context";

/**
 * « Mesure d'audience »: whether the days this account opens Pluclair are
 * counted (migration 058), and whether Vercel Web Analytics and Speed
 * Insights run while it is signed in (`VercelMeasurement`), for the account
 * rather than the browser. Turned off here, the phone stops counting too.
 */
export function AudienceRow({ on }: { on: boolean }) {
  const t = useT();
  const { toast } = useToast();
  const [shown, setShown] = useOptimistic(on);
  const [, startTransition] = useTransition();

  function change(wanted: boolean) {
    startTransition(async () => {
      setShown(wanted);
      // Vercel's page counts follow at once, rather than from the next
      // page load (`lib/measurement`).
      setMeasured(wanted);
      const result = await setAudienceMeasurement(wanted);
      if (!result.success) {
        setMeasured(on);
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
