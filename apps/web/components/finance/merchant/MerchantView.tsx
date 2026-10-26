"use client";

import { useState } from "react";
import { CaretDown, CaretUp, MagnifyingGlass } from "@phosphor-icons/react";
import { formatShortDate } from "@finance/core/constants";
import {
  filterMerchants,
  MERCHANT_ROWS_SHOWN,
  type MerchantCard,
  type MerchantScreen,
} from "@finance/core/merchant-screen";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { TONE } from "@/components/finance/category/CategoryTile";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

interface MerchantViewProps {
  screen: MerchantScreen;
  today: string;
  initialQuery?: string;
}

/**
 * « Par commerce »: every place the money went over the last twelve months,
 * biggest first, one row a shop — how often, how much a time, what a normal
 * month comes to, when last. A row opens on its twelve months and its
 * entries. A search narrows the list by the shop's words or its category.
 * The phone draws the same screen.
 */
export function MerchantView({
  screen,
  today,
  initialQuery = "",
}: MerchantViewProps) {
  const t = useT();
  const [query, setQuery] = useState(initialQuery);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const shown = filterMerchants(screen.merchants, query);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("merchants.intro")}</p>

      {screen.merchants.length === 0 ? (
        <EmptyState
          title={t("merchants.empty")}
          description={t("merchants.emptyBody")}
        />
      ) : (
        <>
          <label className="relative block">
            <span className="sr-only">{t("merchants.searchLabel")}</span>
            <MagnifyingGlass
              size={ICON.md}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              placeholder={t("merchants.searchPlaceholder")}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-10"
            />
          </label>

          <p className="text-xs text-muted-foreground">
            {t("merchants.count", { count: shown.length })}
          </p>

          {shown.length === 0 ? (
            <EmptyState
              title={t("merchants.noMatch")}
              description={t("merchants.noMatchBody")}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {shown.map((card) => (
                <MerchantRow
                  key={card.key}
                  card={card}
                  today={today}
                  open={openKey === card.key}
                  onToggle={() =>
                    setOpenKey((current) =>
                      current === card.key ? null : card.key,
                    )
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function MerchantRow({
  card,
  today,
  open,
  onToggle,
}: {
  card: MerchantCard;
  today: string;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const [allRows, setAllRows] = useState(false);
  const panelId = `merchant-${card.key.replace(/\s+/g, "-")}`;
  const rows = allRows ? card.rows : card.rows.slice(0, MERCHANT_ROWS_SHOWN);
  const hidden = card.rows.length - rows.length;
  const peak = card.points.reduce((max, point) => Math.max(max, point.total), 0) || 1;
  const recent = card.lastOn >= today.slice(0, 7);

  return (
    <li
      className={cn(
        "rounded-card border border-border",
        open && "border-hairline-strong bg-muted/20",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("merchants.open", { name: card.name })}
        className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-muted/40"
      >
        <CategoryIcon icon={card.categoryIcon} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{card.name}</span>
          <span className="block text-xs text-muted-foreground">
            {card.categoryName}
            {" · "}
            {t("merchants.visits", { count: card.visits })}
            {" · "}
            <span className={cn(recent && "text-foreground")}>
              {t("merchants.lastOn", { date: formatShortDate(card.lastOn, locale) })}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <PrivateAmount className="text-sm font-semibold tabular-nums">
            {format(card.total)}
          </PrivateAmount>
          <PrivateAmount className="text-xs text-muted-foreground">
            {t("merchants.normal", { amount: format(card.normal) })}
          </PrivateAmount>
        </span>
        {open ? (
          <CaretUp size={ICON.sm} className="shrink-0 text-muted-foreground" />
        ) : (
          <CaretDown size={ICON.sm} className="shrink-0 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <div id={panelId} className="fade-in flex flex-col gap-4 px-3 pb-3">
          <p className="text-xs text-muted-foreground">
            <PrivateAmount>{t("merchants.perVisit", { amount: format(card.perVisit) })}</PrivateAmount>
            {" · "}
            <PrivateAmount>{t("merchants.total", { amount: format(card.total) })}</PrivateAmount>
            {card.mixed ? ` · ${t("merchants.mixed")}` : ""}
          </p>

          <div
            role="img"
            aria-label={t("merchants.chartLabel")}
            className="flex h-12 items-end gap-0.5"
          >
            {card.points.map((point) => (
              <span
                key={point.monthKey}
                title={`${point.shortLabel} · ${format(point.total)}`}
                className="flex-1 rounded-t-[2px]"
                style={{
                  height: point.empty
                    ? "1px"
                    : `${Math.max((point.total / peak) * 100, 3)}%`,
                  backgroundColor: point.empty
                    ? "var(--color-border)"
                    : TONE[card.categoryType],
                }}
              />
            ))}
          </div>

          <ul className="flex flex-col divide-y divide-border border-t border-border">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-baseline justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate">{row.note ?? card.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatShortDate(row.occurredOn, locale)}
                    {row.categoryName !== card.categoryName
                      ? ` · ${row.categoryName}`
                      : ""}
                  </span>
                </span>
                <PrivateAmount className="shrink-0 tabular-nums">
                  {format(row.amount)}
                </PrivateAmount>
              </li>
            ))}
          </ul>
          {hidden > 0 ? (
            <button
              type="button"
              onClick={() => setAllRows(true)}
              className="self-start text-xs text-muted-foreground hover:text-foreground"
            >
              {t("merchants.moreRows", { count: hidden })}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
