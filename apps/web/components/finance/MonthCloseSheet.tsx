"use client";

import { useEffect, useState, useTransition } from "react";
import type { MonthCloseResult } from "@finance/core/month-close";
import { runwayDaysAdded } from "@finance/core/month-close";
import { formatShortDate } from "@finance/core/constants";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { Text } from "@/components/retroui/Text";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { useToast } from "@/components/layout/ToastProvider";
import { useFormatCurrency } from "@/lib/use-currency";
import {
  deleteMonthClose,
  previewMonthCloseAction,
  recordMonthClose,
} from "@/lib/actions/month-close";
import { getBankBalanceSuggestion } from "@/lib/actions/bank";
import { useLocale, useT } from "@/lib/locale-context";

interface MonthCloseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  monthLabel: string;
  /** The date whose balance the user is being asked for. */
  observeOn: string;
  isBaseline: boolean;
  /** One month of unavoidable outgoings, for the runway translation. */
  monthlyCommitted: number;
  unrecordedCap: number | null;
  /** What a normal month's unrecorded spending has been, if known yet. */
  baseline: number | null;
}

type Stage = "entering" | "checked" | "closed";

function Figure({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: string;
  tone?: "plain" | "good" | "warn";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={
          tone === "good"
            ? "tabular-nums font-semibold text-success"
            : tone === "warn"
              ? "tabular-nums font-semibold text-destructive"
              : "tabular-nums font-semibold"
        }
      >
        {value}
      </span>
    </div>
  );
}

