"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { Text } from "@/components/retroui/Text";
import { useToast } from "@/components/layout/ToastProvider";
import { MobileSheet } from "@/components/layout/MobileSheet";
import {
  deleteRecurringTemplate,
  upsertRecurringTemplate,
} from "@/lib/actions/finance";
import { DAY_OF_WEEK_LABELS } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import type {
  Category,
  Recurrence,
  RecurringTemplateWithCategory,
} from "@/lib/types/database";

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
  if (!open) {
    return null;
  }

  return (
    <RecurringFormFields
      key={template?.id ?? "new"}
      categories={categories}
      template={template}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

interface RecurringFormFieldsProps {
  categories: Category[];
  template?: RecurringTemplateWithCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RecurringFormFields({
  categories,
  template,
  open,
  onOpenChange,
}: RecurringFormFieldsProps) {
  const { toast } = useToast();
  const [state, action, pending] = useActionState(upsertRecurringTemplate, {});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  const [recurrence, setRecurrence] = useState<Recurrence>(
    template?.recurrence ?? "monthly",
  );
  const [categoryId, setCategoryId] = useState(template?.category_id ?? "");

  useEffect(() => {
    if (state.success) {
      toast(template ? "Recurring item updated" : "Recurring item added", "success");
      onOpenChange(false);
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state.success, state.error, template, onOpenChange, toast]);

  function handleDelete() {
    if (!template) {
      return;
    }

    startDeleteTransition(async () => {
      const result = await deleteRecurringTemplate(template.id);
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast("Recurring item deleted", "success");
        onOpenChange(false);
      }
    });
  }

  const allocCategories = categories.filter((c) => c.type !== "income");
  const selectedCategory = allocCategories.find((cat) => cat.id === categoryId);
  const isDeploymentCategory =
    selectedCategory?.type === "investment" &&
    selectedCategory.counts_toward_summary === false;

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={template ? "Edit recurring" : "Add recurring"}
    >
      <form action={action} className="flex flex-col gap-4">
        {template && <input type="hidden" name="id" value={template.id} />}
        <input type="hidden" name="recurrence" value={recurrence} />
        <input
          type="hidden"
          name="active"
          value={template?.active === false ? "false" : "true"}
        />
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="recurring-category">Category</FormLabel>
          <select
            id="recurring-category"
            name="categoryId"
            required
            className="h-11 w-full rounded border-2 border-border bg-background px-3 text-base text-foreground shadow-md"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="" disabled>
              Select category
            </option>
            {allocCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.type})
                {cat.type === "investment" && !cat.counts_toward_summary
                  ? " · tracking"
                  : ""}
              </option>
            ))}
          </select>
          {isDeploymentCategory && (
            <Text className="text-xs text-muted-foreground">
              Broker DCA entries are tracked for visibility but do not reduce
              your remaining budget.
            </Text>
          )}
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
          <span className="text-sm font-medium">Schedule</span>
          <div className="grid grid-cols-2 gap-2">
            {(["monthly", "weekly"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRecurrence(value)}
                className={cn(
                  "rounded border-2 px-3 py-2 text-sm font-medium capitalize",
                  recurrence === value
                    ? "border-foreground bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        {recurrence === "monthly" ? (
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
        ) : (
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="dayOfWeek">Day of week</FormLabel>
            <select
              id="dayOfWeek"
              name="dayOfWeek"
              required
              className="h-11 w-full rounded border-2 border-border bg-background px-3 text-base text-foreground shadow-md"
              defaultValue={template?.day_of_week ?? 1}
            >
              {Object.entries(DAY_OF_WEEK_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}
        {state.error && (
          <Text className="text-sm text-destructive">{state.error}</Text>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>

        {template && (
          <div className="border-t-2 border-border pt-4">
            {confirmDelete ? (
              <div className="flex flex-col gap-2">
                <Text className="text-sm text-muted-foreground">
                  Delete this recurring item? Past transactions stay in your
                  ledger.
                </Text>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="flex-1 border-destructive text-destructive"
                    onClick={handleDelete}
                    disabled={deletePending}
                  >
                    {deletePending ? "Deleting…" : "Confirm delete"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="flex-1"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deletePending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full border-destructive text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Delete recurring item
              </Button>
            )}
          </div>
        )}
      </form>
    </MobileSheet>
  );
}
