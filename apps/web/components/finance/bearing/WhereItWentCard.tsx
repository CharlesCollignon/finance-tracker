"use client";

import { ChartPieSlice } from "@phosphor-icons/react";
import type { BearingMonth } from "@/lib/bearing/month";
import { MyShareToggle } from "@/components/finance/bearing/MyShareToggle";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { ICON } from "@/lib/icon-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";
import { Card } from "@/components/finance/bearing/card-parts";

export function WhereItWentCard({ data }: { data: BearingMonth }) {
  const t = useT();
  const format = useFormatCurrency();
  const { spending } = data;
  const peak = Math.max(1, ...spending.top.map((entry) => entry.total));

  return (
    <Card
      icon={<ChartPieSlice size={ICON.sm} weight="bold" />}
      title={t("bearingMonth.whereItWent")}
      href="/history"
      action={data.myShare ? <MyShareToggle /> : null}
    >
      <ul className="flex flex-col gap-4">
        {spending.top.map((entry) => {
          // Against the month's largest, so the bars rank the categories.
          const ratio = entry.total / peak;
          return (
            <li key={entry.categoryId} className="flex items-center gap-3">
              <CategoryIcon
                icon={entry.icon}
                className="size-9 shrink-0 rounded-control border-0 bg-muted"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">
                    {entry.name}
                  </span>
                  <PrivateAmount className="shrink-0 text-sm tabular-nums">
                    {format(entry.total)}
                  </PrivateAmount>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="grow-in h-full rounded-full bg-foreground/40"
                    style={{
                      width: `${Math.min(100, ratio * 100)}%`,
                      transition: "width 500ms cubic-bezier(0.32, 0.72, 0, 1)",
                    }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {spending.rest > 0 ? (
        <p className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("bearingMonth.everythingElse")}</span>
          <PrivateAmount className="tabular-nums">
            {format(spending.rest)}
          </PrivateAmount>
        </p>
      ) : null}
    </Card>
  );
}
