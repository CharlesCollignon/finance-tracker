import { useState } from "react";
import { ScrollView, Switch, View } from "react-native";

import type { TableMapping } from "@finance/core/statement";

import { ChoiceChips } from "@/components/pickers/ChoiceChips";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useT } from "@/providers/LocaleProvider";

/**
 * The rare file whose columns could not be told apart, on the phone: its
 * first rows, and which column is the date, the words, the amount (or the
 * debit and the credit) — asked once, then read as any other file.
 */
export function MappingCard({
  table,
  onRead,
}: {
  table: string[][];
  onRead: (mapping: TableMapping) => void;
}) {
  const t = useT();
  const width = Math.max(0, ...table.slice(0, 20).map((row) => row.length));
  const [mapping, setMapping] = useState<TableMapping>({
    header: true,
    date: 0,
    label: Math.min(1, width - 1),
    amount: Math.min(2, width - 1),
    debit: null,
    credit: null,
  });
  const split = mapping.amount === null;
  const options = Array.from({ length: width }, (_, index) => ({
    value: String(index),
    label:
      (mapping.header ? table[0]?.[index]?.trim() : "") ||
      t("statements.mapColumn", { n: index + 1 }),
  }));

  const pick = (label: string, value: number | null, onChange: (index: number) => void) => (
    <View className="gap-2">
      <Text className="text-sm font-medium">{label}</Text>
      <ChoiceChips
        label={label}
        options={options}
        value={String(value ?? 0)}
        onChange={(chosen) => onChange(Number(chosen))}
      />
    </View>
  );

  return (
    <View className="gap-4 rounded-card border border-border bg-card/70 p-card">
      <Text className="text-sm font-medium">{t("statements.columns")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="rounded-control border border-border">
        <View>
          {table.slice(0, 4).map((row, at) => (
            <View key={at} className={at === 0 && mapping.header ? "flex-row bg-muted" : "flex-row border-t border-border"}>
              {Array.from({ length: width }, (_, column) => (
                <Text key={column} numberOfLines={1} className="w-28 px-3 py-2 text-xs">
                  {row[column] ?? ""}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <View className="min-h-11 flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-sm">{t("statements.mapHeader")}</Text>
        <Switch
          accessibilityLabel={t("statements.mapHeader")}
          value={mapping.header}
          onValueChange={(header) => setMapping({ ...mapping, header })}
        />
      </View>
      {pick(t("statements.mapDate"), mapping.date, (date) => setMapping({ ...mapping, date }))}
      {pick(t("statements.mapLabel"), mapping.label, (label) => setMapping({ ...mapping, label }))}
      <View className="min-h-11 flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-sm">{t("statements.mapSplit")}</Text>
        <Switch
          accessibilityLabel={t("statements.mapSplit")}
          value={split}
          onValueChange={(next) =>
            setMapping(
              next
                ? { ...mapping, amount: null, debit: mapping.amount ?? 0, credit: Math.min((mapping.amount ?? 0) + 1, width - 1) }
                : { ...mapping, amount: mapping.debit ?? 0, debit: null, credit: null },
            )
          }
        />
      </View>
      {split ? (
        <>
          {pick(t("statements.mapDebit"), mapping.debit, (debit) => setMapping({ ...mapping, debit }))}
          {pick(t("statements.mapCredit"), mapping.credit, (credit) => setMapping({ ...mapping, credit }))}
        </>
      ) : (
        pick(t("statements.mapAmount"), mapping.amount, (amount) => setMapping({ ...mapping, amount }))
      )}
      <Button label={t("statements.mapApply")} onPress={() => onRead(mapping)} />
    </View>
  );
}
