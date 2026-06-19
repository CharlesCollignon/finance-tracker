"use client";

import { Button } from "@/components/retroui/Button";
import { Text } from "@/components/retroui/Text";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { formatEuro } from "@/lib/constants";
import type {
  ApplyRecurringPlan,
  RecurringOccurrenceUpdate,
} from "@/lib/apply-recurring";

interface ApplyRecurringSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: ApplyRecurringPlan | null;
  pending: boolean;
  onConfirm: (includeUpdates: boolean) => void;
}

function UpdateRow({ item }: { item: RecurringOccurrenceUpdate }) {
  const amountChanged =
    Math.abs(item.previousAmount - item.amount) > 0.009;
  const noteChanged =
    (item.previousNote?.trim() ?? "") !== (item.note?.trim() ?? "");

  return (
    <li className="rounded border-2 border-border p-3 text-sm">
      <p className="font-medium">{item.name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{item.dateLabel}</p>
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
              {plan.toUpdate.map((item) => (
                <UpdateRow key={item.transactionId} item={item} />
              ))}
            </ul>
          </div>
        )}

        {hasCreates && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              Add new ({plan.toCreate.length})
            </p>
            <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
              {plan.toCreate.map((item) => (
                <li
                  key={`${item.templateId}:${item.occurredOn}`}
                  className="flex items-center justify-between gap-3 rounded border-2 border-border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.dateLabel}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums font-semibold">
                    {formatEuro(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={pending}
            onClick={() => onConfirm(includeUpdates)}
          >
            {pending
              ? "Applying…"
              : hasUpdates
                ? "Apply new & update changed"
                : "Apply new entries"}
          </Button>
          {hasUpdates && hasCreates && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              disabled={pending}
              onClick={() => onConfirm(false)}
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
