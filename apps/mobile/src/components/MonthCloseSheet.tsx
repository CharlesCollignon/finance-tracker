import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useReducedMotion, ZoomIn } from "react-native-reanimated";

import { parseTypedAmount } from "@finance/core/amount-input";
import { formatPercentLabel, formatShortDate } from "@finance/core/constants";
import { DURATION } from "@finance/core/motion";
import {
  runwayDaysAdded,
  type MonthCloseResult,
  type RunMoment,
} from "@finance/core/month-close";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { hapticSuccess } from "@/lib/haptics";
import {
  deleteMonthClose,
  previewMonthCloseFor,
  recordMonthClose,
} from "@/lib/mutations";
import { readCashBalance } from "@/lib/queries";
import { toTypedAmount } from "@/lib/typed-amount";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useToast } from "@/providers/ToastProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useOwner } from "@/providers/OwnerProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

interface MonthCloseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  monthLabel: string;
  /** The date whose balance the user is being asked for. */
  observeOn: string;
  isBaseline: boolean;
  /** One month of unavoidable outgoings, for the runway translation. */
  monthlyCommitted: number;
  unrecordedCap: number | null;
  /** What a normal month's unrecorded spending has been, if known yet. */
  baseline: number | null;
}

type Stage = "entering" | "checked" | "closed";

function Figure({
  label,
  value,
  toneClass,
}: {
  label: string;
  value: string;
  toneClass?: string;
}) {
  return (
    <View className="flex-row items-baseline justify-between gap-4 py-1.5">
      <Text variant="muted" className="text-sm">
        {label}
      </Text>
      <PrivateAmount className={toneClass ?? "text-sm font-semibold"}>
        {value}
      </PrivateAmount>
    </View>
  );
}

/**
 * The only thing the app asks the user for that it cannot work out itself.
 * Mirrors the web MonthCloseSheet: enter a balance, see what it means, then
 * commit — because a reconciliation that lands as a surprise after an
 * irreversible-feeling save is a reason not to close next month.
 */