export function MonthCloseSheet({
  open,
  onOpenChange,
  year,
  month,
  monthLabel,
  observeOn,
  isBaseline,
  monthlyCommitted,
  unrecordedCap,
  baseline,
}: MonthCloseSheetProps) {
  const locale = useLocale();
  const t = useT();
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const [balance, setBalance] = useState("");
  const [stage, setStage] = useState<Stage>("entering");
  const [result, setResult] = useState<MonthCloseResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [fromBank, setFromBank] = useState<string | null>(null);

  // Asked for when the sheet opens rather than stored: a balance only means
  // anything at the instant it is read, and a stale one pre-filled into a
  // close would be worse than an empty field the user has to go and look up.
  useEffect(() => {
    if (!open || stage !== "entering") {
      return;
    }
    let live = true;
    void getBankBalanceSuggestion().then((result) => {
      if (!live || !result.total) {
        return;
      }
      setFromBank(result.total);
      setBalance((current) =>
        current.trim() === "" ? result.total! : current,
      );
    });
    return () => {
      live = false;
    };
  }, [open, stage]);

  function reset() {
    setBalance("");
    setStage("entering");
    setResult(null);
    setFromBank(null);
  }

  function close() {
    onOpenChange(false);
    // Leave the reveal on screen for the moment the sheet takes to leave.
    window.setTimeout(reset, 250);
  }

  const parsedBalance = Number(balance.replace(",", "."));
  const balanceIsUsable =
    balance.trim() !== "" && Number.isFinite(parsedBalance);

  function check() {
    startTransition(async () => {
      const response = await previewMonthCloseAction(
        year,
        month,
        parsedBalance,
      );
      if (response.error || !response.result) {
        toast(response.error ?? t("monthClose.couldNotWorkOut"), "error");
        return;
      }
      setResult(response.result);
      setStage("checked");
    });
  }

  function confirm() {
    startTransition(async () => {
      const response = await recordMonthClose(year, month, parsedBalance);
      if (response.error || !response.result) {
        toast(response.error ?? t("monthClose.couldNotClose"), "error");
        return;
      }
      setResult(response.result);
      setStage("closed");
    });
  }

  function undo() {
    startTransition(async () => {
      const response = await deleteMonthClose(year, month);
      if (response.error) {
        toast(response.error, "error");
        return;
      }
      toast(`${monthLabel} reopened`, "success");
      close();
    });
  }

  const days = result ? runwayDaysAdded(result.kept, monthlyCommitted) : null;
  const overCap =
    unrecordedCap !== null &&
    result?.unrecorded !== null &&
    result?.unrecorded !== undefined &&
    result.unrecorded > unrecordedCap;

  return (
    <MobileSheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={
        stage === "closed"
          ? monthLabel
          : t("monthClose.closeMonth", { month: monthLabel })
      }
    >
      <div className="flex flex-col gap-4">
        {stage === "entering" && (
          <>
            <Text className="text-sm text-muted-foreground">
              {t("monthClose.balancePrompt", {
                date: formatShortDate(observeOn, locale),
              })}
            </Text>
            {isBaseline ? (
              <Text className="text-sm text-muted-foreground">
                {t("monthClose.baselineNote")}
              </Text>
            ) : (
              <Text className="text-sm text-muted-foreground">
                {t("monthClose.sameDayNote")}
              </Text>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t("monthClose.balance")}
              </span>
              {fromBank ? (
                <span className="text-xs text-muted-foreground">
                  Filled in from your bank. Change it if the reading day differs
                  from today.
                </span>
              ) : null}
              <Input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="2400.50"
                value={balance}
                onChange={(event) => setBalance(event.target.value)}
                aria-label={t("monthClose.balanceOn", { date: observeOn })}
              />
            </label>

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={pending || !balanceIsUsable}
              onClick={check}
            >
              {pending
                ? t("monthClose.working")
                : t("monthClose.seeWhatThatMeans")}
            </Button>
          </>
        )}

        {stage !== "entering" && result && (
          <>
            {result.status === "baseline" ? (
              <div>
                <h3 className="font-head text-lg">
                  {t("monthClose.startingPointSet")}
                </h3>
                <Text className="mt-1 text-sm text-muted-foreground">
                  {formatMoney(result.closingBalance)} on{" "}
                  {formatShortDate(observeOn)}. Close next month and the app can
                  start telling you what it never saw.
                </Text>
              </div>
            ) : result.status === "over-recorded" ? (
              <div>
                <h3 className="font-head text-lg">
                  {t("monthClose.somethingMissing")}
                </h3>
                <Text className="mt-1 text-sm text-muted-foreground">
                  The account holds {formatMoney(result.unexplainedCredit ?? 0)}{" "}
                  more than the recorded movements allow. Usually that means
                  income that was never entered — or an expense entered twice,
                  or a broker transfer recorded both as a transaction and as a
                  transfer.
                </Text>
              </div>
            ) : (
              <div>
                <h3 className="font-head text-lg">
                  {result.kept !== null && result.kept > 0
                    ? t("monthClose.youKept", {
                        amount: formatMoney(result.kept),
                      })
                    : t("monthClose.costMoreThanItBrought", {
                        month: monthLabel,
                      })}
                </h3>
                <Text className="mt-1 text-sm text-muted-foreground">
                  {result.keptRate !== null
                    ? t("monthClose.keptRate", { rate: result.keptRate })
                    : t("monthClose.keptRateUnknown")}
                </Text>
                {days !== null && (
                  <Text className="mt-1 text-sm text-muted-foreground">
                    That is {days} {days === 1 ? "day" : "days"} of runway
                    bought.
                  </Text>
                )}
              </div>
            )}

            <div className="rounded-lg border border-border p-3">
              <Figure
                label={t("monthClose.cameIn")}
                value={formatMoney(result.flows.income)}
              />
              <Figure
                label={t("monthClose.recordedSpending")}
                value={formatMoney(result.flows.expenses)}
              />
              <Figure
                label={t("monthClose.setAside")}
                value={formatMoney(
                  result.flows.savings + result.flows.transfers,
                )}
              />
              {result.unrecorded !== null && (
                <Figure
                  label={t("monthClose.neverRecorded")}
                  value={formatMoney(result.unrecorded)}
                  tone={overCap ? "warn" : "good"}
                />
              )}
            </div>

            {result.unrecorded !== null && (
              <Text className="text-sm text-muted-foreground">
                {unrecordedCap !== null
                  ? overCap
                    ? t("monthClose.overAllowance", {
                        over: formatMoney(result.unrecorded - unrecordedCap),
                        cap: formatMoney(unrecordedCap),
                      })
                    : t("monthClose.insideAllowance", {
                        cap: formatMoney(unrecordedCap),
                        spare: formatMoney(unrecordedCap - result.unrecorded),
                      })
                  : baseline !== null
                    ? t("monthClose.normalMonth", {
                        amount: formatMoney(baseline),
                      })
                    : t("monthClose.unrecordedBlurb")}
              </Text>
            )}

            {stage === "checked" ? (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  disabled={pending}
                  onClick={confirm}
                >
                  {pending
                    ? t("monthClose.closing")
                    : t("monthClose.closeMonth", { month: monthLabel })}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  disabled={pending}
                  onClick={() => setStage("entering")}
                >
                  {t("monthClose.changeTheBalance")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={close}
                >
                  {t("monthClose.done")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="w-full"
                  disabled={pending}
                  onClick={undo}
                >
                  {t("monthClose.reopen")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </MobileSheet>
  );
}
