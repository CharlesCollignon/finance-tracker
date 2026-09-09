import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  describeFulfilment,
  describeMiss,
  type FulfilmentMiss,
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
import { ICON } from "@/theme/tokens";
import { useLocale, useT } from "@/providers/LocaleProvider";

interface ArrivedChargesProps {
  proposals: FulfilmentProposal[];
  /**
   * Occurrences the matcher could not offer, and why.
   *
   * Optional so a caller with nothing to say about absences can leave it out,
   * but the Ledger's dots are the reason it matters: a row that is confirmed
   * or waiting gets a mark, and a charge that never arrived has no row to mark
   * at all. This is the only place that absence is visible.
   */
  misses?: FulfilmentMiss[];
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
export function ArrivedCharges({
  proposals,
  misses = [],
  onDecided,
}: ArrivedChargesProps) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const colors = useThemeColors();
  const formatEuro = useFormatCurrency();
  const [pending, setPending] = useState(false);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [showMisses, setShowMisses] = useState(false);

  const waiting = proposals.filter((proposal) => !answered.has(proposal.key));

  // This used to return on `waiting.length === 0` alone, on the reasoning that
  // "an absence is only a question once something else has been offered". That
  // was right while the misses were a footnote to a question; it is wrong now
  // that they are the only place a charge which never arrived is mentioned. A
  // month where nothing was offered and three charges are missing is the case
  // this block exists for, and it was the one case it stayed silent for.
  if (waiting.length === 0 && misses.length === 0) {
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
    <View accessibilityLabel={t("common.arrivedCharges")}>
      {waiting.length > 0 ? (
        <Text className="border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("fulfilment.askTitle", { count: waiting.length })}
        </Text>
      ) : null}

      {waiting.map((proposal, index) => {
        const income = proposal.categoryType === "income";
        return (
          <View
            key={proposal.key}
            className={cn(
              "gap-2 px-4 py-3",
              index < waiting.length - 1 && "border-b border-border",
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
              {describeFulfilment(proposal, formatEuro, locale)}
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
                  size={ICON.md}
                  color={colors.primaryForeground}
                />
                <Text className="text-sm font-medium text-primary-foreground">
                  {t("fulfilment.thatsIt")}
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
                  size={ICON.md}
                  color={colors.mutedForeground}
                />
                <Text className="text-sm text-muted-foreground">
                  {t("fulfilment.notIt")}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      {/* Collapsed by default. A narrow matcher should be legible rather than
          merely silent, but the reasons are a second-order question and the
          charges themselves are what the block is for. */}
      {misses.length > 0 ? (
        <View
          className={cn(
            "px-4 py-2.5",
            waiting.length > 0 && "border-t border-border",
          )}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showMisses }}
            onPress={() => {
              void hapticLight();
              setShowMisses((current) => !current);
            }}
            className="min-h-11 justify-center"
          >
            <Text className="text-xs text-muted-foreground underline">
              {showMisses
                ? t("fulfilment.misses.hide")
                : t("fulfilment.misses.show", { count: misses.length })}
            </Text>
          </Pressable>

          {showMisses ? (
            <View className="mt-2 gap-1">
              {misses.map((miss) => (
                <View
                  key={miss.key}
                  className="flex-row flex-wrap items-baseline gap-x-2"
                >
                  <Text className="text-xs">{miss.label}</Text>
                  <PrivateAmount className="text-xs text-muted-foreground">
                    {formatEuro(miss.expectedAmount)}
                  </PrivateAmount>
                  <Text className="text-xs text-muted-foreground">
                    {formatShortDate(miss.occurredOn)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {`· ${describeMiss(miss, formatEuro, locale)}`}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
