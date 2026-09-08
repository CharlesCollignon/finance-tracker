"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { Text } from "@/components/retroui/Text";
import { useToast } from "@/components/layout/ToastProvider";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { CategorySelect } from "@/components/finance/CategorySelect";
import {
  createTransaction,
  deleteTransaction,
  saveQuickTransaction,
  skipRecurringOccurrence,
  updateTransaction,
} from "@/lib/actions/finance";
import { todayIsoLocal } from "@finance/core/constants";
import type { Category, Tag, Transaction } from "@finance/core/types/database";
import { useT } from "@/lib/locale-context";
import { resolveMessage } from "@finance/core/i18n/t";

interface TransactionFormProps {
  categories: Category[];
  tags?: Tag[];
  selectedTagIds?: string[];
  defaultDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the form edits this transaction instead of creating one. */
  transaction?: Transaction | null;
  onDeleted?: () => void;
}

export function TransactionForm({
  categories,
  tags = [],
  selectedTagIds = [],
  defaultDate,
  open,
  onOpenChange,
  transaction = null,
  onDeleted,
}: TransactionFormProps) {
  if (!open) {
    return null;
  }

  return (
    <TransactionFormFields
      key={transaction?.id ?? defaultDate}
      categories={categories}
      tags={tags}
      selectedTagIds={selectedTagIds}
      defaultDate={defaultDate}
      open={open}
      onOpenChange={onOpenChange}
      transaction={transaction}
      onDeleted={onDeleted}
    />
  );
}

interface TransactionFormFieldsProps {
  categories: Category[];
  tags: Tag[];
  selectedTagIds: string[];
  defaultDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onDeleted?: () => void;
}

function TransactionFormFields({
  categories,
  tags,
  selectedTagIds,
  defaultDate,
  open,
  onOpenChange,
  transaction,
  onDeleted,
}: TransactionFormFieldsProps) {
  const { toast } = useToast();
  const t = useT();
  const isEditing = transaction !== null;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const [skipPending, startSkip] = useTransition();
  const [duplicatePending, startDuplicate] = useTransition();
  const [state, action, pending] = useActionState(
    isEditing ? updateTransaction : createTransaction,
    {},
  );
  const canSkip =
    isEditing &&
    transaction.recurring_template_id !== null &&
    transaction.recurring_template_id !== undefined;

  useEffect(() => {
    if (state.success) {
      toast(t("transaction.saved"), "success");
      onOpenChange(false);
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state.success, state.error, onOpenChange, toast, t]);

  /**
   * Repeating an entry is the most common thing anyone does with a ledger —
   * the same shop, a week later. Mobile has had this since the start; the
   * desktop client was the slower one for the same task.
   */
  function handleDuplicate() {
    if (!transaction) {
      return;
    }

    startDuplicate(async () => {
      const result = await saveQuickTransaction({
        categoryId: transaction.category_id,
        amount: Number(transaction.amount),
        // Today, not the original date: a copy is a new occurrence.
        occurredOn: todayIsoLocal(),
        note: transaction.note ?? undefined,
        tagIds: selectedTagIds,
      });

      if (result.error) {
        toast(result.error, "error");
        return;
      }

      toast(t("transaction.duplicated"), "success");
      onOpenChange(false);
    });
  }

  function handleDelete() {
    if (!transaction) {
      return;
    }

    startDelete(async () => {
      const result = await deleteTransaction(transaction.id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(t("transaction.deleted"), "success");
      onOpenChange(false);
      onDeleted?.();
    });
  }

  function handleSkip() {
    if (!transaction?.recurring_template_id) {
      return;
    }

    startSkip(async () => {
      const result = await skipRecurringOccurrence(
        transaction.recurring_template_id!,
        transaction.occurred_on,
        transaction.id,
      );
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(t("transaction.skipped"), "success");
      onOpenChange(false);
      onDeleted?.();
    });
  }

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t("transaction.editTitle") : t("transaction.addTitle")}
    >
      <form action={action} className="flex flex-col gap-4">
        {isEditing && <input type="hidden" name="id" value={transaction.id} />}
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="categoryId">
            {t("transaction.category")}
          </FormLabel>
          <CategorySelect
            id="categoryId"
            categories={categories}
            required
            defaultValue={transaction?.category_id ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="amount">{t("transaction.amount")}</FormLabel>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="text-base"
            placeholder="0.00"
            defaultValue={
              transaction ? String(Number(transaction.amount)) : undefined
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="occurredOn">Date</FormLabel>
          <Input
            id="occurredOn"
            name="occurredOn"
            type="date"
            required
            defaultValue={transaction?.occurred_on ?? defaultDate}
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
            placeholder={t("transaction.notePlaceholder")}
            defaultValue={transaction?.note ?? undefined}
          />
        </div>
        {tags.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">
              {t("transaction.tags")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  className="inline-flex items-center gap-2 border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="tagIds"
                    value={tag.id}
                    defaultChecked={selectedTagIds.includes(tag.id)}
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {state.error && (
          <Text className="text-sm text-destructive">
            {resolveMessage(t, state.error)}
          </Text>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={pending || deletePending || skipPending}
        >
          {pending ? t("transaction.saving") : t("transaction.saveTransaction")}
        </Button>
      </form>

      {isEditing && (
        <div className="mt-6 space-y-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={duplicatePending}
            onClick={handleDuplicate}
          >
            {duplicatePending
              ? t("transaction.duplicating")
              : t("transaction.duplicateToToday")}
          </Button>

          {canSkip && (
            <div>
              {confirmSkip ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">
                    {t("transaction.skipExplanation")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={skipPending}
                      onClick={handleSkip}
                    >
                      {skipPending
                        ? t("transaction.skipping")
                        : t("transaction.confirmSkip")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={skipPending}
                      onClick={() => setConfirmSkip(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setConfirmDelete(false);
                    setConfirmSkip(true);
                  }}
                >
                  {t("transaction.skipThisDate")}
                </Button>
              )}
            </div>
          )}

          {confirmDelete ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Delete this transaction permanently? (Apply may recreate it if
                the recurring rule is still active.)
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-destructive text-destructive"
                  disabled={deletePending}
                  onClick={handleDelete}
                >
                  {deletePending
                    ? t("transaction.deleting")
                    : t("transaction.confirmDelete")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={deletePending}
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full border-destructive text-destructive"
              onClick={() => {
                setConfirmSkip(false);
                setConfirmDelete(true);
              }}
            >
              {t("transaction.deleteTransaction")}
            </Button>
          )}
        </div>
      )}
    </MobileSheet>
  );
}
