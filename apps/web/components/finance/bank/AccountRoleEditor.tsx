"use client";

import { useId } from "react";
import {
  SAVINGS_KINDS,
  SAVINGS_KIND_SHORT_KEYS,
} from "@finance/core/savings-accounts";
import type {
  BankAccountRole,
  SavingsAccountKind,
} from "@finance/core/types/database";
import { OptionPicker } from "@/components/ui/Picker";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useT } from "@/lib/locale-context";

export interface AccountChoice {
  role: BankAccountRole;
  /** As Épargne, the Livret it is; null while none is chosen. */
  savingsKind: SavingsAccountKind | null;
}

/**
 * What one bank account is — Courant, Épargne or Ne pas suivre — and, as
 * Épargne, which Livret on Placements it is.
 *
 * Shared by the question about new accounts and the list of known ones, so
 * an account is described the same way wherever it is answered for. The one
 * thing said under the choice is the thing a user could not guess: an
 * account Pluclair does not follow is still billed by open-banking.io.
 */
export function AccountRoleEditor({
  account,
  value,
  onChange,
  disabled = false,
}: {
  /** The account's name, for the choice's accessible name. */
  account: string;
  value: AccountChoice;
  onChange: (next: AccountChoice) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const pickerId = useId();

  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-2">
      <SegmentedControl<BankAccountRole>
        label={t("bankAccounts.roleGroup", { account })}
        className="w-full max-w-sm"
        value={value.role}
        onChange={(role) => onChange({ ...value, role })}
        segments={[
          { value: "spending", label: t("bankAccounts.roleSpending") },
          { value: "savings", label: t("bankAccounts.roleSavings") },
          { value: "ignored", label: t("bankAccounts.roleIgnored") },
        ]}
      />
      {value.role === "savings" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <label htmlFor={pickerId} className="text-xs text-muted-foreground">
            {t("bankAccounts.livretLabel")}
          </label>
          <OptionPicker
            id={pickerId}
            panelLabel={t("bankAccounts.livretPanel")}
            label={t("bankAccounts.livretLabel")}
            columns={2}
            className="w-44"
            value={value.savingsKind ?? undefined}
            onValueChange={(kind) =>
              onChange({ ...value, savingsKind: kind as SavingsAccountKind })
            }
            options={SAVINGS_KINDS.map((kind) => ({
              value: kind,
              label: t(SAVINGS_KIND_SHORT_KEYS[kind]),
            }))}
          />
        </div>
      ) : value.role === "ignored" ? (
        <p className="text-xs text-muted-foreground">
          {t("bankAccounts.ignoredBilled")}
        </p>
      ) : null}
    </fieldset>
  );
}
