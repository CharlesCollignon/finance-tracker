"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { Text } from "@/components/retroui/Text";
import { useToast } from "@/components/layout/ToastProvider";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { CategorySelect } from "@/components/finance/CategorySelect";
import { createTransaction } from "@/lib/actions/finance";
import type { Category } from "@finance/core/types/database";

interface TransactionFormProps {
  categories: Category[];
  defaultDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionForm({
  categories,
  defaultDate,
  open,
  onOpenChange,
}: TransactionFormProps) {
  if (!open) {
    return null;
  }

  return (
    <TransactionFormFields
      key={defaultDate}
      categories={categories}
      defaultDate={defaultDate}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

interface TransactionFormFieldsProps {
  categories: Category[];
  defaultDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function TransactionFormFields({
  categories,
  defaultDate,
  open,
  onOpenChange,
}: TransactionFormFieldsProps) {
  const { toast } = useToast();
  const [state, action, pending] = useActionState(createTransaction, {});

  useEffect(() => {
    if (state.success) {
      toast("Transaction saved", "success");
      onOpenChange(false);
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state.success, state.error, onOpenChange, toast]);

  return (
    <MobileSheet open={open} onOpenChange={onOpenChange} title="Add transaction">
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="categoryId">Category</FormLabel>
          <CategorySelect
            id="categoryId"
            categories={categories}
            required
            defaultValue=""
          />
        </div>
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="amount">Amount (EUR)</FormLabel>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="text-base"
            placeholder="0.00"
          />
        </div>
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="occurredOn">Date</FormLabel>
          <Input
            id="occurredOn"
            name="occurredOn"
            type="date"
            required
            defaultValue={defaultDate}
            className="text-base"
          />
        </div>
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="note">Note (optional)</FormLabel>
          <Input
            id="note"
            name="note"
            type="text"
            className="text-base"
            placeholder="Description"
          />
        </div>
        {state.error && (
          <Text className="text-sm text-destructive">{state.error}</Text>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save transaction"}
        </Button>
      </form>
    </MobileSheet>
  );
}
