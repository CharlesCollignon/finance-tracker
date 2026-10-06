import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { amountSign } from "@finance/core/amount-sign";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { formatShortDate } from "@finance/core/constants";
import type { PurchaseToConfirm } from "@finance/core/purchases-to-confirm";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import {
  recordPurchaseInsideWallet,
  skipPlannedOccurrence,
} from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON } from "@/theme/tokens";
import { useLocale, useT } from "@/providers/LocaleProvider";

/**
 * "Did this purchase go through?" — for a DCA PEA, a DCA CTO, with a bank
 * feeding the ledger. The web twin carries the reasoning: the bank never sees
 * money move inside a broker, so from its day the purchase is asked about
 * here. A yes records it on its day and grows its position, a no skips it,
 * and no answer records nothing. « Un autre jour » records one bought by
 * hand later, on a day picked from the days since.
 */
export function PurchasesToConfirm({
  purchases,
}: {
  purchases: PurchaseToConfirm[];
}) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const colors = useThemeColors();
  const formatEuro = useFormatCurrency();
  const [pending, setPending] = useState(false);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  // The purchase whose later days are showing, one at a time.
  const [choosing, setChoosing] = useState<string | null>(null);

  // An answer only hides its purchase until the screen's next read says it is
  // gone, so one put back somewhere else is asked about again.
  const [offered, setOffered] = useState(purchases);
  if (offered !== purchases) {
    setOffered(purchases);
    const present = new Set(purchases.map((purchase) => purchase.key));
    setAnswered((current) => {
      const kept = [...current].filter((key) => present.has(key));
      return kept.length === current.size ? current : new Set(kept);
    });
  }

  const waiting = purchases.filter((purchase) => !answered.has(purchase.key));

  if (waiting.length === 0) {
    return null;
  }

  function answer(
    purchase: PurchaseToConfirm,
    work: () => Promise<{ error?: string; message?: string }>,
    done: string,
    good: boolean,
  ) {
    if (pending) {
      return;
    }
    setAnswered((current) => new Set(current).add(purchase.key));
    setPending(true);

    void (async () => {
      const result = await work();
      setPending(false);

      if (result.error) {
        setAnswered((current) => {
          const next = new Set(current);
          next.delete(purchase.key);
          return next;
        });
        toast(result.error, "error");
        return;
      }

      if (good) {
        void hapticSuccess();
      }
      toast(result.message ?? done, "success");
    })();
  }

  return (
    <View
      accessibilityLabel={t("fulfilment.purchaseTitle", {
        count: waiting.length,
      })}
    >
      <View className="gap-0.5 border-b border-border px-4 py-2">
        <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("fulfilment.purchaseTitle", { count: waiting.length })}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {t("fulfilment.purchaseWhy")}
        </Text>
      </View>

      {waiting.map((purchase, index) => {
        const date = formatShortDate(purchase.occurredOn, locale);
        return (
          <View
            key={purchase.key}
            className={cn(
              "gap-2 px-4 py-3",
              index < waiting.length - 1 && "border-b border-border",
            )}
          >
            <View className="flex-row flex-wrap items-baseline gap-x-2">
              <Text className="text-sm font-medium">{purchase.label}</Text>
              <PrivateAmount
                className={cn("text-sm", TYPE_AMOUNT_CLASS.investment)}
              >
                {`${amountSign("investment")}${formatEuro(purchase.amount)}`}
              </PrivateAmount>
            </View>

            <Text className="text-xs text-muted-foreground">
              {t("fulfilment.purchaseDue", { date })}
            </Text>

            {choosing === purchase.key ? (
              <View className="mt-1 gap-2">
                <Text className="text-xs text-muted-foreground">
                  {t("fulfilment.purchaseLaterWhich")}
                </Text>
                <View className="flex-row flex-wrap items-center gap-2">
                  {purchase.laterDays.map((day) => {
                    const on = formatShortDate(day, locale);
                    return (
                      <Pressable
                        key={day}
                        accessibilityRole="button"
                        accessibilityLabel={`${t("fulfilment.purchaseLaterOn", { date: on })} — ${purchase.label}`}
                        accessibilityState={{ disabled: pending }}
                        disabled={pending}
                        onPress={() => {
                          void hapticLight();
                          answer(
                            purchase,
                            () =>
                              recordPurchaseInsideWallet(
                                purchase.templateId,
                                purchase.occurredOn,
                                day,
                              ),
                            t("fulfilment.done"),
                            true,
                          );
                        }}
                        className={cn(
                          "min-h-11 justify-center rounded-full border border-border px-4",
                          pending && "opacity-60",
                        )}
                      >
                        <Text className="text-sm">{on}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("common.cancel")}
                    onPress={() => setChoosing(null)}
                    className="min-h-11 min-w-11 items-center justify-center rounded-full"
                  >
                    <Ionicons
                      name="close"
                      size={ICON.md}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                </View>
              </View>
            ) : (
              <View className="mt-1 flex-row flex-wrap items-center gap-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t("fulfilment.purchaseYes")} — ${purchase.label}`}
                  accessibilityState={{ disabled: pending }}
                  disabled={pending}
                  onPress={() => {
                    void hapticLight();
                    answer(
                      purchase,
                      () =>
                        recordPurchaseInsideWallet(
                          purchase.templateId,
                          purchase.occurredOn,
                        ),
                      t("fulfilment.done"),
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
                    {t("fulfilment.purchaseYes")}
                  </Text>
                </Pressable>

                {purchase.laterDays.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t("fulfilment.purchaseLater")} — ${purchase.label}`}
                    accessibilityState={{ disabled: pending }}
                    disabled={pending}
                    onPress={() => {
                      void hapticLight();
                      setChoosing(purchase.key);
                    }}
                    className={cn(
                      "min-h-11 flex-row items-center gap-1.5 rounded-full px-4",
                      pending && "opacity-60",
                    )}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={ICON.md}
                      color={colors.mutedForeground}
                    />
                    <Text className="text-sm text-muted-foreground">
                      {t("fulfilment.purchaseLater")}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t("fulfilment.purchaseNo")} — ${purchase.label}`}
                  accessibilityState={{ disabled: pending }}
                  disabled={pending}
                  onPress={() => {
                    void hapticLight();
                    answer(
                      purchase,
                      () =>
                        skipPlannedOccurrence(
                          purchase.templateId,
                          purchase.occurredOn,
                        ),
                      t("planned.skipped", { date }),
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
                    {t("fulfilment.purchaseNo")}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
