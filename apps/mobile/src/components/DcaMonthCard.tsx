import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useReducedMotion, ZoomIn } from "react-native-reanimated";

import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import { describeDcaNeed, type DcaMonth } from "@finance/core/dca-need";
import { monthLong } from "@finance/core/i18n/calendar-names";
import { DURATION } from "@finance/core/motion";
import type { FulfilmentProposal } from "@finance/core/recurring-fulfilment";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { useMomentSeen } from "@/lib/moments";
import { fulfilOccurrence } from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON } from "@/theme/tokens";

/**
 * Le point's DCA card — the web twin carries the reasoning: the month the
 * transfer to the broker pays for, « À préparer pour novembre » until the
 * bank shows it, then « envoyé ✓ », its DCAs going through one by one and
 * the months funded in a row. Each moment pops once on this phone, with the
 * success haptic.
 */
export function DcaMonthCard({
  month: dca,
  proposal,
}: {
  month: DcaMonth;
  /** The bank's movement that looks like this transfer, if there is one. */
  proposal: FulfilmentProposal | null;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const colors = useThemeColors();
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const monthKey = `${dca.need.year}-${String(dca.need.month).padStart(2, "0")}`;
  const name = monthLong(dca.need.month, locale);
  // At the head of a line: « Novembre · envoyé ».
  const Name = name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  const state = confirmed ? "sent" : dca.state;
  const allDone =
    dca.progress.total > 0 && dca.progress.done === dca.progress.total;
  const today = todayIsoLocal();
  const started = today >= `${monthKey}-01`;
  const due = formatShortDate(dca.occurredOn, locale);
  const progressLabel = t("dcaTransfer.progress", {
    done: dca.progress.done,
    total: dca.progress.total,
    month: name,
  });

  async function confirm(of: FulfilmentProposal) {
    if (pending) {
      return;
    }
    void hapticLight();
    setPending(true);
    const result = await fulfilOccurrence(
      of.templateId,
      of.occurredOn,
      of.transactionId,
      locale,
    );
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    void hapticSuccess();
    setConfirmed(true);
  }

  return (
    <View accessibilityLabel={t("dcaTransfer.headerTitle")}>
      <View className="flex-row items-center justify-between gap-2 border-b border-border px-4 py-2">
        <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("dcaTransfer.headerTitle")}
        </Text>
        {dca.run >= 2 ? <RunChip run={dca.run} /> : null}
      </View>

      <View className="gap-3 px-4 py-3">
        <View className="flex-row flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <View className="min-w-0 shrink">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-sm font-medium">
                {state === "sent"
                  ? t("dcaTransfer.sentFor", { month: Name })
                  : state === "to-send"
                    ? t("dcaTransfer.prepareFor", { month: name })
                    : t("dcaTransfer.unseenFor", { month: Name })}
              </Text>
              {state === "sent" ? <SentCheck monthKey={monthKey} /> : null}
            </View>
            {state !== "sent" ? (
              <Text variant="muted" className="text-xs">
                {dca.occurredOn < today
                  ? t("dcaTransfer.lateDue", { date: due })
                  : t("dcaTransfer.dueBy", { date: due })}
              </Text>
            ) : null}
          </View>
          <AnimatedAmount
            value={dca.need.amount}
            format={formatEuro}
            startFrom={state === "to-send" ? 0 : undefined}
            className={cn(
              "text-2xl font-semibold",
              TYPE_AMOUNT_CLASS.investment,
            )}
          />
        </View>

        <PrivateAmount className="text-xs text-muted-foreground">
          {describeDcaNeed(dca.need, t, locale)}
        </PrivateAmount>

        {proposal && !confirmed ? (
          <View className="gap-2 rounded-control border border-border p-3">
            <View className="flex-row flex-wrap items-baseline gap-x-1.5">
              <Text className="text-sm">
                {t("dcaTransfer.bankSaw", {
                  date: formatShortDate(proposal.actualOn, locale),
                })}
              </Text>
              <PrivateAmount className="text-sm font-medium">
                {formatEuro(proposal.actualAmount)}
              </PrivateAmount>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              onPress={() => void confirm(proposal)}
              className={cn(
                "min-h-11 flex-row items-center gap-1.5 self-start rounded-full bg-primary px-4",
                pending && "opacity-60",
              )}
            >
              <Ionicons
                name="checkmark"
                size={ICON.md}
                color={colors.primaryForeground}
              />
              <Text className="text-sm font-medium text-primary-foreground">
                {t("dcaTransfer.confirm")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {started && dca.progress.total > 0 ? (
          <View className="gap-1.5">
            {allDone ? (
              <AllDone monthKey={monthKey} label={t("dcaTransfer.allDone", { month: name })} />
            ) : (
              <Text variant="muted" className="text-xs">
                {progressLabel}
              </Text>
            )}
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={progressLabel}
              accessibilityValue={{
                min: 0,
                max: dca.progress.total,
                now: dca.progress.done,
              }}
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <View
                className="h-full rounded-full bg-success"
                style={{
                  width: `${Math.round((dca.progress.done / dca.progress.total) * 100)}%`,
                }}
              />
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="link"
          onPress={() => {
            void hapticLight();
            router.push("/recurring");
          }}
          className="min-h-11 flex-row items-center gap-1.5 self-start rounded-full"
        >
          <Text className="text-sm text-muted-foreground">
            {t("dcaTransfer.open")}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={ICON.md}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>
    </View>
  );
}

/** « envoyé ✓ »'s tick: pops the first time this phone sees the month sent. */
function SentCheck({ monthKey }: { monthKey: string }) {
  const seen = useMomentSeen(`dca-sent:${monthKey}`);
  const reduce = useReducedMotion();
  const colors = useThemeColors();
  if (seen === null) {
    return null;
  }
  return (
    <Animated.View
      entering={seen || reduce ? undefined : ZoomIn.duration(DURATION.enter)}
    >
      <Ionicons name="checkmark-circle" size={ICON.md} color={colors.success} />
    </Animated.View>
  );
}

/** The month's last DCA through: said once with a pop. */
function AllDone({ monthKey, label }: { monthKey: string; label: string }) {
  const seen = useMomentSeen(`dca-done:${monthKey}`);
  const reduce = useReducedMotion();
  if (seen === null) {
    return null;
  }
  return (
    <Animated.View
      entering={seen || reduce ? undefined : ZoomIn.duration(DURATION.enter)}
      style={{ alignSelf: "flex-start" }}
    >
      <Text className="text-xs font-medium">{label}</Text>
    </Animated.View>
  );
}

/** The months funded in a row: pops when it has grown since last seen. */
function RunChip({ run }: { run: number }) {
  const t = useT();
  const seen = useMomentSeen(`dca-run:${run}`);
  const reduce = useReducedMotion();
  const colors = useThemeColors();
  if (seen === null) {
    return null;
  }
  return (
    <Animated.View
      entering={seen || reduce ? undefined : ZoomIn.duration(DURATION.enter)}
    >
      {/* Classes on a plain View: the web build drops them on Animated's. */}
      <View className="flex-row items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5">
        <Ionicons name="flame" size={ICON.xs} color={colors.primary} />
        <Text className="text-xs font-medium text-primary">
          {t("dcaTransfer.run", { count: run })}
        </Text>
      </View>
    </Animated.View>
  );
}
