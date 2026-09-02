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
import { hapticSuccess } from "@/lib/haptics";
import {
  deleteMonthClose,
  previewMonthCloseFor,
  recordMonthClose,
} from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useToast } from "@/providers/ToastProvider";

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
      toast(response.error ?? "Could not work that out.", "error");
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
      toast(response.error ?? "Could not close the month.", "error");
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
          accessibilityLabel="Close"
          className="flex-1"
          onPress={dismiss}
        />
        <View className="max-h-[85%] rounded-t-3xl border border-border bg-card p-5">
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-hairline-strong" />
          <Text className="mb-2 font-semibold" style={{ fontSize: 18 }}>
            {stage === "closed" ? monthLabel : `Close ${monthLabel}`}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {stage === "entering" ? (
              <View className="gap-4">
                <Text variant="muted" className="text-sm">
                  {`What did your account hold on ${formatShortDate(observeOn)}? Add up the accounts your day-to-day spending leaves from — one number is all this needs.`}
                </Text>
                <Text variant="muted" className="text-sm">
                  {isBaseline
                    ? "This first one only sets the starting point. There is nothing to measure against yet; next month there will be."
                    : "Read it on the same day every month. That way the card payments still in flight are the same distortion each time, and the months stay comparable."}
                </Text>

                <View className="gap-1.5">
                  <Text className="text-sm font-medium">Balance</Text>
                  <Input
                    keyboardType="decimal-pad"
                    placeholder="2400.50"
                    value={balance}
                    onChangeText={setBalance}
                    accessibilityLabel={`Balance on ${observeOn}`}
                  />
                </View>

                <Button
                  label={pending ? "Working it out…" : "See what that means"}
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
                      ? "Starting point set"
                      : result.status === "over-recorded"
                        ? "Something is missing"
                        : result.kept !== null && result.kept > 0
                          ? `You kept ${formatEuro(result.kept)}`
                          : `${monthLabel} cost more than it brought in`}
                  </Text>
                  <Text variant="muted" className="mt-1 text-sm">
                    {result.status === "baseline"
                      ? `${formatEuro(result.closingBalance)} on ${formatShortDate(observeOn)}. Close next month and the app can start telling you what it never saw.`
                      : result.status === "over-recorded"
                        ? `The account holds ${formatEuro(result.unexplainedCredit ?? 0)} more than the recorded movements allow. Usually that means income that was never entered — or an expense entered twice, or a broker transfer recorded both as a transaction and as a transfer.`
                        : result.keptRate !== null
                          ? `${result.keptRate}% of what came in, counting what you set aside.`
                          : "Counting what you set aside."}
                  </Text>
                  {days !== null ? (
                    <Text variant="muted" className="mt-1 text-sm">
                      {`That is ${days} ${days === 1 ? "day" : "days"} of runway bought.`}
                    </Text>
                  ) : null}
                </View>

                <View className="rounded-lg border border-border p-3">
                  <Figure
                    label="Came in"
                    value={formatEuro(result.flows.income)}
                  />
                  <Figure
                    label="Recorded spending"
                    value={formatEuro(result.flows.expenses)}
                  />
                  <Figure
                    label="Set aside"
                    value={formatEuro(
                      result.flows.savings + result.flows.transfers,
                    )}
                  />
                  {result.unrecorded !== null ? (
                    <Figure
                      label="Never recorded"
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
                        ? `That is ${formatEuro(result.unrecorded - unrecordedCap)} over your ${formatEuro(unrecordedCap)} allowance.`
                        : `Inside your ${formatEuro(unrecordedCap)} allowance, with ${formatEuro(unrecordedCap - result.unrecorded)} to spare.`
                      : baseline !== null
                        ? `A normal month for you is around ${formatEuro(baseline)}.`
                        : "Spending the app never heard about — the restaurants, the rounds, the things bought on the way home. Nothing to fix, just worth knowing."}
                  </Text>
                ) : null}

                {stage === "checked" ? (
                  <View className="gap-2">
                    <Button
                      label={pending ? "Closing…" : `Close ${monthLabel}`}
                      disabled={pending}
                      onPress={() => void confirm()}
                    />
                    <Button
                      label="Change the balance"
                      variant="outline"
                      disabled={pending}
                      onPress={() => setStage("entering")}
                    />
                  </View>
                ) : (
                  <View className="gap-2">
                    <Button label="Done" onPress={dismiss} />
                    <Button
                      label="That balance was wrong — reopen"
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
