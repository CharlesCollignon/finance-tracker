"use client";

import { useOptimistic, useTransition } from "react";
import {
  Bank,
  CalendarCheck,
  CalendarPlus,
  ChartLineUp,
  Flag,
  HandCoins,
  House,
  Receipt,
  SealCheck,
  Tray,
  WarningCircle,
  type Icon,
} from "@phosphor-icons/react";
import { resolveMessage } from "@finance/core/i18n/t";
import {
  wantsNotification,
  type NotificationKind,
  type NotificationPrefs,
} from "@finance/core/notification-kinds";

import { useToast } from "@/components/layout/ToastProvider";
import { ListRow } from "@/components/ui/ListRow";
import { Switch } from "@/components/ui/Switch";
import { setNotificationPref } from "@/lib/actions/push";
import { useT } from "@/lib/locale-context";

const ICONS: Record<NotificationKind, Icon> = {
  recap: CalendarCheck,
  overdraft: WarningCircle,
  close: SealCheck,
  bigCharge: Receipt,
  arrived: HandCoins,
  dca: ChartLineUp,
  review: Tray,
  milestone: Flag,
  property: House,
  monthOpen: CalendarPlus,
  bank: Bank,
};

/**
 * One switch per kind of thing the app says, for the account rather than
 * the browser: turned off here, the phone stops hearing it too.
 *
 * Shown whether or not this browser takes notifications. The choices are
 * the account's, and someone who only reads them on the phone still makes
 * them here.
 */
export function NotificationKindRows({
  prefs,
  kinds,
}: {
  prefs: NotificationPrefs;
  /** The switches this account is shown (`shownNotificationKinds`). */
  kinds: readonly NotificationKind[];
}) {
  const t = useT();
  const { toast } = useToast();
  const [shown, setShown] = useOptimistic(
    prefs,
    (current, change: { kind: NotificationKind; wanted: boolean }) => ({
      ...current,
      [change.kind]: change.wanted,
    }),
  );
  const [, startTransition] = useTransition();

  function change(kind: NotificationKind, wanted: boolean) {
    startTransition(async () => {
      setShown({ kind, wanted });
      const result = await setNotificationPref(kind, wanted);
      if (!result.success) {
        toast(resolveMessage(t, result.error), "error");
      }
    });
  }

  return kinds.map((kind) => (
    <ListRow
      key={kind}
      icon={ICONS[kind]}
      label={t(`notificationKinds.${kind}.label`)}
      hint={t(`notificationKinds.${kind}.hint`)}
      trailing={
        <Switch
          label={t(`notificationKinds.${kind}.label`)}
          checked={wantsNotification(shown, kind)}
          onChange={(next) => change(kind, next)}
        />
      }
    />
  ));
}
