"use client";

import { useEffect, useMemo, useState } from "react";
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import { cn } from "@/lib/utils";
import { Button } from "@/components/retroui/Button";
import { Text } from "@/components/retroui/Text";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";
import type {
  ApplyRecurringPlan,
  RecurringOccurrenceUpdate,
} from "@finance/core/apply-recurring";

interface ApplyRecurringSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: ApplyRecurringPlan | null;
  pending: boolean;
  onConfirm: (includeUpdates: boolean, selectedKeys: string[]) => void;
}

function UpdateRow({
  item,
  selected,
  onToggle,
}: {
  item: RecurringOccurrenceUpdate;
  selected: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const amountChanged = Math.abs(item.previousAmount - item.amount) > 0.009;
  const noteChanged =
    (item.previousNote?.trim() ?? "") !== (item.note?.trim() ?? "");
  const categoryChanged = item.previousCategoryId !== item.categoryId;

  return (
    <li
      className={cn(
        "rounded-control border border-border p-3 text-sm",
        !selected && "opacity-50",
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={item.name}
          className="mt-0.5 size-4 shrink-0 accent-foreground"
        />
        <span className="min-w-0 flex-1">
          <p className="font-medium">{item.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.dateLabel}
          </p>
          {amountChanged && (
            <p className="privacy-sensitive mt-2 tabular-nums">
              {t("transaction.amount")}{" "}
              <span className="text-muted-foreground line-through">
                {formatEuro(item.previousAmount)}
              </span>
              {" → "}
              <span className="font-semibold">{formatEuro(item.amount)}</span>
            </p>
          )}
          {noteChanged && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("applyRecurring.noteUpdated")}
            </p>
          )}
          {categoryChanged && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("applyRecurring.movedToCategory")}
            </p>
          )}
        </span>
      </label>
    </li>
  );
}

export function ApplyRecurringSheet({
  open,
  onOpenChange,
  plan,
  pending,
  onConfirm,
}: ApplyRecurringSheetProps) {
  const t = useT();
  const formatEuro = useFormatCurrency();

  const allKeys = useMemo(
    () =>
      plan
        ? [...plan.toCreate, ...plan.toUpdate].map((item) =>
            recurringOccurrenceKey(item.templateId, item.occurredOn),
          )
        : [],
    [plan],
  );

  // Everything starts selected; deselecting is the exception.
  const [deselected, setDeselected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDeselected(new Set());
  }, [allKeys]);

  const isSelected = (key: string) => !deselected.has(key);
  const toggle = (key: string) =>
    setDeselected((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  const selectedKeys = allKeys.filter((key) => !deselected.has(key));

  if (!plan) {
    return null;
  }

  const hasCreates = plan.toCreate.length > 0;
  const hasUpdates = plan.toUpdate.length > 0;
  const includeUpdates = hasUpdates;

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("common.applyRecurring")}
    >
      <div className="flex flex-col gap-4">
        <Text className="text-sm text-muted-foreground">
          {t("applyRecurring.blurb")}
        </Text>

        {plan.toReprice.length > 0 && (
          <Text className="text-sm text-muted-foreground">
            {t("applyRecurring.repriceNote", {
              count: plan.toReprice.length,
            })}
          </Text>
        )}

        {hasUpdates && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              {t("applyRecurring.updateExisting", {
                count: plan.toUpdate.length,
              })}
            </p>
            <Text className="text-xs text-muted-foreground">
              {t("applyRecurring.updateExistingNote")}
            </Text>
            <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
              {plan.toUpdate.map((item) => {
                const key = recurringOccurrenceKey(
                  item.templateId,
                  item.occurredOn,
                );
                return (
                  <UpdateRow
                    key={item.transactionId}
                    item={item}
                    selected={isSelected(key)}
                    onToggle={() => toggle(key)}
                  />
                );
              })}
            </ul>
          </div>
        )}

        {hasCreates && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              {t("applyRecurring.addNew", { count: plan.toCreate.length })}
            </p>
            <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
              {plan.toCreate.map((item) => {
                const key = recurringOccurrenceKey(
                  item.templateId,
                  item.occurredOn,
                );
                const selected = isSelected(key);
                return (
                  <li
                    key={key}
                    className={cn(
                      "rounded-control border border-border px-3 py-2 text-sm",
                      !selected && "opacity-50",
                    )}
                  >
                    <label className="flex cursor-pointer items-center justify-between gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggle(key)}
                        aria-label={item.name}
                        className="size-4 shrink-0 accent-foreground"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.dateLabel}
                        </p>
                      </div>
                      <span className="privacy-amount shrink-0 tabular-nums font-semibold">
                        {formatEuro(item.amount)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={pending || selectedKeys.length === 0}
            onClick={() => onConfirm(includeUpdates, selectedKeys)}
          >
            {pending
              ? t("applyRecurring.applying")
              : selectedKeys.length === 0
                ? t("applyRecurring.nothingSelected")
                : hasUpdates
                  ? t("applyRecurring.applySelected", {
                      count: selectedKeys.length,
                    })
                  : t("applyRecurring.applyNew", {
                      count: selectedKeys.length,
                    })}
          </Button>
          {hasUpdates && hasCreates && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              disabled={pending}
              onClick={() => onConfirm(false, selectedKeys)}
            >
              {t("common.addNewOnly")}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </MobileSheet>
  );
}
