"use client";

import { Scales } from "@phosphor-icons/react";
import {
  spaceBalanceIsEmpty,
  type SpaceBalance,
} from "@finance/core/space-balance";
import { Card } from "@/components/finance/bearing/card-parts";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { ICON } from "@/lib/icon-scale";
import { MICRO } from "@/lib/type-scale";
import { useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

/* ------------------------------------------------- the balance between two */

/**
 * « Équilibre », under « Commun »: what each partner put into the joint
 * account this month, against their part of what the space spent, and the
 * one line it adds up to — what the partner behind would put in to be level
 * with the split. A fact about the month; never a payment between the two.
 * The phone draws the same card.
 */
export function BalanceBetweenCard({ balance }: { balance: SpaceBalance }) {
  const t = useT();
  const format = useFormatCurrency();

  return (
    <Card
      icon={<Scales size={ICON.sm} weight="bold" />}
      title={t("space.balanceTitle")}
    >
      {spaceBalanceIsEmpty(balance) ? (
        <p className="text-sm text-muted-foreground">
          {t("space.balanceNothing")}
        </p>
      ) : (
        <>
          <p className="text-sm font-medium">
            {balance.settle ? (
              <PrivateAmount>
                {t("space.balanceSettle", {
                  name: balance.settle.name,
                  amount: format(balance.settle.amount),
                })}
              </PrivateAmount>
            ) : (
              t("space.balanceEven")
            )}
          </p>
          <ul className="flex flex-col gap-1.5">
            {balance.members.map((line) => (
              <li
                key={line.userId}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <PrivateAmount className="min-w-0 truncate">
                  {t("space.balancePut", {
                    name: line.name,
                    amount: format(line.put),
                  })}
                </PrivateAmount>
                <PrivateAmount
                  className={cn(
                    "shrink-0 tabular-nums",
                    line.diff >= 0 ? "text-muted-foreground" : "text-warning",
                  )}
                >
                  {t("space.balancePart", { amount: format(line.part) })}
                </PrivateAmount>
              </li>
            ))}
          </ul>
          <p className={cn(MICRO, "text-muted-foreground")}>
            <PrivateAmount>
              {t("space.balanceSpent", { amount: format(balance.spent) })}
            </PrivateAmount>
            {" · "}
            {t("space.balanceHint")}
          </p>
        </>
      )}
    </Card>
  );
}
