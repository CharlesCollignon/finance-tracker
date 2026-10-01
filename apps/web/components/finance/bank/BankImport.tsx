"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  WarningCircle,
} from "@phosphor-icons/react";
import { resolveMessage } from "@finance/core/i18n/t";
import { Button, buttonVariants } from "@/components/ui/Button";
import {
  finishBankImport,
  importAccountHistory,
  listImportAccounts,
} from "@/lib/actions/bank-connect";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";

type AccountState =
  | { id: string; label: string; state: "waiting" | "running" }
  | { id: string; label: string; state: "done"; entries: number }
  | { id: string; label: string; state: "failed"; message: string };

/**
 * The first import of a whole history, driven from the page.
 *
 * One account per request, so however long a statement is, no single
 * request has to outlast the function's time limit. The list shows each
 * account as it goes rather than one spinner for the lot, because a history
 * can take a while and a bar that does not move reads as broken.
 *
 * Nothing is lost by leaving: the connection keeps `backfilled_at` empty
 * until the last account is in, so coming back to this page starts it again,
 * and rows already written are recognised and skipped.
 *
 * A file that works on an open-banking.io account with no bank connected yet
 * is not a finished import: it would mark the history as in, and the bank
 * connected afterwards would only ever get the ordinary few days of sync.
 * So an empty list waits, says what is missing, and checks again on request.
 */
export function BankImport() {
  const t = useT();
  const [accounts, setAccounts] = useState<AccountState[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [done, setDone] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [checking, setChecking] = useState(false);
  const started = useRef(false);

  const run = useCallback(async () => {
    setError(null);
    setEmpty(false);
    setChecking(true);
    const listed = await listImportAccounts();
    setChecking(false);
    if (listed.error !== undefined) {
      setError(listed.error);
      return;
    }
    if (listed.accounts.length === 0) {
      setEmpty(true);
      return;
    }
    let rows: AccountState[] = listed.accounts.map((account) => ({
      ...account,
      state: "waiting",
    }));
    setAccounts(rows);

    let waiting = 0;
    for (const account of listed.accounts) {
      rows = rows.map((row) =>
        row.id === account.id ? { ...row, state: "running" } : row,
      );
      setAccounts(rows);
      const result = await importAccountHistory(account.id);
      rows = rows.map((row) =>
        row.id !== account.id
          ? row
          : result.error !== undefined
            ? {
                id: row.id,
                label: row.label,
                state: "failed",
                message: result.error,
              }
            : {
                id: row.id,
                label: row.label,
                state: "done",
                entries: result.imported + result.pending,
              },
      );
      if (result.error === undefined) {
        waiting += result.pending;
      }
      setAccounts(rows);
    }

    setPending(waiting);
    if (rows.every((row) => row.state === "done")) {
      await finishBankImport();
      setDone(true);
    }
  }, []);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    void run();
  }, [run]);

  return (
    <section
      className={cn(GLASS_CARD, "flex flex-col gap-4 rounded-card p-card")}
      aria-live="polite"
    >
      <div>
        <h2 className="text-base font-semibold">
          {done ? t("bankConnect.importDone") : t("bankConnect.importTitle")}
        </h2>
        {!done ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("bankConnect.importBody")}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive">{resolveMessage(t, error)}</p>
      ) : null}

      {empty ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">{t("bankConnect.noAccountsYet")}</p>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://open-banking.io/app"
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "md" }), "gap-1.5")}
            >
              {t("bankConnect.openSite")}
              <ArrowSquareOut size={ICON.sm} aria-hidden />
            </a>
            <Button
              type="button"
              variant="outline"
              disabled={checking}
              onClick={() => void run()}
            >
              {t("bankConnect.checkAgain")}
            </Button>
          </div>
        </div>
      ) : null}

      {accounts ? (
        <ul className="flex flex-col gap-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between gap-3 rounded-control border border-border px-3 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2.5 text-sm">
                {account.state === "done" ? (
                  <CheckCircle
                    size={ICON.md}
                    weight="fill"
                    className="shrink-0 text-success"
                  />
                ) : account.state === "failed" ? (
                  <WarningCircle
                    size={ICON.md}
                    weight="fill"
                    className="shrink-0 text-destructive"
                  />
                ) : (
                  <CircleNotch
                    size={ICON.md}
                    className={cn(
                      "shrink-0 text-muted-foreground",
                      account.state === "running" &&
                        "animate-spin motion-reduce:animate-none",
                    )}
                  />
                )}
                <span className="truncate">{account.label}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {account.state === "done"
                  ? t("bankConnect.importAccountDone", {
                      count: account.entries,
                    })
                  : account.state === "failed"
                    ? resolveMessage(t, account.message)
                    : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {done ? (
        <div className="flex flex-wrap gap-2">
          {pending > 0 ? (
            <Link
              href="/transactions?review=inbox"
              className={buttonVariants({ size: "md" })}
            >
              {t("bankConnect.reviewCta", { count: pending })}
            </Link>
          ) : null}
          <Link
            href="/bearing"
            className={buttonVariants({
              variant: pending > 0 ? "outline" : "default",
              size: "md",
            })}
          >
            {t("bankConnect.toBearing")}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
