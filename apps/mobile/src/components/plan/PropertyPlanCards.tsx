import { useMemo, useState } from "react";
import { View } from "react-native";

import { resolveMessage } from "@finance/core/i18n/t";
import { propertyPosition } from "@finance/core/property";
import {
  DEFAULT_PROPERTY_GROWTH,
  loanEndings,
  netWorth,
  projectProperty,
  type LoanEnding,
} from "@finance/core/property-future";
import type { PropertyRead } from "@finance/data/properties";

import { PrivateAmount } from "@/components/PrivateAmount";
import { monthAndYear } from "@/components/property/fields";
import { Text } from "@/components/ui/Text";
import { setGrowth } from "@/lib/properties";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { TYPE } from "@/theme/tokens";

import { NumberField } from "./Fields";
import { usePlanMoney } from "./format";
import { PlanCard, PlanCardHeader } from "./PlanCard";

/**
 * The properties on the Plan: where everything stands today, homes and
 * loans counted, and what the homes could leave in the long view's years.
 * The web's `PropertyPlanCards`, from the same core arithmetic.
 *
 * Both beside the savings and investments, never in them: a milestone and
 * the long view's monthly income are about money one can spend, and the
 * home one lives in is not.
 */

/** Today's net worth: the savings and investments, the homes, the loans. */
export function NetWorthCard({
  liquid,
  properties,
  today,
}: {
  /** Savings and investments, as the milestones count them. */
  liquid: number;
  properties: readonly PropertyRead[];
  today: string;
}) {
  const t = useT();
  const locale = useLocale();
  const { whole, shown } = usePlanMoney();

  const worth = useMemo(
    () =>
      netWorth(
        liquid,
        properties.map(({ property, loans, market }) =>
          propertyPosition(property, loans, today, market),
        ),
      ),
    [liquid, properties, today],
  );
  const endings = useMemo(
    () => endingsAcross(properties, today),
    [properties, today],
  );

  const rows = [
    { label: t("property.netWorthLiquid"), value: whole(worth.liquid) },
    { label: t("property.netWorthProperty"), value: whole(worth.property) },
    { label: t("property.netWorthOwed"), value: `−${whole(worth.owed)}` },
  ];

  return (
    <PlanCard>
      <PlanCardHeader title={t("property.netWorthTitle")} />
      <View className="gap-1">
        <PrivateAmount style={TYPE.figure} numberOfLines={1} adjustsFontSizeToFit>
          {whole(worth.net)}
        </PrivateAmount>
        <Text variant="muted" className="text-sm">
          {t("property.netWorthLabel")}
        </Text>
      </View>
      <View>
        {rows.map((row, index) => (
          <View
            key={row.label}
            className={
              index < rows.length - 1
                ? "flex-row items-baseline justify-between gap-3 border-b border-border py-2"
                : "flex-row items-baseline justify-between gap-3 py-2"
            }
          >
            <Text variant="muted" className="min-w-0 flex-1 text-sm">
              {row.label}
            </Text>
            <PrivateAmount className="text-sm">{row.value}</PrivateAmount>
          </View>
        ))}
      </View>
      {endings.length > 0 ? (
        <View className="gap-1.5">
          {endings.map((ending) => (
            <Text key={`${ending.label}-${ending.endsOn}`} className="text-sm">
              {t("property.loanEndFrees", {
                label: ending.label,
                date: monthAndYear(ending.endsOn, locale),
                amount: shown(ending.monthly),
              })}
            </Text>
          ))}
        </View>
      ) : null}
      <Text variant="muted" style={TYPE.micro}>
        {t("property.netWorthNote")}
      </Text>
    </PlanCard>
  );
}

/**
 * The loans still running across every property, soonest first. With more
 * than one property a loan is named with its home, since two of them can
 * both be « Prêt principal ».
 */
