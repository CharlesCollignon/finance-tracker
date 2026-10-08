import { View } from "react-native";

import {
  subscriptionTotals,
  type Subscription,
  type SubscriptionFinding,
} from "@finance/core/subscription-watch";
import { subscriptionLine } from "@finance/core/weekly-recap";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";

/**
 * « Abonnements » on Récurrents, as on the web: the services the ledger
 * shows being paid every month or year, what they come to, and what changed
 * about them, in the Monday recap's own sentences. Facts only.
 */
export function SubscriptionsCard({
  subscriptions,
  findings,
}: {
  subscriptions: Subscription[];
  findings: SubscriptionFinding[];
}) {
  const t = useT();
  const format = useFormatCurrency();
  if (subscriptions.length === 0) {
    return null;
  }
  const totals = subscriptionTotals(subscriptions);

  return (
    <View className="gap-3 rounded-card border border-border bg-card/70 p-card">
      <View className="gap-1">
        <Text
          accessibilityRole="header"
          variant="muted"
          className="text-xs font-semibold uppercase tracking-wide"
        >
          {t("subscriptions.title")}
        </Text>
        <PrivateAmount className="text-sm text-muted-foreground">
          {t("subscriptions.total", {
            monthly: format(totals.monthly),
            yearly: format(totals.yearly),
          })}
        </PrivateAmount>
        <Text variant="muted" className="text-xs">
          {t("subscriptions.hint")}
        </Text>
      </View>

      <View>
        {subscriptions.map((subscription, index) => (
          <View
            key={subscription.key}
            className={
              index > 0
                ? "flex-row items-center justify-between gap-3 border-t border-border py-2.5"
                : "flex-row items-center justify-between gap-3 py-2.5"
            }
            style={subscription.status === "stopped" ? { opacity: 0.6 } : undefined}
          >
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-sm font-medium">
                {subscription.label}
              </Text>
              <Text numberOfLines={1} variant="muted" className="text-xs">
                {subscription.status === "stopped"
                  ? t("subscriptions.stopped")
                  : subscription.categoryName}
              </Text>
            </View>
            <PrivateAmount className="text-sm">
              {t(
                subscription.cadence === "yearly"
                  ? "subscriptions.perYear"
                  : "subscriptions.perMonth",
                { amount: format(subscription.amount) },
              )}
            </PrivateAmount>
          </View>
        ))}
      </View>

      {findings.length > 0 ? (
        <View className="gap-1.5 border-t border-border pt-3">
          <Text variant="muted" className="text-xs font-medium">
            {t("subscriptions.changes")}
          </Text>
          {findings.map((finding) => (
            <PrivateAmount
              key={`${finding.type}:${finding.on}:${"key" in finding ? finding.key : finding.kind}`}
              className="text-sm"
            >
              {subscriptionLine(finding, t, format)}
            </PrivateAmount>
          ))}
        </View>
      ) : null}
    </View>
  );
}
