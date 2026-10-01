"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { Bank, PencilSimple } from "@phosphor-icons/react";
import { parseTypedAmount } from "@finance/core/amount-input";
import { formatShortDate } from "@finance/core/constants";
import { ENVELOPE_NAME_KEYS } from "@finance/core/future-plan";
import { INTL_LOCALES } from "@finance/core/i18n/locale";
import {
  FRENCH_SAVINGS_2026,
  SAVINGS_KIND_RATE_KEYS,
  SAVINGS_KIND_TAX_KEYS,
  yearlyInterest,
} from "@finance/core/savings-accounts";
import { useToast } from "@/components/layout/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  linkSavingsBank,
  removeSavingsAccount,
  updateSavingsBalance,
  updateSavingsRate,
} from "@/lib/actions/accounts";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import type {
  LinkableBankAccount,
  SavingsAccountView,
} from "@/lib/queries/savings-accounts";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { accountShortName, formatRate, rateToInput } from "./account-format";
import { RemoveAccount } from "./RemoveAccount";

/**
 * One savings account: what it holds, what it earns, how full it is, and
 * what goes into it each month — and the few things about it that are the
 * user's to change.
 *
 * Its holdings are not positions: a livret holds euros at one rate, so the
 * panel is a balance and four plain facts rather than the wallet's list.
 */
