"use client";

import { useState, useTransition } from "react";
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
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const [balance, setBalance] = useState("");
  const [stage, setStage] = useState<Stage>("entering");
  const [result, setResult] = useState<MonthCloseResult | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setBalance("");
    setStage("entering");
    setResult(null);
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
        toast(response.error ?? "Could not work that out.", "error");
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
        toast(response.error ?? "Could not close the month.", "error");
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
      title={stage === "closed" ? monthLabel : `Close ${monthLabel}`}
    >
      <div className="flex flex-col gap-4">
        {stage === "entering" && (
          <>
            <Text className="text-sm text-muted-foreground">
              What did your account hold on {formatShortDate(observeOn)}? Add up
              the accounts your day-to-day spending leaves from — one number is
              all this needs.
            </Text>
            {isBaseline ? (
              <Text className="text-sm text-muted-foreground">
                This first one only sets the starting point. There is nothing to
                measure against yet; next month there will be.
              </Text>
            ) : (
              <Text className="text-sm text-muted-foreground">
                Read it on the same day every month. That way the card payments
                still in flight are the same distortion each time, and the
                months stay comparable.
              </Text>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Balance</span>
              <Input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="2400.50"
                value={balance}
                onChange={(event) => setBalance(event.target.value)}
                aria-label={`Balance on ${observeOn}`}
              />
            </label>

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={pending || !balanceIsUsable}
              onClick={check}
            >
              {pending ? "Working it out…" : "See what that means"}
            </Button>
          </>
        )}

        {stage !== "entering" && result && (
          <>
            {result.status === "baseline" ? (
              <div>
                <h3 className="font-head text-lg">Starting point set</h3>
                <Text className="mt-1 text-sm text-muted-foreground">
                  {formatMoney(result.closingBalance)} on{" "}
                  {formatShortDate(observeOn)}. Close next month and the app can
                  start telling you what it never saw.
                </Text>
              </div>
            ) : result.status === "over-recorded" ? (
              <div>
                <h3 className="font-head text-lg">Something is missing</h3>
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
                    ? `You kept ${formatMoney(result.kept)}`
                    : `${monthLabel} cost more than it brought in`}
                </h3>
                <Text className="mt-1 text-sm text-muted-foreground">
                  {result.keptRate !== null
                    ? `${result.keptRate}% of what came in, counting what you set aside.`
                    : "Counting what you set aside."}
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
                label="Came in"
                value={formatMoney(result.flows.income)}
              />
              <Figure
                label="Recorded spending"
                value={formatMoney(result.flows.expenses)}
              />
              <Figure
                label="Set aside"
                value={formatMoney(
                  result.flows.savings + result.flows.transfers,
                )}
              />
              {result.unrecorded !== null && (
                <Figure
                  label="Never recorded"
                  value={formatMoney(result.unrecorded)}
                  tone={overCap ? "warn" : "good"}
                />
              )}
            </div>

            {result.unrecorded !== null && (
              <Text className="text-sm text-muted-foreground">
                {unrecordedCap !== null
                  ? overCap
                    ? `That is ${formatMoney(result.unrecorded - unrecordedCap)} over your ${formatMoney(unrecordedCap)} allowance.`
                    : `Inside your ${formatMoney(unrecordedCap)} allowance, with ${formatMoney(unrecordedCap - result.unrecorded)} to spare.`
                  : baseline !== null
                    ? `A normal month for you is around ${formatMoney(baseline)}.`
                    : "Spending the app never heard about — the restaurants, the rounds, the things bought on the way home. Nothing to fix, just worth knowing."}
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
                  {pending ? "Closing…" : `Close ${monthLabel}`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  disabled={pending}
                  onClick={() => setStage("entering")}
                >
                  Change the balance
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
                  Done
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="w-full"
                  disabled={pending}
                  onClick={undo}
                >
                  That balance was wrong — reopen the month
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </MobileSheet>
  );
}
