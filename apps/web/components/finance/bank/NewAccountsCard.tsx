"use client";

import { useState, useTransition } from "react";
import { groupByBank, proposeForAccount } from "@finance/core/bank-accounts";
import { resolveMessage } from "@finance/core/i18n/t";
import type { BankAccount } from "@finance/core/types/database";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/layout/ToastProvider";
import {
  AccountRoleEditor,
  type AccountChoice,
} from "@/components/finance/bank/AccountRoleEditor";
import {
  AccountName,
  BankHeading,
} from "@/components/finance/bank/BankAccountsSection";
import { fileBankAccounts } from "@/lib/actions/bank";
import { GLASS_CARD } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";

/**
 * The accounts nobody has said anything about yet — every account of a first
 * connection, or those of a bank added since — asked about together.
 *
 * Nothing comes in from an account before its role is said, so this is the
 * one step between a connection and a ledger that fills itself. It is made a
 * single tap: each account arrives with the likeliest answer already chosen,
 * from what its bank says it is, and « C'est bon » files them all — making
 * the Livrets on Placements that do not exist yet — after which the page
 * brings in the new current accounts' history on its own.
 */
export function NewAccountsCard({ accounts }: { accounts: BankAccount[] }) {
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  // Only what the user changed; every other account shows its proposal, so
  // an account that turns up while the card is open is pre-filled too.
  const [changed, setChanged] = useState<Record<string, AccountChoice>>({});

  const choiceFor = (account: BankAccount): AccountChoice =>
    changed[account.provider_account_id] ?? proposeForAccount(account);

  function confirm() {
    startTransition(async () => {
      const result = await fileBankAccounts(
        accounts.map((account) => {
          const choice = choiceFor(account);
          return {
            accountId: account.provider_account_id,
            role: choice.role,
            savingsKind: choice.role === "savings" ? choice.savingsKind : null,
          };
        }),
      );
      if (result.error !== undefined) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      toast(
        result.taken.length > 0
          ? t("bankAccounts.livretTaken", {
              count: result.taken.length,
              names: result.taken.join(", "),
            })
          : t("bankAccounts.confirmed"),
        result.taken.length > 0 ? "default" : "success",
      );
    });
  }

  return (
    <section
      className={cn(
        GLASS_CARD,
        "flex flex-col gap-4 rounded-card border-primary/40 p-card",
      )}
    >
      <div>
        <h2 className="text-base font-semibold">
          {t("bankAccounts.newTitle", { count: accounts.length })}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("bankAccounts.newBody")}
        </p>
      </div>

      {groupByBank(accounts).map((group) => (
        <div key={group.bank ?? ""} className="flex flex-col">
          <BankHeading
            bank={group.bank}
            consentValidUntil={group.consentValidUntil}
            followed={false}
          />
          <ul className="flex flex-col">
            {group.accounts.map((account) => (
              <li
                key={account.provider_account_id}
                className="flex flex-col gap-2.5 border-b border-border py-3 last:border-0"
              >
                <AccountName account={account} />
                <AccountRoleEditor
                  account={account.label}
                  value={choiceFor(account)}
                  disabled={pending}
                  onChange={(next) =>
                    setChanged((current) => ({
                      ...current,
                      [account.provider_account_id]: next,
                    }))
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div>
        <Button
          type="button"
          size="lg"
          disabled={pending}
          aria-busy={pending}
          onClick={confirm}
        >
          {t("bankAccounts.confirm")}
        </Button>
      </div>
    </section>
  );
}
