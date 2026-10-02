"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { ArrowLeft, CaretRight } from "@phosphor-icons/react";
import { parseTypedAmount } from "@finance/core/amount-input";
import { ENVELOPE_NAME_KEYS } from "@finance/core/future-plan";
import type { InvestmentWalletId } from "@finance/core/investments";
import {
  FRENCH_SAVINGS_2026,
  SAVINGS_KIND_RATE_KEYS,
} from "@finance/core/savings-accounts";
import type { SavingsAccountKind } from "@finance/core/types/database";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { useToast } from "@/components/layout/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { addSavingsAccount, addWallet } from "@/lib/actions/accounts";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import type { LinkableBankAccount } from "@/lib/queries/savings-accounts";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import {
  accountShortName,
  rateToInput,
  type AccountId,
} from "./account-format";

interface AddAccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The savings kinds not added yet. */
  savingsKinds: SavingsAccountKind[];
  /** The wallets not kept yet. */
  wallets: InvestmentWalletId[];
  /** False until migration 046 has run. */
  savingsAvailable: boolean;
  linkable: LinkableBankAccount[];
  onAdded: (id: AccountId) => void;
}

/**
 * Adding an account: pick it, and for a savings account say what is in it.
 *
 * A wallet needs nothing more — what is in it are its holdings, added from
 * its own panel — so it is added on the press. A savings account asks one
 * question, its balance today, or reads it from the bank when the user's
 * bank reports an account that could be it; a PEL or a bank's own livret
 * also asks its rate, the one thing about it the law does not fix.
 */
export function AddAccountSheet({
  open,
  onOpenChange,
  savingsKinds,
  wallets,
  savingsAvailable,
  linkable,
  onAdded,
}: AddAccountSheetProps) {
  if (!open) {
    return null;
  }
  return (
    <AddAccountForm
      onOpenChange={onOpenChange}
      savingsKinds={savingsKinds}
      wallets={wallets}
      savingsAvailable={savingsAvailable}
      linkable={linkable}
      onAdded={onAdded}
    />
  );
}

function AddAccountForm({
  onOpenChange,
  savingsKinds,
  wallets,
  savingsAvailable,
  linkable,
  onAdded,
}: Omit<AddAccountSheetProps, "open">) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const [picked, setPicked] = useState<SavingsAccountKind | null>(null);
  const [pending, startTransition] = useTransition();

  function addWalletNow(wallet: InvestmentWalletId) {
    startTransition(async () => {
      const result = await addWallet(wallet);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(result.message ?? t("accounts.saved"), "success");
      onAdded(wallet);
      onOpenChange(false);
    });
  }

  const title = picked
    ? accountShortName(picked, locale)
    : t("accounts.addTitle");

  return (
    <MobileSheet open onOpenChange={onOpenChange} title={title}>
      {picked ? (
        <SavingsDetails
          kind={picked}
          linkable={linkable}
          onBack={() => setPicked(null)}
          onAdded={() => {
            onAdded(picked);
            onOpenChange(false);
          }}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {savingsKinds.length === 0 && wallets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("accounts.allAdded")}
            </p>
          ) : null}

          {savingsKinds.length > 0 ? (
            <KindGroup title={t("accounts.savingsGroup")}>
              {savingsAvailable ? (
                savingsKinds.map((kind) => (
                  <KindButton
                    key={kind}
                    id={kind}
                    disabled={pending}
                    onClick={() => setPicked(kind)}
                    chevron
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("placementsWeb.setupNeeded")}
                </p>
              )}
            </KindGroup>
          ) : null}

          {wallets.length > 0 ? (
            <KindGroup title={t("accounts.investGroup")}>
              {wallets.map((wallet) => (
                <KindButton
                  key={wallet}
                  id={wallet}
                  disabled={pending}
                  onClick={() => addWalletNow(wallet)}
                />
              ))}
            </KindGroup>
          ) : null}
        </div>
      )}
    </MobileSheet>
  );
}

function KindGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="text-xs font-medium text-muted-foreground">
        {title}
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function KindButton({
  id,
  disabled,
  onClick,
  chevron = false,
}: {
  id: AccountId;
  disabled: boolean;
  onClick: () => void;
  chevron?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-14 items-center justify-between gap-3 rounded-control border border-border px-3 py-2.5 text-left",
        "transition-colors duration-hover hover:bg-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">
          {accountShortName(id, locale)}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {t(ENVELOPE_NAME_KEYS[id])}
        </span>
      </span>
      {chevron ? (
        <CaretRight
          size={ICON.sm}
          aria-hidden
          className="shrink-0 text-muted-foreground"
        />
      ) : null}
    </button>
  );
}

