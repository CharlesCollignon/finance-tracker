import { useState, type ReactNode } from "react";
import { View } from "react-native";

import { parseTypedAmount } from "@finance/core/amount-input";
import {
  formatFullDate,
  formatPercentLabel,
  RENT_CATEGORY_NAMES,
} from "@finance/core/constants";
import { resolveMessage, type Key } from "@finance/core/i18n/t";
import type { PropertyPosition } from "@finance/core/property";
import type { RentReference } from "@finance/core/rent-reference";
import {
  lettingRule,
  rentalFigures,
  rentPerM2,
  type LettingRule,
} from "@finance/core/rental";
import type { RentScope, RentSeries } from "@finance/core/types/database";
import type { PropertyRead } from "@finance/data/properties";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { hapticSuccess, hapticWarning } from "@/lib/haptics";
import { addRent } from "@/lib/properties";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";

import { TextField } from "./fields";

const SERIES_KEYS: Record<RentSeries, Key> = {
  app: "property.askingSeriesApp",
  app12: "property.askingSeriesApp12",
  app3: "property.askingSeriesApp3",
  mai: "property.askingSeriesMai",
};

const SCOPE_KEYS: Record<RentScope, Key> = {
  commune: "property.askingScopeCommune",
  epci: "property.askingScopeEpci",
  maille: "property.askingScopeMaille",
};

/**
 * A let property's month, the asking rents around it and what its DPE says
 * about letting it: the web's `RentalSection`, from the same core reading.
 */
export function RentalSection({
  detail,
  position,
  today,
}: {
  detail: PropertyRead;
  position: PropertyPosition;
  today: string;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { property, loans, templates } = detail;
  const figures = rentalFigures(loans, templates, position.cost, today);
  const perM2 = rentPerM2(figures.rent, property.living_area);
  const letting = lettingRule(property.energy_class, property.citycode, today);
  const percent = (value: number) => formatPercentLabel(value * 100, locale);

  return (
    <View className="gap-3">
      <Text className="font-semibold" style={{ fontSize: 17 }}>
        {t("property.rentalTitle")}
      </Text>

      <Card bezel innerClassName="gap-4">
        {figures.rent > 0 ? (
          <>
            <View className="gap-0.5">
              <Text variant="muted" className="text-xs">
                {figures.cashFlow >= 0
                  ? t("property.cashFlowLeaves")
                  : t("property.cashFlowCosts")}
              </Text>
              <PrivateAmount className="text-3xl font-semibold">
                {format(Math.abs(figures.cashFlow))}
              </PrivateAmount>
            </View>
            <View className="flex-row flex-wrap gap-y-4">
              <Fact label={t("property.rentMonthly")}>
                <PrivateAmount className="text-sm font-medium">
                  {t("property.perMonth", { amount: format(figures.rent) })}
                </PrivateAmount>
                {perM2 !== null ? (
                  <PrivateAmount className="text-xs text-muted-foreground">
                    {t("property.rentPerM2", { amount: format(perM2) })}
                  </PrivateAmount>
                ) : null}
              </Fact>
              <Fact label={t("property.chargesMonthly")}>
                <PrivateAmount className="text-sm font-medium">
                  {t("property.perMonth", { amount: format(figures.charges) })}
                </PrivateAmount>
              </Fact>
              {figures.loans > 0 ? (
                <Fact label={t("property.loansMonthly")}>
                  <PrivateAmount className="text-sm font-medium">
                    {t("property.perMonth", { amount: format(figures.loans) })}
                  </PrivateAmount>
                </Fact>
              ) : null}
              {figures.grossYield !== null && figures.netYield !== null ? (
                <Fact label={t("property.yieldLabel")}>
                  <PrivateAmount className="text-sm font-medium">
                    {t("property.yieldLine", {
                      gross: percent(figures.grossYield),
                      net: percent(figures.netYield),
                    })}
                  </PrivateAmount>
                </Fact>
              ) : null}
            </View>
            <Text variant="muted" className="text-xs">
              {`${t("property.cashFlowNote")} ${t("property.yieldNote")}`}
            </Text>
          </>
        ) : (
          <View className="gap-3">
            <Text variant="muted">{t("property.rentNone")}</Text>
            <RentEditor propertyId={property.id} propertyName={property.name} />
          </View>
        )}
      </Card>

      <AskingRents
        reference={detail.rent}
        area={property.living_area}
        hasAddress={property.citycode !== null}
        furnished={property.usage === "rental_furnished"}
      />

      {letting ? (
        <LettingFacts
          rule={letting}
          energyClass={property.energy_class}
          dateOf={(iso) => formatFullDate(iso, locale)}
        />
      ) : null}
    </View>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="w-1/2 min-w-0 gap-0.5 pr-3">
      <Text variant="muted" className="text-xs">
        {label}
      </Text>
      {children}
    </View>
  );
}

/** « Ajouter le loyer »: one amount, kept as a monthly income template. */
function RentEditor({
  propertyId,
  propertyName,
}: {
  propertyId: string;
  propertyName: string;
}) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const typed = parseTypedAmount(value);
  const valid = typed !== null && typed > 0;

  if (!open) {
    return (
      <Button
        label={t("property.rentAdd")}
        variant="outline"
        size="sm"
        onPress={() => setOpen(true)}
      />
    );
  }

  async function submit() {
    if (!valid || typed === null) {
      return;
    }
    setPending(true);
    const result = await addRent({
      propertyId,
      amount: typed,
      categoryName: RENT_CATEGORY_NAMES[locale],
      description: t("property.rentDescription", { name: propertyName }),
    });
    setPending(false);
    if (!result.success) {
      void hapticWarning();
      toast(resolveMessage(t, result.error ?? "errors.couldNotSave"), "error");
      return;
    }
    void hapticSuccess();
    toast(t("property.rentAdded"));
    setOpen(false);
  }

  return (
    <View className="gap-3">
      <TextField
        label={t("property.rentAdd")}
        hint={t("property.rentAddHint")}
        value={value}
        onChange={setValue}
        numeric
        suffix="€"
      />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            label={pending ? t("common.working") : t("property.saveValue")}
            size="sm"
            disabled={!valid || pending}
            onPress={() => void submit()}
          />
        </View>
        <View className="flex-1">
          <Button
            label={t("common.cancel")}
            variant="ghost"
            size="sm"
            onPress={() => setOpen(false)}
          />
        </View>
      </View>
    </View>
  );
}

