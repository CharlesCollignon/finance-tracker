"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { Text } from "@/components/retroui/Text";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { upsertRecurringTemplate } from "@/lib/actions/finance";
import type { Category, RecurringTemplateWithCategory } from "@/lib/types/database";

interface RecurringFormProps {
  categories: Category[];
  template?: RecurringTemplateWithCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecurringForm({
  categories,
  template,
  open,
  onOpenChange,
}: RecurringFormProps) {
  const [state, action, pending] = useActionState(upsertRecurringTemplate, {});

  useEffect(() => {
    if (state.success) {
      onOpenChange(false);
    }
  }, [state.success, onOpenChange]);

  const allocCategories = categories.filter((c) => c.type !== "income");

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={template ? "Edit recurring" : "Add recurring"}
    >
      <form action={action} className="flex flex-col gap-4">
        {template && <input type="hidden" name="id" value={template.id} />}
        <input type="hidden" name="active" value="true" />
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="recurring-category">Category</FormLabel>
          <select
            id="recurring-category"
            name="categoryId"
            required
            className="h-11 w-full rounded border-2 border-border px-3 text-base shadow-md"
            defaultValue={template?.category_id ?? ""}
          >
            <option value="" disabled>
              Select category
            </option>
            {allocCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.type})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="recurring-amount">Amount (EUR)</FormLabel>
          <Input
            id="recurring-amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="text-base"
            defaultValue={template?.amount ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="dayOfMonth">Day of month</FormLabel>
          <Input
            id="dayOfMonth"
            name="dayOfMonth"
            type="number"
            min="1"
            max="31"
            required
            className="text-base"
            defaultValue={template?.day_of_month ?? 1}
          />
        </div>
        {state.error && (
          <Text className="text-sm text-destructive">{state.error}</Text>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </MobileSheet>
  );
}
