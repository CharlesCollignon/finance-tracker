"use client";

import { useState, useTransition } from "react";
import { DEFAULT_DEBIT_DAY } from "@finance/core/cards";
import { resolveMessage } from "@finance/core/i18n/t";
import type { CardRow } from "@finance/data/cards";
import { Button } from "@/components/ui/Button";
import { OptionPicker } from "@/components/ui/Picker";
import { useToast } from "@/components/layout/ToastProvider";
import { answerCardAction } from "@/lib/actions/bank";
import { GLASS_CARD } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";

/**
 * « Vos cartes »: each card Pluclair has seen in the lines brought, asked
 * once whether it is debited at once or later (`cards`, migration 087).
 * A deferred one's payments then leave the account on its debit day. Where
 * Le point's « Répondre » leads (`/bank#cards`).
 */
export function CardsSection({ cards }: { cards: CardRow[] }) {
  const t = useT();
  if (cards.length === 0) {
    return null;
  }
  return (
    <section
      id="cards"
      className={cn(
        GLASS_CARD,
        "mt-4 flex scroll-mt-24 flex-col gap-4 rounded-card p-card md:mt-5",
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t("cards.heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("cards.body")}</p>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {cards.map((card) => (
          <CardItem key={card.key} card={card} />
        ))}
      </ul>
    </section>
  );
}

function cardName(card: CardRow, t: ReturnType<typeof useT>): string {
  if (card.key.startsWith("acct:")) {
    return card.label ?? t("cards.deferred");
  }
  return t("cards.name", { last4: card.key });
}

function CardItem({ card }: { card: CardRow }) {
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(card.debit === null);
  const [choosingDay, setChoosingDay] = useState(false);
  const [day, setDay] = useState(String(card.debitDay ?? DEFAULT_DEBIT_DAY));

  function answer(debit: "immediate" | "deferred", debitDay?: number) {
    startTransition(async () => {
      const result = await answerCardAction({
        key: card.key,
        debit,
        ...(debitDay ? { debitDay } : {}),
      });
      if (result.error) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      toast(
        resolveMessage(t, result.message ?? "actions.cardAnswered"),
        "success",
      );
      setEditing(false);
      setChoosingDay(false);
    });
  }

  const dayOptions = [
    { value: String(DEFAULT_DEBIT_DAY), label: t("cards.lastDay") },
    ...Array.from({ length: 30 }, (_, index) => ({
      value: String(index + 1),
      label: t("cards.day", { day: index + 1 }),
    })),
  ];

  const status =
    card.debit === "immediate"
      ? t("cards.immediate")
      : card.debit === "deferred"
        ? (card.debitDay ?? DEFAULT_DEBIT_DAY) >= DEFAULT_DEBIT_DAY
          ? t("cards.deferredLast")
          : t("cards.deferredOn", { day: card.debitDay! })
        : t("cards.question");

  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{cardName(card, t)}</p>
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>
        {!editing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
          >
            {t("cards.change")}
          </Button>
        ) : null}
      </div>
      {editing && !choosingDay ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => answer("immediate")}
          >
            {t("cards.immediate")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setChoosingDay(true)}
          >
            {t("cards.deferred")}
          </Button>
        </div>
      ) : null}
      {editing && choosingDay ? (
        <div className="flex flex-col gap-2">
          <OptionPicker
            id={`card-day-${card.key}`}
            panelLabel={t("cards.debitDay")}
            label={t("cards.debitDay")}
            options={dayOptions}
            value={day}
            onValueChange={setDay}
            columns={3}
            searchable={false}
          />
          <Button
            type="button"
            disabled={pending}
            onClick={() => answer("deferred", Number(day))}
          >
            {t("cards.deferred")}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
