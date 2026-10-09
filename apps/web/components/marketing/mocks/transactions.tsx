"use client";

import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import {
  landingSampleFor,
  type LocalisedLandingSample,
} from "@/components/marketing/landing-sample";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import {
  MobileHero,
  MobileShell,
  MockCard,
  type Variant,
  WebHero,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";

/** The Journal, as a landing mock (`./frame.tsx`). */

/* ----------------------------------------------------------- transactions */

function WebTransactionRow({
  item,
}: {
  item: LocalisedLandingSample["transactions"][number];
}) {
  const euro = useEuro();
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <CategoryIcon
          icon={item.icon}
          className="h-9 w-9 shrink-0 rounded-control border-0 bg-muted"
        />
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-semibold">{item.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.dayLabel} · {item.meta}
          </p>
        </div>
      </div>
      <span
        className={cn(
          "privacy-amount shrink-0 whitespace-nowrap font-mono text-sm font-medium tabular-nums",
          TYPE_AMOUNT_CLASS[item.type],
        )}
      >
        {item.amount >= 0 ? "+" : "−"}
        {euro(Math.abs(item.amount))}
      </span>
    </div>
  );
}

/** Real phone rows carry no icon chip — name and date left, amount right. */
function MobileTransactionRow({
  item,
}: {
  item: LocalisedLandingSample["transactions"][number];
}) {
  const euro = useEuro();
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-2.5">
      <div className="min-w-0 text-left">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.dayLabel} · {item.meta}
        </p>
      </div>
      <span
        className={cn(
          "privacy-amount shrink-0 whitespace-nowrap font-mono text-sm font-bold tabular-nums",
          TYPE_AMOUNT_CLASS[item.type],
        )}
      >
        {item.amount >= 0 ? "+" : "−"}
        {euro(Math.abs(item.amount))}
      </span>
    </div>
  );
}

export function TransactionsMock({ variant = "web" }: { variant?: Variant }) {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const euro = useEuro();
  const { remaining, income, spent, transactions, monthLabel } = sample;
  const rows = [...transactions].reverse();

  if (variant === "mobile") {
    return (
      <MobileShell active="nav.ledger">
        <MockCard innerClassName="p-4">
          <MobileHero
            label={t("marketingMock.whatsLeft")}
            amount={`+${euro(remaining)}`}
            amountClassName="text-success"
            subtitle={
              <p>
                <span className="privacy-amount text-success tabular-nums">
                  {euro(income)}
                </span>
                {" in · "}
                <span className="privacy-amount text-destructive tabular-nums">
                  {euro(spent)}
                </span>
                {" out"}
              </p>
            }
          />
        </MockCard>
        <MockCard innerClassName="divide-y divide-border p-4">
          {rows.slice(0, 5).map((item) => (
            <MobileTransactionRow
              key={`${item.name}-${item.day}`}
              item={item}
            />
          ))}
        </MockCard>
      </MobileShell>
    );
  }

  return (
    <WebShell active="nav.ledger" monthLabel={monthLabel}>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <MockCard innerClassName="flex h-full flex-col items-center justify-center px-6 py-6">
            <WebHero
              label={t("marketingMock.whatsLeft")}
              amount={`+${euro(remaining)}`}
              amountClassName="text-success"
              subtitle={
                <p>
                  <span className="privacy-amount text-success tabular-nums">
                    {euro(income)}
                  </span>
                  {" in · "}
                  <span className="privacy-amount text-destructive tabular-nums">
                    {euro(spent)}
                  </span>
                  {" out"}
                </p>
              }
            />
          </MockCard>
        </div>
        <div className="col-span-8">
          <MockCard innerClassName="divide-y divide-border px-3 py-1.5">
            {rows.map((item) => (
              <WebTransactionRow key={`${item.name}-${item.day}`} item={item} />
            ))}
          </MockCard>
        </div>
      </div>
    </WebShell>
  );
}