function endingsAcross(
  properties: readonly PropertyRead[],
  today: string,
): LoanEnding[] {
  return properties
    .flatMap(({ property, loans }) =>
      loanEndings(loans, today).map((ending) =>
        properties.length > 1
          ? { ...ending, label: `${property.name} · ${ending.label}` }
          : ending,
      ),
    )
    .sort((a, b) => a.endsOn.localeCompare(b.endsOn));
}

/**
 * The homes at the long view's horizon: grown at each one's own rate, less
 * what its loans would still owe and what a sale would pay in tax — and,
 * with the long view's net, everything together.
 */
export function PropertyLongViewCard({
  properties,
  today,
  years,
  inflation,
  liquidNet,
}: {
  properties: readonly PropertyRead[];
  today: string;
  years: number;
  inflation: number;
  /** The long view's own net at the horizon. */
  liquidNet: number;
}) {
  const t = useT();
  const { whole, shown } = usePlanMoney();
  const { toast } = useToast();

  // What each field says, held here so the figures follow the typing; kept
  // once the field is left, if it changed.
  const saved = (read: PropertyRead) =>
    read.property.yearly_growth === null
      ? DEFAULT_PROPERTY_GROWTH
      : Number(read.property.yearly_growth);
  const [growth, setGrowthFor] = useState<Record<string, number>>(() =>
    Object.fromEntries(properties.map((read) => [read.property.id, saved(read)])),
  );
  const [kept, setKept] = useState(growth);

  const deflate = (amount: number) => amount / (1 + inflation) ** years;
  const rows = properties.map((read) => {
    const rate = growth[read.property.id] ?? saved(read);
    const projected = projectProperty(read.property, read.loans, read.market, {
      years,
      growth: rate,
      today,
    });
    return { read, rate, end: projected.at(-1)! };
  });
  const total = liquidNet + rows.reduce((sum, row) => sum + row.end.net, 0);

  function keep(propertyId: string) {
    const rate = growth[propertyId];
    if (rate === undefined || rate === kept[propertyId]) {
      return;
    }
    setKept((current) => ({ ...current, [propertyId]: rate }));
    void setGrowth(propertyId, rate).then((result) => {
      if (!result.success) {
        toast(resolveMessage(t, result.error), "error");
      }
    });
  }

  return (
    <PlanCard>
      <PlanCardHeader title={t("property.longViewTitle", { count: years })} />
      {rows.map(({ read, rate, end }) => (
        <View
          key={read.property.id}
          className="gap-3 rounded-control border border-border p-3"
        >
          <View className="gap-1">
            <Text className="font-medium">{read.property.name}</Text>
            <PrivateAmount className="text-xl font-semibold">
              {whole(end.net)}
            </PrivateAmount>
            <Text variant="muted" className="text-sm">
              {t("property.longViewNet")}
            </Text>
            <Text className="text-sm">
              {t("property.worthLine", {
                value: shown(end.value),
                owed: shown(end.owed),
              })}
            </Text>
            <Text className="text-sm">
              {read.property.usage === "main_home"
                ? t("property.longViewTaxNone")
                : t("property.longViewTax", { amount: shown(end.tax) })}
            </Text>
            <Text variant="muted" className="text-sm">
              {t("futurePlan.longReal", { amount: shown(deflate(end.net)) })}
            </Text>
          </View>
          <View className="flex-row">
            <NumberField
              label={t("property.longViewGrowth")}
              value={rate}
              kind="percent"
              min={-0.2}
              max={0.2}
              onChange={(next) =>
                setGrowthFor((current) => ({
                  ...current,
                  [read.property.id]: next,
                }))
              }
              onDone={() => keep(read.property.id)}
            />
          </View>
        </View>
      ))}
      <View className="gap-1">
        <Text className="text-sm font-medium text-primary-ink">
          {t("property.longViewTotal", { amount: shown(total) })}
        </Text>
        <Text variant="muted" className="text-sm">
          {t("futurePlan.longReal", { amount: shown(deflate(total)) })}
        </Text>
      </View>
      <Text variant="muted" style={TYPE.micro}>
        {t("futurePlan.estimate")} {t("property.longViewNote")}
      </Text>
    </PlanCard>
  );
}