export function MonthCloseSheet({
  open,
  onOpenChange,
  year,
  month,
  monthLabel,
  observeOn,
  isBaseline,
  monthlyCommitted,
  unrecordedCap,
  baseline,
}: MonthCloseSheetProps) {
  const locale = useLocale();
  const t = useT();
  const { ownerId } = useOwner();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const [balance, setBalance] = useState("");
  const [stage, setStage] = useState<Stage>("entering");
  const [result, setResult] = useState<MonthCloseResult | null>(null);
  // What the close did to the run, once recorded; null when it is not news.
  const [run, setRun] = useState<RunMoment | null>(null);
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const [pending, setPending] = useState(false);
  const [fromStatement, setFromStatement] = useState(false);
  // Whether the reader has typed anything since the sheet opened, which a
  // late-arriving statement reading must never overwrite.
  const typed = useRef(false);

  /*
   * The web asks the bank for today's balance when its sheet opens. The phone
   * cannot reach the bank, but it can read the stored statement — and for the
   * reading day itself, which is the date the question is about, rather than
   * for today. Only a complete reading fills the field: a sum missing one of
   * the counted accounts is not a balance. Anything the reader has already
   * typed wins.
   */
  useEffect(() => {
    if (!open || stage !== "entering" || !ownerId) {
      return;
    }
    let live = true;
    void readCashBalance(ownerId, observeOn)
      .then((cash) => {
        if (!live || !cash?.ok || typed.current) {
          return;
        }
        setBalance(toTypedAmount(cash.total, locale, 2));
        setFromStatement(true);
      })
      .catch(() => {
        // An empty field is the ordinary way in; nothing to say.
      });
    return () => {
      live = false;
    };
  }, [open, stage, ownerId, observeOn, locale]);

  function dismiss() {
    onOpenChange(false);
    setBalance("");
    setStage("entering");
    setResult(null);
    setRun(null);
    setFromStatement(false);
    typed.current = false;
  }

  /*
   * `Number(balance.replace(",", "."))` rejected every shape the app's own
   * formatter prints over a thousand — "1 234,56" kept its space and came
   * back NaN — so the button simply never enabled. `parseTypedAmount` reads
   * either convention, and returns null so an unreadable entry can say so.
   */
  const parsed = parseTypedAmount(balance);
  const parsedBalance = parsed ?? 0;
  const balanceIsUsable = parsed !== null;
  const balanceIsUnreadable = balance.trim() !== "" && parsed === null;

  async function check() {
    setPending(true);
    const response = await previewMonthCloseFor(year, month, parsedBalance);
    setPending(false);

    if (response.error || !response.result) {
      toast(response.error ?? t("monthClose.couldNotWorkOut"), "error");
      return;
    }
    setResult(response.result);
    setStage("checked");
  }

  async function confirm() {
    setPending(true);
    const response = await recordMonthClose(
      year,
      month,
      parsedBalance,
      locale,
    );
    setPending(false);

    if (response.error || !response.result) {
      toast(response.error ?? t("monthClose.couldNotClose"), "error");
      return;
    }
    void hapticSuccess();
    setResult(response.result);
    setRun(response.run);
    setStage("closed");
  }

  async function undo() {
    setPending(true);
    const response = await deleteMonthClose(year, month);
    setPending(false);

    if (response.error) {
      toast(response.error, "error");
      return;
    }
    toast(t("monthClose.reopened", { month: monthLabel }), "success");
    dismiss();
  }

  const days = result ? runwayDaysAdded(result.kept, monthlyCommitted) : null;
  const overCap =
    unrecordedCap !== null &&
    result?.unrecorded !== null &&
    result?.unrecorded !== undefined &&
    result.unrecorded > unrecordedCap;

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          accessibilityLabel={t("monthClose.close")}
          className="flex-1"
          onPress={dismiss}
        />
        <View className="max-h-[85%] rounded-t-card p-card border border-border bg-card">
          <SheetGrabber />
          <Text className="mb-2 font-semibold" style={{ fontSize: 18 }}>
            {stage === "closed"
              ? monthLabel
              : t("monthClose.closeMonth", { month: monthLabel })}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {stage === "entering" ? (
              <View className="gap-4">
                <Text variant="muted" className="text-sm">
                  {t("monthClose.balancePrompt", {
                    date: formatShortDate(observeOn, locale),
                  })}
                </Text>
                <Text variant="muted" className="text-sm">
                  {isBaseline
                    ? t("monthClose.baselineNote")
                    : t("monthClose.sameDayNote")}
                </Text>

                <View className="gap-1.5">
                  <Text className="text-sm font-medium">
                    {t("monthClose.balance")}
                  </Text>
                  {fromStatement ? (
                    <Text variant="muted" className="text-xs">
                      {t("planScreen.filledFromStatement", {
                        date: formatShortDate(observeOn, locale),
                      })}
                    </Text>
                  ) : null}
                  <Input
                    keyboardType="decimal-pad"
                    placeholder={t("monthClose.balancePlaceholder")}
                    value={balance}
                    onChangeText={(value) => {
                      typed.current = true;
                      setBalance(value);
                      setFromStatement(false);
                    }}
                    invalid={balanceIsUnreadable}
                    accessibilityLabel={t("monthClose.balanceOn", {
                      date: formatShortDate(observeOn, locale),
                    })}
                  />
                  {balanceIsUnreadable ? (
                    <Text
                      accessibilityLiveRegion="polite"
                      className="text-sm text-destructive"
                    >
                      {t("monthClose.balanceUnreadable", {
                        example: t("monthClose.balancePlaceholder"),
                      })}
                    </Text>
                  ) : null}
                </View>

                <Button
                  label={
                    pending
                      ? t("monthClose.working")
                      : t("monthClose.seeWhatThatMeans")
                  }
                  disabled={pending || !balanceIsUsable}
                  onPress={() => void check()}
                />
              </View>
            ) : null}

            {stage !== "entering" && result ? (
              <View className="gap-4">
                {stage === "closed" &&
                result.kept !== null &&
                result.kept > 0 ? (
                  // The moment: what the month kept, counting up in the gold
                  // a moment is allowed, and the run if the close extended it.
                  <View className="items-start gap-1">
                    <Text variant="muted" className="text-sm">
                      {t("monthClose.keptIn", { month: monthLabel })}
                    </Text>
                    <AnimatedAmount
                      value={result.kept}
                      startFrom={0}
                      format={formatEuro}
                      className="text-primary"
                      style={TYPE.figure}
                    />
                    <Text variant="muted" className="text-sm">
                      {result.keptRate !== null
                        ? t("monthClose.keptRate", {
                            rate: formatPercentLabel(result.keptRate, locale),
                          })
                        : t("monthClose.keptRateUnknown")}
                    </Text>
                    {run ? (
                      <Animated.View
                        // After the count has landed.
                        entering={
                          reduceMotion
                            ? undefined
                            : ZoomIn.duration(DURATION.enter).delay(
                                DURATION.count,
                              )
                        }
                        className="mt-2 flex-row items-center gap-1.5 rounded-full border px-3 py-1.5"
                        style={{ borderColor: colors.primaryRim }}
                      >
                        <Ionicons
                          name="flame"
                          size={ICON.sm}
                          color={colors.primary}
                        />
                        <Text className="text-sm font-medium text-primary">
                          {t(
                            run.record
                              ? "monthClose.runRecord"
                              : "monthClose.runExtended",
                            { count: run.streak },
                          )}
                        </Text>
                      </Animated.View>
                    ) : null}
                    {days !== null ? (
                      <Text variant="muted" className="mt-1 text-sm">
                        {t("monthClose.runwayBought", { count: days })}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                <View>
                  <Text className="font-semibold" style={{ fontSize: 17 }}>
                    {result.status === "baseline"
                      ? t("monthClose.startingPointSet")
                      : result.status === "over-recorded"
                        ? t("monthClose.somethingMissing")
                        : result.kept !== null && result.kept > 0
                          ? t("monthClose.youKept", {
                              amount: formatEuro(result.kept),
                            })
                          : t("monthClose.costMoreThanItBrought", {
                              month: monthLabel,
                            })}
                  </Text>
                  <Text variant="muted" className="mt-1 text-sm">
                    {result.status === "baseline"
                      ? t("monthClose.baselineSet", {
                          amount: formatEuro(result.closingBalance),
                          date: formatShortDate(observeOn, locale),
                        })
                      : result.status === "over-recorded"
                        ? t("monthClose.unexplainedCredit", {
                            amount: formatEuro(result.unexplainedCredit ?? 0),
                          })
                        : result.keptRate !== null
                          ? t("monthClose.keptRate", {
                              rate: formatPercentLabel(result.keptRate, locale),
                            })
                          : t("monthClose.keptRateUnknown")}
                  </Text>
                  {days !== null ? (
                    <Text variant="muted" className="mt-1 text-sm">
                      {t("monthClose.runwayBought", { count: days })}
                    </Text>
                  ) : null}
                </View>
                )}

                <View className="rounded-control border border-border p-3">
                  <Figure
                    label={t("monthClose.cameIn")}
                    value={formatEuro(result.flows.income)}
                  />
                  <Figure
                    label={t("monthClose.recordedSpending")}
                    value={formatEuro(result.flows.expenses)}
                  />
                  <Figure
                    label={t("monthClose.setAside")}
                    value={formatEuro(
                      result.flows.savings + result.flows.transfers,
                    )}
                  />
                  {result.unrecorded !== null ? (
                    <Figure
                      label={t("monthClose.neverRecorded")}
                      value={formatEuro(result.unrecorded)}
                      /* Destructive when the reader's own allowance has been
                         passed, and the ordinary foreground otherwise — not
                         green. The Semantic Amount Rule says colour names what
                         kind of money a figure is, never whether it is good,
                         and PRODUCT.md refuses to hand out a score. Being over
                         a line the reader drew names something to go and find;
                         being under it is just the ordinary case, and painting
                         it with approval is a grade awarded on somebody's
                         month. The web's sheet resolves this the same way, and
                         `bearing/BearingCards.tsx` on both clients is where the
                         reasoning was worked out. */
                      toneClass={
                        overCap
                          ? "text-sm font-semibold text-destructive"
                          : "text-sm font-semibold text-foreground"
                      }
                    />
                  ) : null}
                </View>

                {result.unrecorded !== null ? (
                  <Text variant="muted" className="text-sm">
                    {unrecordedCap !== null
                      ? overCap
                        ? t("monthClose.overAllowance", {
                            over: formatEuro(result.unrecorded - unrecordedCap),
                            cap: formatEuro(unrecordedCap),
                          })
                        : t("monthClose.insideAllowance", {
                            cap: formatEuro(unrecordedCap),
                            spare: formatEuro(
                              unrecordedCap - result.unrecorded,
                            ),
                          })
                      : baseline !== null
                        ? t("monthClose.normalMonth", {
                            amount: formatEuro(baseline),
                          })
                        : t("monthClose.unrecordedBlurb")}
                  </Text>
                ) : null}

                {stage === "checked" ? (
                  <View className="gap-2">
                    <Button
                      label={
                        pending
                          ? t("monthClose.closing")
                          : t("monthClose.closeMonth", { month: monthLabel })
                      }
                      disabled={pending}
                      onPress={() => void confirm()}
                    />
                    <Button
                      label={t("monthClose.changeTheBalance")}
                      variant="outline"
                      disabled={pending}
                      onPress={() => setStage("entering")}
                    />
                  </View>
                ) : (
                  <View className="gap-2">
                    <Button label={t("monthClose.done")} onPress={dismiss} />
                    <Button
                      label={t("monthClose.reopenShort")}
                      variant="ghost"
                      disabled={pending}
                      onPress={() => void undo()}
                    />
                  </View>
                )}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
