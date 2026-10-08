"use client";

import {
  subscriptionTotals,
  type Subscription,
  type SubscriptionFinding,
} from "@finance/core/subscription-watch";
import { subscriptionLine } from "@finance/core/weekly-recap";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";

/**
 * « Abonnements » on Récurrents: the services the ledger shows being paid
 * every month or year (`watchSubscriptions`), what they come to, and what
 * changed about them — in the Monday recap's own sentences.
 *
 * Read off the transactions, so it holds what the bank, or the user, wrote
 * down: it is not the charges above, and it asks nothing. Facts only.
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
    <section className="flex flex-col gap-3 rounded-card border border-border bg-card px-5 py-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("subscriptions.title")}
        </h2>
        <PrivateAmount className="text-sm tabular-nums text-muted-foreground">
          {t("subscriptions.total", {
            monthly: format(totals.monthly),
            yearly: format(totals.yearly),
          })}
        </PrivateAmount>
      </header>
      <p className="text-xs text-muted-foreground">{t("subscriptions.hint")}</p>

      <ul className="flex flex-col divide-y divide-border">
        {subscriptions.map((subscription) => (
          <li
            key={subscription.key}
            className={cn(
              "flex items-center justify-between gap-3 py-2.5",
              subscription.status === "stopped" && "opacity-60",
            )}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {subscription.label}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {subscription.status === "stopped"
                  ? t("subscriptions.stopped")
                  : subscription.categoryName}
              </span>
            </span>
            <PrivateAmount className="shrink-0 text-sm tabular-nums">
              {t(
                subscription.cadence === "yearly"
                  ? "subscriptions.perYear"
                  : "subscriptions.perMonth",
                { amount: format(subscription.amount) },
              )}
            </PrivateAmount>
          </li>
        ))}
      </ul>

      {findings.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("subscriptions.changes")}
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            {findings.map((finding) => (
              <li
                key={`${finding.type}:${finding.on}:${"key" in finding ? finding.key : finding.kind}`}
              >
                <PrivateAmount>
                  {subscriptionLine(finding, t, format)}
                </PrivateAmount>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
