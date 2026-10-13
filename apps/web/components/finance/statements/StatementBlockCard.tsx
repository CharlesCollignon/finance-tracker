"use client";

import { useEffect, useId, useRef, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import { Bank, CheckCircle } from "@phosphor-icons/react";
import { formatFullDate } from "@finance/core/constants";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";
import {
  accountTail,
  BANK_NAMES,
  initialAccountChoice,
  isBankId,
  statementKey,
  type AccountChoice,
  type BankId,
  type StatementBlock,
} from "@finance/core/statement";
import type { FileAccount } from "@finance/data/statements";
import { ChoiceChips } from "@/components/ui/Picker";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import type { StatementOutcome } from "@finance/core/validations/statements";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

export interface BlockChoice {
  account: AccountChoice;
  /** For amounts written without their sign: which way they went. */
  direction: "out" | "in";
}

/** The choice to start from (`initialAccountChoice`), as money out. */
export function initialChoice(
  block: StatementBlock,
  bank: BankId | null,
  accounts: readonly FileAccount[],
  mine: string,
): BlockChoice {
  return {
    account: initialAccountChoice(block, bank, accounts, mine),
    direction: "out",
  };
}

/** A count that rolls to its value, or is simply there under reduced motion. */
function Rolling({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce) {
      from.current = value;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION.panel);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(origin + (value - origin) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        from.current = value;
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);
  return <span className="tabular-nums">{reduce ? value : shown}</span>;
}

function dayOf(iso: string, locale: "fr" | "en", withYear: boolean): string {
  const full = formatFullDate(iso, locale);
  return withYear ? full : full.replace(/ \d{4}$/, "");
}

/**
 * One account's part of a file, as it was understood: whose statement,
 * which account, how many lines over which days — then which account of
 * the person's it is, and what importing it would do, the figures rolling
 * in as the server answers.
 */
export function StatementBlockCard({
  block,
  bank,
  accounts,
  choice,
  onChoice,
  outcome,
  index,
}: {
  block: StatementBlock;
  bank: BankId | null;
  accounts: readonly FileAccount[];
  choice: BlockChoice;
  onChoice: (choice: BlockChoice) => void;
  outcome: StatementOutcome | null;
  index: number;
}) {
  const t = useT();
  const locale = useLocale();
  const nameId = useId();
  const roleId = useId();
  const key = statementKey(block.account);
  const tail = accountTail(key);
  const known = key
    ? accounts.find((account) => account.key === key)
    : undefined;
  const bankName = bank && isBankId(bank) ? BANK_NAMES[bank] : null;
  const sameYear = block.from?.slice(0, 4) === block.to?.slice(0, 4);

  const accountOptions = [
    ...accounts.map((account) => ({
      value: account.providerAccountId,
      label: account.label,
    })),
    { value: "new", label: t("statements.accountNew") },
  ];
  const current =
    choice.account.kind === "existing"
      ? choice.account.providerAccountId
      : "new";

  const figures = outcome
    ? (
        [
          ["statements.matched", outcome.matched],
          ["statements.filed", outcome.filed],
          ["statements.waiting", outcome.waiting],
          ["statements.likelyTyped", outcome.likelyTyped],
          ["statements.known", outcome.known],
          ["statements.left", outcome.left],
        ] as const
      ).filter(([, count]) => count > 0)
    : [];

  return (
    <m.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: DURATION.enter / 1000,
        ease: EASE,
        delay: index * 0.08,
      }}
      className="flex flex-col gap-5 rounded-card border border-border bg-card p-6"
    >
      <header className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Bank size={ICON.lg} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-head text-lg">
            {bankName
              ? t("statements.statementOf", { bank: bankName })
              : t("statements.statement")}
            {tail ? (
              <span className="text-muted-foreground"> · {tail}</span>
            ) : null}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("statements.lines", { count: block.lines.length })}
            {block.from && block.to
              ? ` ${t("statements.period", {
                  from: dayOf(block.from, locale, !sameYear),
                  to: dayOf(block.to, locale, true),
                })}`
              : ""}
          </p>
        </div>
      </header>

      {known ? (
        <p className="flex items-center gap-2 text-sm">
          <CheckCircle size={ICON.md} aria-hidden className="text-success" />
          <span>
            {known.label} · {t("statements.accountKnown")}
          </span>
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {accounts.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p id={nameId} className="text-sm font-medium">
                {t("statements.accountPick")}
              </p>
              <ChoiceChips
                labelledBy={nameId}
                options={accountOptions}
                value={current}
                onValueChange={(value) =>
                  onChoice({
                    ...choice,
                    account:
                      value === "new"
                        ? initialChoice(
                            { ...block, account: block.account ?? null },
                            bank,
                            [],
                            t("statements.accountMine"),
                          ).account
                        : { kind: "existing", providerAccountId: value },
                  })
                }
              />
            </div>
          ) : null}
          {choice.account.kind === "new" ? (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">
                  {t("statements.accountName")}
                </span>
                <input
                  value={choice.account.label}
                  maxLength={80}
                  onChange={(event) =>
                    choice.account.kind === "new" &&
                    onChoice({
                      ...choice,
                      account: { ...choice.account, label: event.target.value },
                    })
                  }
                  className="min-h-11 rounded-control border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:max-w-sm"
                />
              </label>
              <div className="flex flex-col gap-2">
                <p id={roleId} className="text-sm font-medium">
                  {t("bankAccounts.roleGroup", {
                    account:
                      choice.account.label || t("statements.accountMine"),
                  })}
                </p>
                <ChoiceChips
                  labelledBy={roleId}
                  options={[
                    {
                      value: "spending",
                      label: t("bankAccounts.roleSpending"),
                    },
                    { value: "savings", label: t("bankAccounts.roleSavings") },
                    { value: "ignored", label: t("bankAccounts.roleIgnored") },
                  ]}
                  value={choice.account.role}
                  onValueChange={(role) =>
                    choice.account.kind === "new" &&
                    onChoice({
                      ...choice,
                      account: { ...choice.account, role },
                    })
                  }
                />
              </div>
            </div>
          ) : null}
        </div>
      )}

      {block.signUnknown ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t("statements.signQuestion")}</p>
          <ChoiceChips
            options={[
              { value: "out", label: t("statements.signOut") },
              { value: "in", label: t("statements.signIn") },
            ]}
            value={choice.direction}
            onValueChange={(direction) => onChoice({ ...choice, direction })}
          />
        </div>
      ) : null}

      <div aria-live="polite" className="min-h-6">
        {outcome && !outcome.kept ? (
          <p className="text-sm text-muted-foreground">
            {choice.account.kind === "new" && choice.account.role === "ignored"
              ? t("statements.ignoredKept")
              : t("statements.savingsKept")}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {figures.map(([label, count], at) => (
              <m.li
                key={label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: DURATION.press / 1000,
                  ease: EASE,
                  delay: at * 0.05,
                }}
                className={
                  label === "statements.waiting"
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }
              >
                {t(label, { count })
                  .replace(String(count), "\u0000")
                  .split("\u0000")
                  .map((part, partIndex, parts) => (
                    <span key={partIndex}>
                      {part}
                      {partIndex < parts.length - 1 ? (
                        <Rolling value={count} />
                      ) : null}
                    </span>
                  ))}
              </m.li>
            ))}
          </ul>
        )}
      </div>
    </m.section>
  );
}
