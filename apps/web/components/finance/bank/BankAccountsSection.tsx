"use client";

import { useOptimistic, useTransition } from "react";
import { Plus, Warning } from "@phosphor-icons/react";
import { bankAttention } from "@finance/core/bank-attention";
import {
  awaitingRole,
  groupByBank,
  proposeForAccount,
} from "@finance/core/bank-accounts";
import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import type {
  BankAccount,
  SavingsAccountKind,
} from "@finance/core/types/database";
import { Button } from "@/components/ui/Button";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { useToast } from "@/components/layout/ToastProvider";
import {
  AccountRoleEditor,
  type AccountChoice,
} from "@/components/finance/bank/AccountRoleEditor";
import { fileBankAccounts } from "@/lib/actions/bank";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

/** Which Livret reads which bank account, from Placements. */
export interface LivretLink {
  kind: SavingsAccountKind;
  bankAccountId: string | null;
}

/**
 * The accounts the user has already said something about, bank by bank.
 *
 * Each bank says how long it still shares, since a consent is given bank by
 * bank; each account says what it is, and changing that is one tap, saved at
 * once — only what arrives next follows. The accounts no one has answered
 * for yet are the new-accounts card's, not this list's. The way to add a
 * bank sits at the bottom, where someone looking for a missing account ends
 * up.
 */
export function BankAccountsSection({
  accounts,
  livrets,
  onAddBank,
}: {
  accounts: BankAccount[];
  livrets: LivretLink[];
  onAddBank: (() => void) | null;
}) {
  const t = useT();
  const awaiting = new Set(
    awaitingRole(accounts).map((account) => account.provider_account_id),
  );
  const known = accounts.filter(
    (account) => !awaiting.has(account.provider_account_id),
  );
  if (known.length === 0) {
    return null;
  }

  return (
    <section
      className={cn(GLASS_CARD, "flex flex-col gap-4 rounded-card p-card")}
    >
      <div>
        <h2 className="text-base font-semibold">{t("bankAccounts.heading")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("bankAccounts.body")}
        </p>
      </div>

      {groupByBank(known).map((group) => (
        <div key={group.bank ?? ""} className="flex flex-col">
          <BankHeading
            bank={group.bank}
            consentValidUntil={group.consentValidUntil}
            followed={group.accounts.some(
              (account) =>
                account.role === "spending" || account.role === "savings",
            )}
          />
          <ul className="flex flex-col">
            {group.accounts.map((account) => (
              <KnownAccountRow
                key={account.provider_account_id}
                account={account}
                livret={
                  livrets.find(
                    (link) =>
                      link.bankAccountId === account.provider_account_id,
                  )?.kind ?? null
                }
              />
            ))}
          </ul>
        </div>
      ))}

      {onAddBank ? (
        <div>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={onAddBank}
          >
            <Plus size={ICON.sm} aria-hidden />
            {t("bankAccounts.addBank")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * A bank's name, and how long it still shares: the same window the renewal
 * reminder uses, so this line and the reminder never disagree. Only a bank
 * where an account is followed is asked to be renewed, as only those are
 * reminded of; for the others an ended consent is not worth a line.
 */
export function BankHeading({
  bank,
  consentValidUntil,
  followed,
}: {
  bank: string | null;
  consentValidUntil: string | null;
  /** Whether an account here is Courant or Épargne. */
  followed: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const attention = consentValidUntil
    ? bankAttention(
        { status: "active", consent_valid_until: consentValidUntil },
        todayIsoLocal(),
      )
    : null;
  const date = consentValidUntil
    ? formatShortDate(consentValidUntil.slice(0, 10), locale)
    : null;
  const renew = attention?.kind === "renew" ? attention : null;
  const ended = renew !== null && renew.daysLeft < 0;
  const warn = followed && renew !== null;

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border pb-2">
      <h3 className="text-sm font-semibold">
        {bank ?? t("bankAccounts.otherBank")}
      </h3>
      {date && (followed || !ended) ? (
        <p
          className={cn(
            "text-xs",
            warn ? "font-medium text-warning" : "text-muted-foreground",
          )}
        >
          {!warn
            ? t("bankAccounts.consentUntil", { date })
            : ended
              ? t("bankAccounts.consentEnded")
              : t("bankAccounts.consentSoon", { date })}
        </p>
      ) : null}
    </div>
  );
}

/** What the bank calls an account, and the product when it says more. */
export function AccountName({ account }: { account: BankAccount }) {
  const formatMoney = useFormatCurrency();
  const t = useT();
  const product =
    account.product &&
    account.product.trim().toLowerCase() !== account.label.trim().toLowerCase()
      ? account.product
      : null;
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{account.label}</p>
        {product ? (
          <p className="truncate text-xs text-muted-foreground">{product}</p>
        ) : null}
        {account.needs_reconnect ? (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <Warning size={ICON.xs} weight="fill" aria-hidden />
            {t("bearing.panel.cashAccountsLapsed")}
          </p>
        ) : null}
      </div>
      {account.reported_balance !== null && !account.needs_reconnect ? (
        <PrivateAmount className="shrink-0 text-sm tabular-nums">
          {formatMoney(Number(account.reported_balance))}
        </PrivateAmount>
      ) : null}
    </div>
  );
}

function KnownAccountRow({
  account,
  livret,
}: {
  account: BankAccount;
  /** The Livret that reads this account, if one does. */
  livret: SavingsAccountKind | null;
}) {
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  // An account no one answered for whose consent lapsed is shown here, as
  // what it is in effect: not followed.
  const saved: AccountChoice = {
    role: account.role ?? "ignored",
    savingsKind: livret,
  };
  const [choice, setChoice] = useOptimistic(saved);

  function change(next: AccountChoice) {
    // Becoming Épargne, it is the Livret its names say, unless one reads it.
    const savingsKind =
      next.role !== "savings"
        ? null
        : (next.savingsKind ?? proposeForAccount(account).savingsKind);
    startTransition(async () => {
      setChoice({ role: next.role, savingsKind });
      const result = await fileBankAccounts([
        {
          accountId: account.provider_account_id,
          role: next.role,
          savingsKind,
        },
      ]);
      if (result.error !== undefined) {
        toast(resolveMessage(t, result.error), "error");
      } else if (result.taken.length > 0) {
        toast(
          t("bankAccounts.livretTaken", {
            count: result.taken.length,
            names: result.taken.join(", "),
          }),
        );
      }
    });
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-2.5 border-b border-border py-3 last:border-0",
        pending && "opacity-70",
      )}
    >
      <AccountName account={account} />
      {/* Never answered for and unreadable: nothing to decide until it can
          be read again, when it is asked about with the new accounts. */}
      {account.role === null && account.needs_reconnect ? null : (
        <AccountRoleEditor
          account={account.label}
          value={choice}
          onChange={change}
          disabled={pending}
        />
      )}
    </li>
  );
}
