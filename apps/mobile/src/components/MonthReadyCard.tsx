import { useState } from "react";
import { View } from "react-native";

import type { ApplyRecurringPlan } from "@finance/core/apply-recurring";

import { ApplyRecurringSheet } from "@/components/ApplyRecurringSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { hapticSuccess } from "@/lib/haptics";
import { applyRecurringForMonth } from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useToast } from "@/providers/ToastProvider";

interface MonthReadyCardProps {
  monthLabel: string;
  year: number;
  month: number;
  plan: ApplyRecurringPlan;
  onApplied: () => void;
}

/**
 * The month's opening moment.
 *
 * Applying recurring templates produces most of the ledger, and it used to be
 * a small outline button on the Transactions tab with a red dot on it — the
 * visual language of an outstanding chore. Here it leads the Home screen when
 * there is something to apply, and vanishes when there is not.
 */
export function MonthReadyCard({
  monthLabel,
  year,
  month,
  plan,
  onApplied,
}: MonthReadyCardProps) {
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const creates = plan.toCreate.length;
  const updates = plan.toUpdate.length;

  if (creates === 0 && updates === 0) {
    return null;
  }

  const total = plan.toCreate.reduce((sum, item) => sum + item.amount, 0);

  async function apply(includeUpdates: boolean, selectedKeys?: Set<string>) {
    setPending(true);
    const result = await applyRecurringForMonth(
      year,
      month,
      includeUpdates,
      selectedKeys,
    );
    setPending(false);

    if (result.error) {
      toast(result.error, "error");
      return;
    }

    void hapticSuccess();
    setReviewOpen(false);
    toast(
      result.created
        ? `${result.created} added to ${monthLabel}`
        : "Recurring applied",
      "success",
    );
    onApplied();
  }

  return (
    <>
      <Card bezel innerClassName="gap-4 p-5">
        <View>
          <Text className="font-bold" style={{ fontSize: 17 }}>
            {creates > 0
              ? `Your ${monthLabel} is ready`
              : `${monthLabel} needs an update`}
          </Text>
          <Text variant="muted" className="mt-1 text-sm">
            {creates > 0
              ? `${creates} recurring ${creates === 1 ? "item" : "items"} · ${formatEuro(total)}`
              : `${updates} ${updates === 1 ? "entry has" : "entries have"} changed since you applied.`}
          </Text>
          {creates > 0 && updates > 0 ? (
            <Text variant="muted" className="text-sm">
              {`${updates} existing ${updates === 1 ? "entry" : "entries"} also changed.`}
            </Text>
          ) : null}
        </View>

        <View className="flex-row gap-2">
          <Button
            label="Review"
            variant="outline"
            className="flex-1"
            disabled={pending}
            onPress={() => setReviewOpen(true)}
          />
          <Button
            label={pending ? "Applying…" : "Apply"}
            className="flex-1"
            disabled={pending}
            onPress={() => void apply(updates > 0)}
          />
        </View>
      </Card>

      <ApplyRecurringSheet
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        plan={plan}
        pending={pending}
        onConfirm={(includeUpdates, selectedKeys) =>
          void apply(includeUpdates, selectedKeys)
        }
      />
    </>
  );
}
