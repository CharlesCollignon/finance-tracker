import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

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

/** Past this many DCAs a month, dots would crowd the line: a count instead. */
const MAX_DOTS = 10;

/**
 * The transfer to the broker, as one line under Le point's curve — the web
 * twin carries the reasoning: the month, its figure, where it stands and a
 * dot per DCA; pressed, what it is made of. The coin shakes now and then
 * while it is to send, and each moment pops once on this phone, with the
 * success haptic.
 */
export function DcaStrip({
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
  const [open, setOpen] = useState(false);

  const monthKey = `${dca.need.year}-${String(dca.need.month).padStart(2, "0")}`;
  const name = monthLong(dca.need.month, locale);
  // At the head of the line: « Novembre ».
  const Name = name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  const state = confirmed ? "sent" : dca.state;
  const asking = proposal !== null && !confirmed;
  const unfolded = open || asking;
  const today = todayIsoLocal();
  const started = today >= `${monthKey}-01`;
  const { done, total } = dca.progress;
  const allDone = total > 0 && done === total;
  const due = formatShortDate(dca.occurredOn, locale);
  const progressLabel = t("dcaTransfer.progress", { done, total, month: name });

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
    <View className="rounded-control border border-border">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: unfolded }}
        accessibilityLabel={`${t("dcaTransfer.headerTitle")} · ${Name}`}
        onPress={() => {
          void hapticLight();
          setOpen((current) => !current);
        }}
        className="min-h-11 flex-row items-center gap-2.5 px-3 py-2"
      >
        <Coin shaking={state === "to-send"} />
        <View className="min-w-0 flex-1 flex-row flex-wrap items-baseline gap-x-1.5">
          <Text className="text-sm font-medium">{Name}</Text>
          <Text variant="muted" className="text-sm">
            ·
          </Text>
          <AnimatedAmount
            value={dca.need.amount}
            format={formatEuro}
            startFrom={state === "to-send" ? 0 : undefined}
            className={cn("text-sm font-semibold", TYPE_AMOUNT_CLASS.investment)}
          />
          <View className="flex-row items-center gap-1">
            <Text variant="muted" className="text-sm">
              {state === "sent"
                ? t("dcaTransfer.stripSent")
                : state === "to-send"
                  ? t("dcaTransfer.stripToSend")
                  : t("dcaTransfer.stripUnseen")}
            </Text>
            {state === "sent" ? <SentCheck monthKey={monthKey} /> : null}
          </View>
        </View>

        {started && total > 0 ? (
          allDone ? (
            <AllDoneDots
              monthKey={monthKey}
              total={total}
              label={progressLabel}
            />
          ) : (
            <Dots done={done} total={total} label={progressLabel} />
          )
        ) : null}

        {dca.run >= 2 ? <RunFlame run={dca.run} /> : null}

        <Ionicons
          name={unfolded ? "chevron-up" : "chevron-down"}
          size={ICON.sm}
          color={colors.mutedForeground}
        />
      </Pressable>

      {unfolded ? (
        <View className="gap-2.5 border-t border-border px-3 py-3">
          <PrivateAmount className="text-xs text-muted-foreground">
            {describeDcaNeed(dca.need, t, locale)}
          </PrivateAmount>
          {state !== "sent" ? (
            <Text variant="muted" className="text-xs">
              {dca.occurredOn < today
                ? t("dcaTransfer.lateDue", { date: due })
                : t("dcaTransfer.dueBy", { date: due })}
            </Text>
          ) : null}

          {asking ? (
            <View className="gap-2 rounded-control border border-border p-2.5">
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

          {started && total > 0 ? (
            <Text
              className={cn(
                "text-xs",
                allDone ? "font-medium" : "text-muted-foreground",
              )}
            >
              {allDone ? t("dcaTransfer.allDone", { month: name }) : progressLabel}
              {dca.run >= 2
                ? ` · ${t("dcaTransfer.run", { count: dca.run })}`
                : ""}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="link"
            onPress={() => {
              void hapticLight();
              router.push("/recurring");
            }}
            hitSlop={8}
            className="flex-row items-center gap-1 self-start"
          >
            <Text variant="muted" className="text-xs underline">
              {t("dcaTransfer.open")}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={ICON.xs}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** The coin: a small shake every few seconds while there is something to send. */
function Coin({ shaking }: { shaking: boolean }) {
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (!shaking || reduce) {
      turn.value = 0;
      return;
    }
    turn.value = withRepeat(
      withSequence(
        withDelay(2700, withTiming(-14, { duration: 120 })),
        withTiming(12, { duration: 120 }),
        withTiming(-6, { duration: 120 }),
        withTiming(0, { duration: 120 }),
      ),
      -1,
    );
  }, [shaking, reduce, turn]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value}deg` }],
  }));
  return (
    <Animated.View style={style}>
      <Ionicons name="logo-euro" size={ICON.md} color={colors.primary} />
    </Animated.View>
  );
}

/** A dot per DCA of the month, filled as each goes through. */
function Dots({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) {
  if (total > MAX_DOTS) {
    return (
      <Text variant="muted" className="text-xs">
        {`${done}/${total}`}
      </Text>
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={label}
      className="flex-row items-center gap-1"
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          className={cn(
            "size-1.5 rounded-full",
            index < done ? "bg-success" : "bg-muted",
          )}
        />
      ))}
    </View>
  );
}

/** Every dot filled: pops once, the month's last DCA through. */
function AllDoneDots({
  monthKey,
  total,
  label,
}: {
  monthKey: string;
  total: number;
  label: string;
}) {
  const seen = useMomentSeen(`dca-done:${monthKey}`);
  const reduce = useReducedMotion();
  if (seen === null) {
    return null;
  }
  return (
    <Animated.View
      entering={seen || reduce ? undefined : ZoomIn.duration(DURATION.enter)}
    >
      <Dots done={total} total={total} label={label} />
    </Animated.View>
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
      <Ionicons name="checkmark-circle" size={ICON.sm} color={colors.success} />
    </Animated.View>
  );
}

/** The months funded in a row: pops when it has grown since last seen. */
function RunFlame({ run }: { run: number }) {
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
      <View className="flex-row items-center gap-0.5">
        <Ionicons name="flame" size={ICON.xs} color={colors.primary} />
        <Text className="text-xs font-medium text-primary">{run}</Text>
      </View>
    </Animated.View>
  );
}