/** The second step for a savings account: its balance, and its rate. */
function SavingsDetails({
  kind,
  linkable,
  onBack,
  onAdded,
}: {
  kind: SavingsAccountKind;
  linkable: LinkableBankAccount[];
  onBack: () => void;
  onAdded: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { toast } = useToast();
  const balanceId = useId();
  const rateId = useId();
  const [fromBank, setFromBank] = useState(linkable.length > 0);
  const [bankAccountId, setBankAccountId] = useState<string | null>(
    linkable[0]?.id ?? null,
  );
  const [balance, setBalance] = useState("");
  const ownRate = kind === "pel" || kind === "livret";
  const [rate, setRate] = useState(
    rateToInput(FRENCH_SAVINGS_2026[kind].rate, locale),
  );
  const [pending, startTransition] = useTransition();

  const parsedBalance = balance.trim() === "" ? 0 : parseTypedAmount(balance);
  const parsedRate = parseTypedAmount(rate);
  const valid =
    (fromBank ? bankAccountId !== null : parsedBalance !== null) &&
    (!ownRate || (parsedRate !== null && parsedRate >= 0 && parsedRate <= 20));

  function submit() {
    if (!valid) {
      return;
    }
    startTransition(async () => {
      const result = await addSavingsAccount({
        kind,
        balance: fromBank ? undefined : Math.max(0, parsedBalance ?? 0),
        rate: ownRate && parsedRate !== null ? parsedRate / 100 : null,
        bankAccountId: fromBank ? bankAccountId : null,
      });
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(result.message ?? t("accounts.saved"), "success");
      onAdded();
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="-mt-1 text-sm text-muted-foreground">
        {t(ENVELOPE_NAME_KEYS[kind])}
      </p>

      {linkable.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{t("accounts.addBalance")}</legend>
          <Choice
            checked={fromBank}
            onChange={() => setFromBank(true)}
            label={t("accounts.addFromBank")}
          />
          <Choice
            checked={!fromBank}
            onChange={() => setFromBank(false)}
            label={t("accounts.addTypeIt")}
          />
        </fieldset>
      ) : null}

      {fromBank ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">
            {t("placementsWeb.bankPick")}
          </legend>
          {linkable.map((account) => (
            <Choice
              key={account.id}
              checked={bankAccountId === account.id}
              onChange={() => setBankAccountId(account.id)}
              label={account.label}
              hint={
                account.balance === null
                  ? t("placementsWeb.noReportedBalance")
                  : format(account.balance)
              }
              sensitiveHint={account.balance !== null}
            />
          ))}
        </fieldset>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={balanceId} className="text-sm font-medium">
            {t("accounts.addBalance")}
          </label>
          <div className="relative">
            <Input
              id={balanceId}
              inputMode="decimal"
              autoComplete="off"
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              placeholder="0"
              aria-invalid={parsedBalance === null ? true : undefined}
              className="privacy-sensitive pr-8 text-base tabular-nums"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
            >
              €
            </span>
          </div>
        </div>
      )}

      {ownRate ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={rateId} className="text-sm font-medium">
            {t("accounts.addRate")}
          </label>
          <div className="relative w-32">
            <Input
              id={rateId}
              inputMode="decimal"
              autoComplete="off"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              aria-invalid={parsedRate === null ? true : undefined}
              aria-describedby={`${rateId}-hint`}
              className="pr-8 text-base tabular-nums"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
            >
              %
            </span>
          </div>
          <p id={`${rateId}-hint`} className="text-xs text-muted-foreground">
            {t(SAVINGS_KIND_RATE_KEYS[kind])}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={ICON.sm} aria-hidden className="mr-1" />
          {t("placementsWeb.back")}
        </Button>
        <Button type="submit" disabled={!valid || pending}>
          {t("accounts.addConfirm")}
        </Button>
      </div>
    </form>
  );
}

function Choice({
  checked,
  onChange,
  label,
  hint,
  sensitiveHint = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  sensitiveHint?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-control border px-3 py-2",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        checked
          ? "border-foreground bg-secondary"
          : "border-border hover:bg-muted",
      )}
    >
      <span className="flex items-center gap-2.5">
        <input
          type="radio"
          checked={checked}
          onChange={onChange}
          className="sr-only"
        />
        <span
          aria-hidden
          className={cn(
            "size-4 shrink-0 rounded-full border",
            checked ? "border-[5px] border-foreground" : "border-border",
          )}
        />
        <span className="text-sm">{label}</span>
      </span>
      {hint ? (
        <span
          className={cn(
            "text-sm tabular-nums text-muted-foreground",
            sensitiveHint && "privacy-amount",
          )}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}
