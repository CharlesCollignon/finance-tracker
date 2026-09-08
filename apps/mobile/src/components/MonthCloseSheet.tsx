import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { formatShortDate } from "@finance/core/constants";
import {
  runwayDaysAdded,
  type MonthCloseResult,
} from "@finance/core/month-close";

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
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useToast } from "@/providers/ToastProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";

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
  onClosed: () => void;
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
  onClosed,
}: MonthCloseSheetProps) {
  const locale = useLocale();
  const t = useT();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const [balance, setBalance] = useState("");
  const [stage, setStage] = useState<Stage>("entering");
  const [result, setResult] = useState<MonthCloseResult | null>(null);
  const [pending, setPending] = useState(false);

  function dismiss() {
    onOpenChange(false);
    setBalance("");
    setStage("entering");
    setResult(null);
  }

  const parsedBalance = Number(balance.replace(",", "."));
  const balanceIsUsable =
    balance.trim() !== "" && Number.isFinite(parsedBalance);

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
    const response = await recordMonthClose(year, month, parsedBalance);
    setPending(false);

    if (response.error || !response.result) {
      toast(response.error ?? t("monthClose.couldNotClose"), "error");
      return;
    }
    void hapticSuccess();
    setResult(response.result);
    setStage("closed");
    onClosed();
  }

  async function undo() {
    setPending(true);
    const response = await deleteMonthClose(year, month);
    setPending(false);

    if (response.error) {
      toast(response.error, "error");
      return;
    }
    toast(`${monthLabel} reopened`, "success");
    onClosed();
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
        <View className="max-h-[85%] rounded-t-3xl border border-border bg-card p-5">
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
                  <Input
                    keyboardType="decimal-pad"
                    placeholder="2400.50"
                    value={balance}
                    onChangeText={setBalance}
                    accessibilityLabel={t("monthClose.balanceOn", {
                      date: observeOn,
                    })}
                  />
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
                          : `${monthLabel} cost more than it brought in`}
                  </Text>
                  <Text variant="muted" className="mt-1 text-sm">
                    {result.status === "baseline"
                      ? `${formatEuro(result.closingBalance)} on ${formatShortDate(observeOn)}. Close next month and the app can start telling you what it never saw.`
                      : result.status === "over-recorded"
                        ? t("monthClose.unexplainedCredit", {
                            amount: formatEuro(result.unexplainedCredit ?? 0),
                          })
                        : result.keptRate !== null
                          ? `${result.keptRate}% of what came in, counting what you set aside.`
                          : t("monthClose.keptRateUnknown")}
                  </Text>
                  {days !== null ? (
                    <Text variant="muted" className="mt-1 text-sm">
                      {t("monthClose.runwayBought", { count: days })}
                    </Text>
                  ) : null}
                </View>

                <View className="rounded-lg border border-border p-3">
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
                      toneClass={
                        overCap
                          ? "text-sm font-semibold text-destructive"
                          : "text-sm font-semibold text-success"
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
                        ? `A normal month for you is around ${formatEuro(baseline)}.`
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
