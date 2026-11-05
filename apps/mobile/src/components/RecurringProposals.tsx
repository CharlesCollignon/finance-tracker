import { useState } from "react";
import { View } from "react-native";

import {
  proposalCadence,
  proposalDisplayName,
  type RecurringProposal,
} from "@finance/core/recurring-detection";

import { PrivateAmount } from "@/components/PrivateAmount";
import { ChoiceChips } from "@/components/pickers/ChoiceChips";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { hapticSuccess } from "@/lib/haptics";
import {
  acceptRecurringProposal,
  dismissRecurringProposal,
} from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * Standing charges the statement implies, offered where they belong — the
 * web's `RecurringProposals`, inside the card of their own kind of money.
 *
 * A year of transactions already contains every subscription and direct
 * debit the user has, so asking them to type those in from a list the app
 * is looking straight at is work the app should do. It proposes and never
 * creates: a template nobody agreed to joins every projection and every
 * runway figure, and is invisible once it is there.
 */
export function RecurringProposals({
  proposals,
}: {
  proposals: readonly RecurringProposal[];
}) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const colors = useThemeColors();
  const [pending, setPending] = useState(false);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  // For a purchase paid in several times whose line did not say: the count
  // chosen, by proposal.
  const [times, setTimes] = useState<Record<string, number>>({});

  const visible = proposals.filter((proposal) => !gone.has(proposal.key));
  if (visible.length === 0) {
    return null;
  }

  function hide(key: string) {
    setGone((current) => new Set(current).add(key));
  }

  async function accept(key: string) {
    setPending(true);
    const result = await acceptRecurringProposal(key, times[key]);
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    hide(key);
    void hapticSuccess();
    toast(
      result.name
        ? t("actions.proposalAdded", { name: result.name })
        : t("recurringProposals.added"),
      "success",
    );
  }

  async function refuse(key: string) {
    // Recorded rather than merely hidden: a refusal that lasts until the
    // next load is not a refusal.
    setPending(true);
    const result = await dismissRecurringProposal(key);
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    hide(key);
  }

  return (
    <View
      className="mb-3 gap-2 rounded-control border border-dashed p-3"
      style={{ borderColor: colors.hairlineStrong }}
    >
      <Text variant="muted" className="text-xs">
        {t("recurringProposals.lead", { count: visible.length })}
      </Text>

      {visible.map((proposal) => (
        <View
          key={proposal.key}
          className="gap-1.5 rounded-control border border-border p-2"
        >
          <View className="flex-row items-baseline justify-between gap-2">
            <Text numberOfLines={1} className="min-w-0 flex-1 text-sm font-medium">
              {proposal.instalments
                ? proposal.instalments.provider === "plusieurs-fois"
                  ? t("recurringProposals.severalTimesName")
                  : proposal.instalments.provider
                : proposalDisplayName(proposal.key)}
            </Text>
            <PrivateAmount className="text-sm font-semibold">
              {formatMoney(proposal.amount)}
            </PrivateAmount>
          </View>
          <Text variant="muted" className="text-xs">
            {`${proposalCadence(proposal, locale)} · ${
              proposal.instalments
                ? t("recurringProposals.paidSoFar", {
                    count: proposal.instalments.paid,
                  })
                : t("recurringProposals.seenTimes", { count: proposal.count })
            }`}
          </Text>
          {proposal.instalments && proposal.instalments.count === null ? (
            <View className="gap-1.5">
              <Text variant="muted" className="text-xs">
                {t("recurringProposals.howManyTimes")}
              </Text>
              <ChoiceChips
                label={t("recurringProposals.howManyTimes")}
                options={[2, 3, 4, 10, 12]
                  .filter((count) => count > proposal.instalments!.paid)
                  .map((count) => ({
                    value: String(count),
                    label: t("recurringProposals.times", { count }),
                  }))}
                value={times[proposal.key] ? String(times[proposal.key]) : ""}
                onChange={(value) =>
                  setTimes((current) => ({
                    ...current,
                    [proposal.key]: Number(value),
                  }))
                }
              />
            </View>
          ) : null}
          <View className="flex-row items-center gap-2">
            <Button
              label={t("recurringProposals.accept")}
              size="sm"
              className="flex-1"
              disabled={
                pending ||
                (proposal.instalments?.count === null && !times[proposal.key])
              }
              onPress={() => void accept(proposal.key)}
            />
            <Button
              label={t("recurringProposals.refuse")}
              variant="ghost"
              size="sm"
              disabled={pending}
              onPress={() => void refuse(proposal.key)}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
