import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { amountSign } from "@finance/core/amount-sign";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { formatShortDate } from "@finance/core/constants";
import { searchNeedle, searchesEveryMonth } from "@finance/core/ledger-search";
import type { TransactionWithCategory } from "@finance/core/types/database";

import { CategoryIcon } from "@/components/CategoryIcon";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { searchEveryMonth } from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";

/** How many rows from other months are listed before « +N ». */
const SHOWN = 20;
/** How long the typing has to pause before every month is asked. */
const PAUSE_MS = 300;

/**
 * The Journal's search beyond the month on screen, as on the web: the rows
 * of every other month the same words or amount find, newest first. Each
 * opens its month, where the search, kept, finds it again in its place.
 */
export function EveryMonthResults({
  query,
  year,
  month,
  onOpenMonth,
}: {
  query: string;
  year: number;
  month: number;
  onOpenMonth: (year: number, month: number) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { user } = useAuth();
  const [found, setFound] = useState<{
    query: string;
    rows: TransactionWithCategory[];
    more: boolean;
  } | null>(null);
  const wanted = searchesEveryMonth(searchNeedle(query));

  useEffect(() => {
    if (!wanted || !user) {
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      void searchEveryMonth(user.id, query)
        .then((result) => {
          if (current) {
            setFound({ query, ...result });
          }
        })
        .catch(() => {
          // Only the month on screen, then: the other months are a bonus.
        });
    }, PAUSE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, wanted, user]);

  if (!wanted || !found || found.query !== query) {
    return null;
  }
  const shownMonth = `${year}-${String(month).padStart(2, "0")}`;
  const others = found.rows.filter(
    (tx) => !tx.occurred_on.startsWith(shownMonth),
  );
  if (others.length === 0) {
    return null;
  }

  return (
    <View className="mt-2 gap-1 border-t border-border pt-4">
      <Text
        accessibilityRole="header"
        variant="muted"
        className="text-xs font-medium uppercase tracking-wider"
      >
        {t("ledger.otherMonths", { count: others.length })}
        {found.more ? "+" : ""}
      </Text>
      {others.slice(0, SHOWN).map((tx) => (
        <Pressable
          key={tx.id}
          accessibilityRole="button"
          onPress={() => {
            void hapticLight();
            onOpenMonth(
              Number(tx.occurred_on.slice(0, 4)),
              Number(tx.occurred_on.slice(5, 7)),
            );
          }}
          className="min-h-12 flex-row items-center justify-between gap-3 py-2"
        >
          <View className="min-w-0 flex-1 flex-row items-center gap-3">
            <CategoryIcon icon={tx.categories.icon} className="h-8 w-8" />
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-sm font-medium">
                {tx.note || tx.categories.name}
              </Text>
              <Text numberOfLines={1} variant="muted" className="text-xs">
                {formatShortDate(tx.occurred_on, locale)} · {tx.categories.name}
              </Text>
            </View>
          </View>
          <PrivateAmount
            className={cn(
              "text-sm font-medium",
              TYPE_AMOUNT_CLASS[tx.categories.type],
            )}
          >
            {`${amountSign(tx.categories.type)}${format(Number(tx.amount))}`}
          </PrivateAmount>
        </Pressable>
      ))}
      {others.length > SHOWN ? (
        <Text variant="muted" className="text-xs">
          {t("ledger.otherMonthsMore", { count: others.length - SHOWN })}
        </Text>
      ) : null}
    </View>
  );
}
