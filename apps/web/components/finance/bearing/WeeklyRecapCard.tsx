"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarCheck } from "@phosphor-icons/react";
import { monthLong } from "@finance/core/i18n/calendar-names";
import { resolveMessage } from "@finance/core/i18n/t";
import { weeklyRecapLines, type WeeklyRecap } from "@finance/core/weekly-recap";
import { useToast } from "@/components/layout/ToastProvider";
import { dismissWeeklyRecap } from "@/lib/actions/weekly-recap";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import {
  checkPushSupport,
  currentSubscription,
  enablePush,
} from "@/lib/push-client";
import { PRIVACY_MASK, usePrivacyOn } from "@/lib/use-privacy";
import { cn } from "@/lib/utils";

/**
 * Monday's recap, as a card: the push opened, in the same sentences, one to
 * a line. Put away with « Vu », for the week and on every device.
 *
 * The amounts are formatted here rather than on the server, in this
 * browser's currency, and masked rather than blurred in privacy mode: they
 * sit inside sentences, where a blur would hide the words around them too.
 *
 * In a browser that could take notifications and does not yet, the card
 * offers to send itself on Monday: the one moment asking for the permission
 * explains itself, where a prompt on arrival is the usual way to be refused
 * for good.
 */
export function WeeklyRecapCard({
  recap,
  pushPublicKey,
}: {
  recap: WeeklyRecap;
  /** Empty when the deployment has no VAPID key configured. */
  pushPublicKey: string;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const hidden = usePrivacyOn();
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [, startTransition] = useTransition();

  if (gone) {
    return null;
  }

  const lines = weeklyRecapLines(recap, {
    t,
    formatMoney: (amount) => (hidden ? PRIVACY_MASK : format(amount)),
    previousMonthName: monthLong(recap.monthSoFar.previousMonth, locale),
  });

  function dismiss() {
    setLeaving(true);
    startTransition(async () => {
      await dismissWeeklyRecap(recap.weekOf);
    });
  }

  return (
    <section
      aria-label={t("recap.title")}
      className={cn(
        GLASS_CARD,
        "page-enter flex flex-col gap-3 rounded-card p-card",
        "transition-[opacity,transform] duration-200",
        leaving && "scale-[0.98] opacity-0",
      )}
      onTransitionEnd={(event) => {
        if (leaving && event.target === event.currentTarget) {
          setGone(true);
        }
      }}
    >
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
            <CalendarCheck size={ICON.sm} />
          </span>
          {t("recap.title")}
        </h2>
        <button
          type="button"
          onClick={dismiss}
          disabled={leaving}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-hover hover:bg-muted hover:text-foreground"
        >
          {t("recap.dismiss")}
        </button>
      </header>
      <ul className="flex flex-col gap-1.5 text-sm leading-relaxed">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <PushOptIn publicKey={pushPublicKey} />
    </section>
  );
}

/** "Send it to me every Monday", where a browser could and does not yet. */
function PushOptIn({ publicKey }: { publicKey: string }) {
  const t = useT();
  const { toast } = useToast();
  const [offered, setOffered] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Never to a browser that refused: asking again cannot work, and the
    // way back is the browser's settings, which Profile explains.
    if (
      !publicKey ||
      !checkPushSupport().supported ||
      Notification.permission === "denied"
    ) {
      return;
    }
    let cancelled = false;
    void currentSubscription().then((subscription) => {
      if (!cancelled) {
        setOffered(subscription === null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  if (!offered) {
    return null;
  }

  function enable() {
    startTransition(async () => {
      const result = await enablePush(publicKey);
      if (result.error) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      setOffered(false);
      toast(t("profile.notificationsOn"), "success");
    });
  }

  return (
    <button
      type="button"
      onClick={enable}
      disabled={pending}
      className="self-start rounded-full border border-border px-3 py-1.5 text-sm font-medium transition-colors duration-hover hover:bg-muted disabled:opacity-60"
    >
      {t("recap.optIn")}
    </button>
  );
}
