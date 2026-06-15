"use client";

import { useState, useTransition } from "react";
import { Trash } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { formatEuro } from "@/lib/constants";
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
  const [formOpen, setFormOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  function handleApplyRecurring() {
    startTransition(async () => {
      const result = await applyRecurringForMonth(year, month);
      if (result.error) {
        setApplyMessage(result.error);
      } else {
        setApplyMessage(
          result.created
            ? `Added ${result.created} recurring entries`
            : "All recurring entries already applied",
        );
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTransaction(id);
    });
  }

  return (
    <>
      <PageHeader title="Transactions">
        <div className="flex items-center gap-2">
          <MonthPicker basePath="/transactions" />
          <SignOutButton />
        </div>
      </PageHeader>

      <div className="flex flex-col gap-4 p-4">
        {transactions.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No transactions this month. Add one or apply recurring entries.
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {transactions.map((tx) => (
              <li key={tx.id}>
                <Card className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{tx.categories.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {tx.occurred_on}
                      {tx.note ? ` · ${tx.note}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums font-semibold">
                    {formatEuro(Number(tx.amount))}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(tx.id)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded border-2 border-border hover:bg-destructive hover:text-destructive-foreground"
                    aria-label="Delete transaction"
                  >
                    <Trash size={18} />
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {applyMessage && (
          <p className="text-center text-sm text-muted-foreground">
            {applyMessage}
          </p>
        )}

        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={handleApplyRecurring}
          disabled={pending}
        >
          {pending ? "Applying…" : "Apply recurring for this month"}
        </Button>

        <Button
          size="lg"
          className="w-full"
          onClick={() => setFormOpen(true)}
        >
          Add transaction
        </Button>
      </div>

      <TransactionForm
        categories={categories}
        defaultDate={defaultDate}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </>
  );
}
