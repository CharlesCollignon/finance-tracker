"use client";

import { useState, useTransition } from "react";
import { Trash } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { useToast } from "@/components/layout/ToastProvider";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { formatEuro } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  applyRecurringForMonth,
  deleteTransaction,
} from "@/lib/actions/finance";
import type { Category, TransactionWithCategory } from "@/lib/types/database";

interface TransactionsViewProps {
  transactions: TransactionWithCategory[];
  categories: Category[];
  year: number;
  month: number;
  defaultDate: string;
}

export function TransactionsView({
  transactions,
  categories,
  year,
  month,
  defaultDate,
}: TransactionsViewProps) {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleApplyRecurring() {
    startTransition(async () => {
      const result = await applyRecurringForMonth(year, month);
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast(
          result.created
            ? `Added ${result.created} recurring entries`
            : "All recurring entries already applied",
          "success",
        );
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast("Transaction deleted", "success");
      }
    });
  }

  return (
    <>
      <PageHeader title="Transactions">
        <MonthPicker basePath="/transactions" />
        <div className="md:hidden">
          <SignOutButton />
        </div>
      </PageHeader>

      <PageContainer className="flex flex-col gap-4">
        {transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Add a manual entry or apply your recurring items for this month."
          />
        ) : (
          <ul
            className={cn(
              "flex flex-col gap-3",
              "lg:grid lg:grid-cols-2 lg:gap-4",
            )}
          >
            {transactions.map((tx) => (
              <li key={tx.id}>
                <Card className="flex w-full items-center gap-3 p-4 transition-colors hover:bg-accent/30 md:p-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{tx.categories.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {tx.occurred_on}
                      {tx.note ? ` · ${tx.note}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-base font-semibold md:text-lg">
                    {formatEuro(Number(tx.amount))}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(tx.id)}
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center",
                      "rounded border-2 border-border",
                      "hover:bg-destructive hover:text-destructive-foreground",
                    )}
                    aria-label="Delete transaction"
                  >
                    <Trash size={18} />
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <div
          className={cn(
            "flex flex-col gap-3 pt-2",
            "md:flex-row md:justify-end",
          )}
        >
          <Button
            variant="outline"
            size="lg"
            className="w-full md:w-auto md:min-w-[14rem]"
            onClick={handleApplyRecurring}
            disabled={pending}
          >
            {pending ? "Applying…" : "Apply recurring"}
          </Button>

          <Button
            size="lg"
            className="w-full md:w-auto md:min-w-[14rem]"
            onClick={() => setFormOpen(true)}
          >
            Add transaction
          </Button>
        </div>
      </PageContainer>

      <TransactionForm
        categories={categories}
        defaultDate={defaultDate}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </>
  );
}
