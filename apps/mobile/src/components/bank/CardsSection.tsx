import { useState } from "react";
import { View } from "react-native";

import { DEFAULT_DEBIT_DAY } from "@finance/core/cards";
import { resolveMessage } from "@finance/core/i18n/t";
import type { CardRow } from "@finance/data/cards";
import { OptionPicker } from "@/components/pickers/OptionPicker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { answerCardDebit } from "@/lib/mutations";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";

/**
 * « Vos cartes », as on the web: each card seen in the lines brought, asked
 * once whether it is debited at once or later (`cards`, migration 087).
 */
export function CardsSection({
  cards,
  onAnswered,
}: {
  cards: CardRow[];
  onAnswered: () => void;
}) {
  const t = useT();
  if (cards.length === 0) {
    return null;
  }
  return (
    <Card className="gap-4">
      <View className="gap-1">
        <Text className="text-base font-semibold">{t("cards.heading")}</Text>
        <Text variant="muted" className="text-sm">
          {t("cards.body")}
        </Text>
      </View>
      {cards.map((card) => (
        <CardItem key={card.key} card={card} onAnswered={onAnswered} />
      ))}
    </Card>
  );
}

function CardItem({
  card,
  onAnswered,
}: {
  card: CardRow;
  onAnswered: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(card.debit === null);
  const [choosingDay, setChoosingDay] = useState(false);
  const [day, setDay] = useState(String(card.debitDay ?? DEFAULT_DEBIT_DAY));

  async function answer(debit: "immediate" | "deferred", debitDay?: number) {
    setPending(true);
    const result = await answerCardDebit({
      key: card.key,
      debit,
      ...(debitDay ? { debitDay } : {}),
    });
    setPending(false);
    if (result.error) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    void hapticLight();
    toast(resolveMessage(t, result.message ?? "actions.cardAnswered"), "success");
    setEditing(false);
    setChoosingDay(false);
    onAnswered();
  }

  const name = card.key.startsWith("acct:")
    ? (card.label ?? t("cards.deferred"))
    : t("cards.name", { last4: card.key });
  const status =
    card.debit === "immediate"
      ? t("cards.immediate")
      : card.debit === "deferred"
        ? (card.debitDay ?? DEFAULT_DEBIT_DAY) >= DEFAULT_DEBIT_DAY
          ? t("cards.deferredLast")
          : t("cards.deferredOn", { day: card.debitDay! })
        : t("cards.question");
  const dayOptions = [
    { value: String(DEFAULT_DEBIT_DAY), label: t("cards.lastDay") },
    ...Array.from({ length: 30 }, (_, index) => ({
      value: String(index + 1),
      label: t("cards.day", { day: index + 1 }),
    })),
  ];

  return (
    <View className="gap-3 border-t border-border pt-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-sm font-medium">
            {name}
          </Text>
          <Text variant="muted" className="text-xs">
            {status}
          </Text>
        </View>
        {!editing ? (
          <Button
            label={t("cards.change")}
            variant="ghost"
            size="sm"
            onPress={() => setEditing(true)}
          />
        ) : null}
      </View>
      {editing && !choosingDay ? (
        <View className="flex-row gap-2">
          <Button
            label={t("cards.immediate")}
            variant="outline"
            className="flex-1"
            disabled={pending}
            onPress={() => void answer("immediate")}
          />
          <Button
            label={t("cards.deferred")}
            variant="outline"
            className="flex-1"
            disabled={pending}
            onPress={() => setChoosingDay(true)}
          />
        </View>
      ) : null}
      {editing && choosingDay ? (
        <View className="gap-2">
          <OptionPicker
            label={t("cards.debitDay")}
            options={dayOptions}
            value={day}
            onChange={setDay}
            columns={3}
            searchable={false}
          />
          <Button
            label={t("cards.deferred")}
            disabled={pending}
            onPress={() => void answer("deferred", Number(day))}
          />
        </View>
      ) : null}
    </View>
  );
}
