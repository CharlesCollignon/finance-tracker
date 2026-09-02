"use client";

import { useEffect, useMemo, useState } from "react";
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import { cn } from "@/lib/utils";
import { Button } from "@/components/retroui/Button";
import { Text } from "@/components/retroui/Text";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { useFormatCurrency } from "@/lib/use-currency";
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
  const formatEuro = useFormatCurrency();
  const amountChanged = Math.abs(item.previousAmount - item.amount) > 0.009;
  const noteChanged =
    (item.previousNote?.trim() ?? "") !== (item.note?.trim() ?? "");
  const categoryChanged = item.previousCategoryId !== item.categoryId;

  return (
    <li
      className={cn(
        "rounded border border-border p-3 text-sm",
        !selected && "opacity-50",
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={item.name}
          className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
        />
        <span className="min-w-0 flex-1">
          <p className="font-medium">{item.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.dateLabel}
          </p>
          {amountChanged && (
            <p className="mt-2 tabular-nums">
              Amount{" "}
              <span className="text-muted-foreground line-through">
                {formatEuro(item.previousAmount)}
              </span>
              {" → "}
              <span className="font-semibold">{formatEuro(item.amount)}</span>
            </p>
          )}
          {noteChanged && (
            <p className="mt-1 text-xs text-muted-foreground">
              Note updated to match recurring template
            </p>
          )}
          {categoryChanged && (
            <p className="mt-1 text-xs text-muted-foreground">
              Moved to the recurring template&rsquo;s category
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
      title="Apply recurring"
    >
      <div className="flex flex-col gap-4">
        <Text className="text-sm text-muted-foreground">
          Adds missing recurring transactions for this month. Existing entries
          are left as-is unless you confirm updates below.
        </Text>

        {plan.toReprice.length > 0 && (
          <Text className="text-sm text-muted-foreground">
            {plan.toReprice.length}{" "}
            {plan.toReprice.length === 1 ? "entry is" : "entries are"} priced
            from the market and still ahead of today. Those follow their
            instrument on their own — nothing to confirm.
          </Text>
        )}

        {hasUpdates && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              Update existing ({plan.toUpdate.length})
            </p>
            <Text className="text-xs text-muted-foreground">
              These were already applied but the recurring template changed
              (amount, note, or category).
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
              Add new ({plan.toCreate.length})
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
                      "rounded border border-border px-3 py-2 text-sm",
                      !selected && "opacity-50",
                    )}
                  >
                    <label className="flex cursor-pointer items-center justify-between gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggle(key)}
                        aria-label={item.name}
                        className="size-4 shrink-0 accent-[var(--primary)]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.dateLabel}
                        </p>
                      </div>
                      <span className="shrink-0 tabular-nums font-semibold">
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
              ? "Applying…"
              : selectedKeys.length === 0
                ? "Nothing selected"
                : hasUpdates
                  ? `Apply ${selectedKeys.length} selected`
                  : `Apply ${selectedKeys.length} new`}
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
              Add new only — skip updates
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
            Cancel
          </Button>
        </div>
      </div>
    </MobileSheet>
  );
}
