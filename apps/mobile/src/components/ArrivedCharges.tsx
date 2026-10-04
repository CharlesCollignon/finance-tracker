import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  confirmLabel,
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
import { ICON } from "@/theme/tokens";
import { useLocale, useT } from "@/providers/LocaleProvider";

interface ArrivedChargesProps {
  proposals: FulfilmentProposal[];
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
}: ArrivedChargesProps) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const colors = useThemeColors();
  const formatEuro = useFormatCurrency();
  const [pending, setPending] = useState(false);
  const [answered, setAnswered] = useState<Set<string>>(new Set());

  // An answer only hides its proposal until the screen's next read says it
  // is gone. Kept for good, a proposal reopened somewhere else — undone on
  // the web, a moved income put back — would stay invisible here until the
  // screen remounted. Adjusted while rendering, the pattern React documents
  // for "reset state when an input changes".
  const [offered, setOffered] = useState(proposals);
  if (offered !== proposals) {
    setOffered(proposals);
    const present = new Set(proposals.map((proposal) => proposal.key));
    setAnswered((current) => {
      const kept = [...current].filter((key) => present.has(key));
      return kept.length === current.size ? current : new Set(kept);
    });
  }

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
      toast(result.message ?? t("fulfilment.done"), "success");
    })();
  }

  /**
   * Every waiting pairing at once — the web card's twin. A salary paid early
   * usually brings its savings and its broker transfer with it, and three
   * presses of "Compter pour octobre" is one decision asked three times. One
   * at a time, so two confirmations never race for the same row.
   */
  function confirmAll() {
    if (pending) {
      return;
    }
    const batch = waiting;
    setAnswered((current) => {
      const next = new Set(current);
      batch.forEach((proposal) => next.add(proposal.key));
      return next;
    });
    setPending(true);

    void (async () => {
      let confirmed = 0;
      let firstError: string | null = null;
      const failed: string[] = [];
      for (const proposal of batch) {
        const result = await fulfilOccurrence(
          proposal.templateId,
          proposal.occurredOn,
          proposal.transactionId,
          locale,
        );
        if (result.error) {
          failed.push(proposal.key);
          firstError ??= result.error;
        } else {
          confirmed += 1;
        }
      }
      setPending(false);
      if (failed.length > 0) {
        setAnswered((current) => {
          const next = new Set(current);
          failed.forEach((key) => next.delete(key));
          return next;
        });
        toast(firstError!, "error");
      }
      if (confirmed > 0) {
        void hapticSuccess();
        toast(t("fulfilment.allConfirmed", { count: confirmed }), "success");
      }
    })();
  }

  return (
    <View accessibilityLabel={t("common.arrivedCharges")}>
      {waiting.length > 0 ? (
        <View className="flex-row items-center justify-between gap-3 border-b border-border px-4 py-2">
          <Text className="min-w-0 flex-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("fulfilment.askTitle", { count: waiting.length })}
          </Text>
          {waiting.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              disabled={pending}
              onPress={() => {
                void hapticLight();
                confirmAll();
              }}
              hitSlop={6}
              className={cn(
                "min-h-9 flex-row items-center gap-1.5 rounded-full border border-border px-3",
                pending && "opacity-60",
              )}
            >
              <Ionicons
                name="checkmark-done"
                size={ICON.sm}
                color={colors.foreground}
              />
              <Text className="text-xs font-medium">
                {t("fulfilment.confirmAll")}
              </Text>
            </Pressable>
          ) : null}
        </View>
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
                {relativeDayLabel(proposal.actualOn, formatShortDate, locale)}
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
                accessibilityLabel={`${confirmLabel(proposal, locale)} — ${proposal.label}`}
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
                        locale,
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
                  {/* "Compter pour octobre" for a salary paid early for
                      next month: that is what pressing it does. */}
                  {confirmLabel(proposal, locale)}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("fulfilment.notThis", {
                  name: proposal.label,
                })}
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

    </View>
  );
}