export function SavingsAccountPanel({
  account,
  monthly,
  linkable,
}: {
  account: SavingsAccountView;
  /** What the recurring entries put into it in a month. */
  monthly: number;
  linkable: LinkableBankAccount[];
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const preset = FRENCH_SAVINGS_2026[account.kind];
  const name = accountShortName(account.kind, locale);
  const { balance } = account;
  const fromBank = balance.source === "bank";
  const ownRate = account.kind === "pel" || account.kind === "livret";
  const ceiling = preset.ceiling;
  const ratio = ceiling ? Math.min(1, balance.balance / ceiling) : 0;

  return (
    <Card.Bezel
      className="w-full"
      innerClassName="flex w-full min-w-0 max-w-full flex-col gap-6 p-5 md:p-6"
    >
      <div className="flex min-w-0 flex-col items-center gap-1 text-center">
        <p className="text-sm text-muted-foreground">
          {t(ENVELOPE_NAME_KEYS[account.kind])}
        </p>
        <p className="privacy-amount font-serif text-4xl font-semibold tabular-nums">
          {format(balance.balance)}
        </p>
        <p className="text-xs text-muted-foreground">
          {fromBank ? (
            <>
              <Bank
                size={ICON.xs}
                aria-hidden
                className="mr-1 inline align-[-2px]"
              />
              {t("accounts.balanceFromBank", {
                date: formatShortDate(balance.asOf, locale),
              })}
            </>
          ) : (
            t("accounts.balanceAsOf", {
              date: formatShortDate(balance.asOf, locale),
            })
          )}
          {balance.added > 0 ? (
            <>
              {" · "}
              <span className="privacy-amount">
                {t("accounts.addedSince", { amount: format(balance.added) })}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Fact label={t("placementsWeb.rateLabel")}>
          <p className="text-sm font-medium tabular-nums">
            {t("accounts.ratePerYear", {
              rate: formatRate(account.rate, locale),
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(SAVINGS_KIND_RATE_KEYS[account.kind])}
          </p>
          <p className="privacy-sensitive mt-1 text-xs text-muted-foreground">
            {t("accounts.interestPerYear", {
              amount: format(
                yearlyInterest(balance.balance, {
                  kind: account.kind,
                  annual_rate: account.annualRate,
                }),
              ),
            })}
          </p>
        </Fact>

        <Fact label={t("placementsWeb.taxLabel")}>
          <p className="text-sm">{t(SAVINGS_KIND_TAX_KEYS[account.kind])}</p>
        </Fact>

        {ceiling ? (
          <Fact label={t("placementsWeb.ceilingLabel")}>
            <p className="privacy-sensitive text-sm tabular-nums">
              {ratio >= 1
                ? t("accounts.ceilingReached")
                : t("accounts.ceilingOf", {
                    balance: format(balance.balance),
                    ceiling: format(ceiling),
                  })}
            </p>
            <div
              aria-hidden
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-foreground/60"
                style={{ width: `${(ratio * 100).toFixed(1)}%` }}
              />
            </div>
          </Fact>
        ) : null}

        <Fact label={t("placementsWeb.monthlyLabel")}>
          <p className="privacy-sensitive text-sm tabular-nums">
            {monthly > 0
              ? t("accounts.monthlyPlanned", { amount: format(monthly) })
              : t("accounts.monthlyNone")}
          </p>
          {account.categoryName ? (
            <p className="text-xs text-muted-foreground">
              {t("accounts.categoryLine", { category: account.categoryName })}
            </p>
          ) : null}
        </Fact>
      </dl>

      {!preset.liquid ? (
        <p className="text-sm text-muted-foreground">
          {t("accounts.notLiquid")}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap gap-2">
          {!fromBank ? (
            <BalanceEditor id={account.id} balance={balance.balance} />
          ) : null}
          {ownRate ? <RateEditor id={account.id} rate={account.rate} /> : null}
          <BankLink account={account} linkable={linkable} />
        </div>
        <div>
          <RemoveAccount
            confirmText={t("accounts.removeSavingsConfirm", { name })}
            onRemove={() => removeSavingsAccount(account.id)}
          />
        </div>
      </div>
    </Card.Bezel>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

/**
 * A button that opens into one field and a save, and closes again when the
 * save lands.
 */
function InlineEditor({
  label,
  initial,
  suffix,
  sensitive = false,
  validate,
  save,
}: {
  label: string;
  initial: string;
  suffix: string;
  sensitive?: boolean;
  validate: (value: string) => boolean;
  save: (value: string) => Promise<{ error?: string; message?: string }>;
}) {
  const t = useT();
  const id = useId();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setValue(initial);
          setOpen(true);
        }}
      >
        <PencilSimple size={ICON.sm} aria-hidden className="mr-1.5" />
        {label}
      </Button>
    );
  }

  const valid = validate(value);
  return (
    <form
      className="flex w-full flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) {
          return;
        }
        startTransition(async () => {
          const result = await save(value);
          if (result.error) {
            toast(result.error, "error");
            return;
          }
          toast(result.message ?? t("accounts.saved"), "success");
          setOpen(false);
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </label>
        <div className="relative w-40">
          <Input
            id={id}
            autoFocus
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={valid ? undefined : true}
            className={cn(
              "pr-8 text-base tabular-nums",
              sensitive && "privacy-sensitive",
            )}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
          >
            {suffix}
          </span>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={!valid || pending}>
        {t("accounts.save")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(false)}
      >
        {t("common.cancel")}
      </Button>
    </form>
  );
}

function BalanceEditor({ id, balance }: { id: string; balance: number }) {
  const t = useT();
  const locale = useLocale();
  return (
    <InlineEditor
      label={t("accounts.updateBalance")}
      initial={new Intl.NumberFormat(INTL_LOCALES[locale], {
        maximumFractionDigits: 2,
        useGrouping: false,
      }).format(balance)}
      suffix="€"
      sensitive
      validate={(value) => {
        const parsed = parseTypedAmount(value);
        return parsed !== null && parsed >= 0;
      }}
      save={(value) =>
        updateSavingsBalance(id, Math.max(0, parseTypedAmount(value) ?? 0))
      }
    />
  );
}

function RateEditor({ id, rate }: { id: string; rate: number }) {
  const t = useT();
  const locale = useLocale();
  return (
    <InlineEditor
      label={t("accounts.editRate")}
      initial={rateToInput(rate, locale)}
      suffix="%"
      validate={(value) => {
        const parsed = parseTypedAmount(value);
        return parsed !== null && parsed >= 0 && parsed <= 20;
      }}
      save={(value) =>
        updateSavingsRate(id, (parseTypedAmount(value) ?? 0) / 100)
      }
    />
  );
}

/** Read the balance from the bank, or stop reading it. */
function BankLink({
  account,
  linkable,
}: {
  account: SavingsAccountView;
  linkable: LinkableBankAccount[];
}) {
  const t = useT();
  const format = useFormatCurrency();
  const { toast } = useToast();
  const [picking, setPicking] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(bankAccountId: string | null) {
    startTransition(async () => {
      const result = await linkSavingsBank(account.id, bankAccountId);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(t("accounts.saved"), "success");
      setPicking(false);
    });
  }

  if (account.bankAccountId) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(null)}
      >
        <Bank size={ICON.sm} aria-hidden className="mr-1.5" />
        {t("accounts.unlinkBank")}
      </Button>
    );
  }

  if (linkable.length === 0) {
    return null;
  }

  if (!picking) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setPicking(true)}
      >
        <Bank size={ICON.sm} aria-hidden className="mr-1.5" />
        {t("accounts.linkBank")}
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("placementsWeb.bankPick")}
      className="flex w-full flex-col gap-2"
    >
      <p className="text-xs text-muted-foreground">
        {t("placementsWeb.bankPick")}
      </p>
      <div className="flex flex-wrap gap-2">
        {linkable.map((bank) => (
          <Button
            key={bank.id}
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(bank.id)}
          >
            {bank.label}
            {bank.balance !== null ? (
              <span className="privacy-amount ml-2 tabular-nums text-muted-foreground">
                {format(bank.balance)}
              </span>
            ) : null}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPicking(false)}
        >
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
