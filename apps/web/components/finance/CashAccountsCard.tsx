"use client";

import { useTransition } from "react";
import { ArrowClockwise, Warning } from "@phosphor-icons/react";
import type { BankAccount } from "@finance/core/types/database";
import { setAccountCountsAsCash } from "@/lib/actions/bank";
import { useToast } from "@/components/layout/ToastProvider";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";

interface CashAccountsCardProps {
  accounts: BankAccount[];
}

/**
 * Which connected accounts hold money you spend.
 *
 * A connection is not one account. This one exposes five, four of them with
 * lapsed consents that return no transactions and a zero "expected" balance —
 * so an app that counted every account it could see would report a month in
 * which thousands of euros vanished, and then invent unrecorded spending to
 * explain the hole. Nothing is counted until it is ticked here, and a month
 * whose ticked accounts cannot all be read waits rather than guessing.
 *
 * Asked once, and only of people who have connected a bank at all.
 */
export function CashAccountsCard({ accounts }: CashAccountsCardProps) {
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const [pending, startTransition] = useTransition();

  if (accounts.length === 0) {
    return null;
  }

  const counted = accounts.filter((a) => a.counts_as_cash).length;

  function toggle(account: BankAccount) {
    startTransition(async () => {
      const result = await setAccountCountsAsCash(
        account.provider_account_id,
        !account.counts_as_cash,
      );
      if (result.error) {
        toast(result.error, "error");
      }
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Which accounts hold your cash</h2>
        <p className="text-sm text-muted-foreground">
          Closing a month compares what these held at the start and the end
          against what the ledger says happened. Tick the ones you spend from.
        </p>
      </div>

      <ul className="flex flex-col">
        {accounts.map((account) => {
          const unreadable = account.needs_reconnect;
          return (
            <li
              key={account.provider_account_id}
              className="border-b border-border last:border-0"
            >
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 py-3",
                  pending && "opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  checked={account.counts_as_cash}
                  disabled={pending}
                  onChange={() => toggle(account)}
                  className="size-4 shrink-0 accent-[var(--primary)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {account.label}
                  </span>
                  {unreadable ? (
                    <span className="flex items-center gap-1 text-xs text-destructive">
                      <Warning size={12} weight="fill" />
                      Consent has lapsed — nothing can be read from it
                    </span>
                  ) : account.reported_on ? (
                    <span className="block text-xs text-muted-foreground">
                      {`Last read ${account.reported_on}`}
                    </span>
                  ) : null}
                </span>
                {account.reported_balance !== null && !unreadable ? (
                  <PrivateAmount className="shrink-0 text-sm tabular-nums">
                    {formatMoney(Number(account.reported_balance))}
                  </PrivateAmount>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ArrowClockwise size={13} className="mt-0.5 shrink-0" />
        {counted === 0
          ? "Nothing is ticked, so months are still closed by hand."
          : "Months close on their own once the statement covers the day they are read on. A month whose ticked accounts cannot all be read waits instead of guessing."}
      </p>
    </section>
  );
}
