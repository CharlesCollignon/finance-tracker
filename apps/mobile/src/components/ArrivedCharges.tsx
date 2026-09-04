import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  describeFulfilment,
  type FulfilmentProposal,
} from "@finance/core/recurring-fulfilment";
import { formatShortDate, relativeDayLabel } from "@finance/core/constants";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { fulfilOccurrence, refuseFulfilment } from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";

interface ArrivedChargesProps {
  proposals: FulfilmentProposal[];
  /** Called after a decision sticks, so the screen can reload its figures. */
  onDecided: () => void;
}

/**
 * "Did this arrive?" — the one question the app cannot answer for itself.
 *
 * A recurring template says €780 leaves on the 5th. The bank says €780 left
 * on the 4th. Whether those are the same rent is a judgement, and getting it
 * wrong in either direction is expensive: call them the same when they are
 * not and a real payment disappears from the forecast; call them different
 * and the month counts the rent twice, which on a salary means a whole
 * month's income added to a figure the user is about to spend against.
 *
 * So it is asked, every time. The web twin carries the same reasoning and the
 * same thresholds; the rules themselves are shared in
 * `@finance/core/recurring-fulfilment`, so the two apps cannot drift on what
 * counts as a candidate.
 */
export function ArrivedCharges({ proposals, onDecided }: ArrivedChargesProps) {
  const { toast } = useToast();
  const colors = useThemeColors();
  const formatEuro = useFormatCurrency();
  const [pending, setPending] = useState(false);
  const [answered, setAnswered] = useState<Set<string>>(new Set());

  const waiting = proposals.filter((proposal) => !answered.has(proposal.key));

  if (waiting.length === 0) {
    return null;
  }

  function answer(
    proposal: FulfilmentProposal,
    work: () => Promise<{ error?: string; message?: string }>,
    good: boolean,
  ) {
    if (pending) {
      return;
    }
    // Removed first, restored on failure. A row that vanished without the
    // decision being recorded is how a charge silently keeps its forecast.
    setAnswered((current) => new Set(current).add(proposal.key));
    setPending(true);

    void (async () => {
      const result = await work();
      setPending(false);

      if (result.error) {
        setAnswered((current) => {
          const next = new Set(current);
          next.delete(proposal.key);
          return next;
        });
        toast(result.error, "error");
        return;
      }

      if (good) {
        void hapticSuccess();
      }
      toast(result.message ?? "Done", "success");
      onDecided();
    })();
  }

  return (
    <View accessibilityLabel="Charges that look like they arrived">
      <Text className="border-b border-foreground/10 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {waiting.length === 1 ? "Did this arrive?" : "Did these arrive?"}
      </Text>

      {waiting.map((proposal, index) => {
        const income = proposal.categoryType === "income";
        return (
          <View
            key={proposal.key}
            className={cn(
              "gap-2 px-4 py-3",
              index < waiting.length - 1 && "border-b border-foreground/10",
            )}
          >
            <View className="flex-row flex-wrap items-baseline gap-x-2">
              <Text className="text-sm font-medium">{proposal.label}</Text>
              <PrivateAmount
                className={cn(
                  "text-sm",
                  income ? "text-success" : "text-destructive",
                )}
              >
                {`${income ? "+" : "−"}${formatEuro(proposal.actualAmount)}`}
              </PrivateAmount>
              <Text className="text-sm text-muted-foreground">
                {relativeDayLabel(proposal.actualOn, formatShortDate)}
              </Text>
            </View>

            {/* The bank's own words, so the row is recognisable as the thing
                on the statement rather than as our summary of it. */}
            {proposal.actualNote ? (
              <Text numberOfLines={1} className="text-xs text-muted-foreground">
                {proposal.actualNote}
              </Text>
            ) : null}

            <Text className="text-xs text-muted-foreground">
              {describeFulfilment(proposal, formatEuro)}
            </Text>

            <View className="mt-1 flex-row items-center gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Yes, ${proposal.label} arrived`}
                accessibilityState={{ disabled: pending }}
                disabled={pending}
                onPress={() => {
                  void hapticLight();
                  answer(
                    proposal,
                    () =>
                      fulfilOccurrence(
                        proposal.templateId,
                        proposal.occurredOn,
                        proposal.transactionId,
                      ),
                    true,
                  );
                }}
                className={cn(
                  "min-h-11 flex-row items-center gap-1.5 rounded-full bg-primary px-4",
                  pending && "opacity-60",
                )}
              >
                <Ionicons
                  name="checkmark"
                  size={15}
                  color={colors.primaryForeground}
                />
                <Text className="text-sm font-medium text-primary-foreground">
                  That&apos;s it
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`No, that is not ${proposal.label}`}
                accessibilityState={{ disabled: pending }}
                disabled={pending}
                onPress={() => {
                  void hapticLight();
                  answer(
                    proposal,
                    () =>
                      refuseFulfilment(
                        proposal.templateId,
                        proposal.occurredOn,
                        proposal.transactionId,
                      ),
                    false,
                  );
                }}
                className={cn(
                  "min-h-11 flex-row items-center gap-1.5 rounded-full px-4",
                  pending && "opacity-60",
                )}
              >
                <Ionicons
                  name="close"
                  size={15}
                  color={colors.mutedForeground}
                />
                <Text className="text-sm text-muted-foreground">Not it</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}