function AskingRents({
  reference,
  area,
  hasAddress,
  furnished,
}: {
  reference: RentReference | null;
  area: number | null;
  hasAddress: boolean;
  furnished: boolean;
}) {
  const t = useT();
  const format = useFormatCurrency();
  return (
    <Card className="gap-1">
      <Text className="text-sm font-medium">{t("property.askingTitle")}</Text>
      {reference ? (
        <>
          <Text className="text-sm">
            {t("property.askingLine", {
              median: format(reference.rentM2),
              low: format(reference.lowM2),
              high: format(reference.highM2),
            })}
          </Text>
          {area ? (
            <PrivateAmount className="text-sm text-muted-foreground">
              {t("property.askingFor", {
                amount: format(Math.round(reference.rentM2 * area)),
                area,
              })}
            </PrivateAmount>
          ) : null}
          {furnished ? (
            <Text variant="muted" className="text-xs">
              {t("property.askingFurnished")}
            </Text>
          ) : null}
          <Text variant="muted" className="text-xs">
            {t("property.askingSource", {
              series: t(SERIES_KEYS[reference.series]),
              scope: t(SCOPE_KEYS[reference.scope]),
              year: reference.edition,
            })}
          </Text>
        </>
      ) : (
        <Text variant="muted" className="text-sm">
          {hasAddress ? t("property.askingNone") : t("property.askingNoAddress")}
        </Text>
      )}
    </Card>
  );
}

function LettingFacts({
  rule,
  energyClass,
  dateOf,
}: {
  rule: LettingRule;
  energyClass: string | null;
  dateOf: (iso: string) => string;
}) {
  const t = useT();
  const { status } = rule;
  const energy = energyClass ?? "";
  const line =
    status.kind === "unknown"
      ? t("property.lettingUnknown")
      : status.kind === "open"
        ? t("property.lettingOpen", { energy })
        : status.kind === "closing"
          ? t("property.lettingClosing", { energy, date: dateOf(status.on) })
          : t("property.lettingClosed", { energy, date: dateOf(status.since) });
  return (
    <Card className="gap-1">
      <Text className="text-sm font-medium">{t("property.lettingTitle")}</Text>
      <Text className="text-sm">{line}</Text>
      {rule.rentFrozen ? <Text className="text-sm">{t("property.rentFrozen")}</Text> : null}
      {energy === "E" || energy === "F" || energy === "G" ? (
        <Text variant="muted" className="text-xs">
          {t("property.dpeElectricity")}
        </Text>
      ) : null}
      {status.kind !== "unknown" ? (
        <Text variant="muted" className="text-xs">
          {t("property.lettingSource")}
        </Text>
      ) : null}
    </Card>
  );
}
