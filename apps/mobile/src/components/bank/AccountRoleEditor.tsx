import { View } from "react-native";

import {
  SAVINGS_KINDS,
  SAVINGS_KIND_SHORT_KEYS,
} from "@finance/core/savings-accounts";
import type {
  BankAccountRole,
  SavingsAccountKind,
} from "@finance/core/types/database";

import { ChipRow } from "@/components/ui/ChipRow";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useT } from "@/providers/LocaleProvider";
import { useOwner } from "@/providers/OwnerProvider";

export interface AccountChoice {
  role: BankAccountRole;
  /** As Épargne, the Livret it is; null while none is chosen. */
  savingsKind: SavingsAccountKind | null;
}

/**
 * What one bank account is — Courant, Épargne or Ne pas suivre — and, as
 * Épargne, which Livret on Placements it is: the web's editor, with the
 * phone's own controls. Shared by the question about new accounts and the
 * list of known ones. The one thing said under the choice is the thing a
 * user could not guess: an account Pluclair does not follow is still billed
 * by open-banking.io.
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
  const { space } = useOwner();

  return (
    <View
      pointerEvents={disabled ? "none" : "auto"}
      className={cn("gap-2", disabled && "opacity-60")}
    >
      <SegmentedControl<BankAccountRole>
        label={t("bankAccounts.roleGroup", { account })}
        value={value.role}
        onChange={(role) => onChange({ ...value, role })}
        segments={[
          { value: "spending", label: t("bankAccounts.roleSpending") },
          // « Compte commun », for someone in a shared space (migration 061).
          ...(space || value.role === "joint"
            ? [{ value: "joint" as const, label: t("bankAccounts.roleJoint") }]
            : []),
          { value: "savings", label: t("bankAccounts.roleSavings") },
          { value: "ignored", label: t("bankAccounts.roleIgnored") },
        ]}
      />
      {value.role === "savings" ? (
        <View className="gap-1.5">
          <Text variant="muted" className="text-xs">
            {t("bankAccounts.livretLabel")}
          </Text>
          <ChipRow<SavingsAccountKind | "">
            label={t("bankAccounts.livretPanel")}
            value={value.savingsKind ?? ""}
            onChange={(kind) =>
              onChange({ ...value, savingsKind: kind === "" ? null : kind })
            }
            options={SAVINGS_KINDS.map((kind) => ({
              value: kind,
              label: t(SAVINGS_KIND_SHORT_KEYS[kind]),
            }))}
          />
        </View>
      ) : value.role === "ignored" ? (
        <Text variant="muted" className="text-xs">
          {t("bankAccounts.ignoredBilled")}
        </Text>
      ) : value.role === "joint" && space ? (
        <Text variant="muted" className="text-xs">
          {t("bankAccounts.jointHint", { space: space.name })}
        </Text>
      ) : null}
    </View>
  );
}
