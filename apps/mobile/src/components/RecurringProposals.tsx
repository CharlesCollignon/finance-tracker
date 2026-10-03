import { useState } from "react";
import { View } from "react-native";

import {
  PROPOSAL_CADENCE_KEYS,
  proposalDisplayName,
  type RecurringProposal,
} from "@finance/core/recurring-detection";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { hapticSuccess } from "@/lib/haptics";
import {
  acceptRecurringProposal,
  dismissRecurringProposal,
} from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";
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
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const colors = useThemeColors();
  const [pending, setPending] = useState(false);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());

  const visible = proposals.filter((proposal) => !gone.has(proposal.key));
  if (visible.length === 0) {
    return null;
  }

  function hide(key: string) {
    setGone((current) => new Set(current).add(key));
  }

  async function accept(key: string) {
    setPending(true);
    const result = await acceptRecurringProposal(key);
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
              {proposalDisplayName(proposal.key)}
            </Text>
            <PrivateAmount className="text-sm font-semibold">
              {formatMoney(proposal.amount)}
            </PrivateAmount>
          </View>
          <Text variant="muted" className="text-xs">
            {`${t(PROPOSAL_CADENCE_KEYS[proposal.recurrence])} · ${t(
              "recurringProposals.seenTimes",
              { count: proposal.count },
            )}`}
          </Text>
          <View className="flex-row items-center gap-2">
            <Button
              label={t("recurringProposals.accept")}
              size="sm"
              className="flex-1"
              disabled={pending}
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
