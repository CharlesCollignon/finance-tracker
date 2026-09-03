"use client";

import { useState, useTransition } from "react";
import { Flame } from "@phosphor-icons/react";
import {
  MIN_CLOSES_FOR_CAP,
  monthWasWon,
  suggestUnrecordedCap,
  type CloseHistorySummary,
} from "@finance/core/month-close";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Input } from "@/components/retroui/Input";
import { Text } from "@/components/retroui/Text";
import { useToast } from "@/components/layout/ToastProvider";
import { useFormatCurrency } from "@/lib/use-currency";
import { updateCloseDay, updateUnrecordedCap } from "@/lib/actions/month-close";
import type { ClosedMonthRow } from "@/lib/queries/month-close";

interface MonthCloseHistoryProps {
  history: ClosedMonthRow[];
  summary: CloseHistorySummary;
  unrecordedCap: number | null;
  closeDay: number;
}

/**
 * What closing months has added up to.
 *
 * The allowance lives here rather than in settings because it only means
 * anything next to the months it came from: a cap the user picked out of the
 * air is a number to fail against, while one shown beside their own last six
 * months is a decision.
 */
export function MonthCloseHistory({
  history,
  summary,
  unrecordedCap,
  closeDay,
}: MonthCloseHistoryProps) {
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const [capDraft, setCapDraft] = useState(
    unrecordedCap === null ? "" : String(unrecordedCap),
  );
  const [pending, startTransition] = useTransition();

  const suggested = suggestUnrecordedCap(summary);

  function saveCap(value: number | null) {
    startTransition(async () => {
      const response = await updateUnrecordedCap(value);
      if (response.error) {
        toast(response.error, "error");
        return;
      }
      setCapDraft(value === null ? "" : String(value));
      toast(response.message ?? "Saved", "success");
    });
  }

  function saveCloseDay(day: number) {
    startTransition(async () => {
      const response = await updateCloseDay(day);
      if (response.error) {
        toast(response.error, "error");
        return;
      }
      toast(response.message ?? "Saved", "success");
    });
  }

  const parsedCap = Number(capDraft.replace(",", "."));
  const capIsUsable = capDraft.trim() !== "" && Number.isFinite(parsedCap);

  return (
    <Card className="block w-full">
      <Card.Header>
        <div className="flex items-center justify-between gap-3">
          <Card.Title>Closed months</Card.Title>
          {summary.streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
              <Flame size={13} weight="fill" />
              {summary.streak} in a row
              {summary.bestStreak > summary.streak &&
                ` · best ${summary.bestStreak}`}
            </span>
          )}
        </div>
        <Card.Description>
          {summary.baseline !== null
            ? `A normal month costs you about ${formatMoney(summary.baseline)} the app never sees.`
            : history.length > 0
              ? "One more close and there will be a normal month to compare against."
              : "Close a month from Month and it will appear here."}
        </Card.Description>
      </Card.Header>

      <Card.Content className="flex flex-col gap-4">
        {(history.length > 0 || unrecordedCap !== null) && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Unrecorded allowance</p>
            <Text className="text-xs text-muted-foreground">
              What you are willing to spend without recording it. Coming in
              under it is what keeps a run alive.
            </Text>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="text"
                inputMode="decimal"
                className="max-w-32"
                placeholder="180"
                value={capDraft}
                onChange={(event) => setCapDraft(event.target.value)}
                aria-label="Unrecorded allowance"
              />
              <Button
                type="button"
                size="sm"
                disabled={pending || !capIsUsable}
                onClick={() => saveCap(parsedCap)}
              >
                Save
              </Button>
              {suggested !== null && suggested !== unrecordedCap && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => saveCap(suggested)}
                >
                  Use {formatMoney(suggested)}
                </Button>
              )}
              {unrecordedCap !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => saveCap(null)}
                >
                  Remove
                </Button>
              )}
            </div>
            {suggested === null && summary.sample < MIN_CLOSES_FOR_CAP && (
              <Text className="text-xs text-muted-foreground">
                Close one more month and the app can suggest a figure from your
                own spending.
              </Text>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <p className="text-sm font-medium">Reading day</p>
          <Text className="text-xs text-muted-foreground">
            Which day of the following month you read the balance on. Later is
            safer with a deferred-debit card, because the month’s card spending
            has to have landed. What matters most is that it is always the same
            day.
          </Text>
          <div className="flex flex-wrap items-center gap-1.5">
            {[1, 3, 5, 10, 15].map((day) => (
              <Button
                key={day}
                type="button"
                variant={day === closeDay ? "default" : "outline"}
                size="sm"
                disabled={pending}
                onClick={() => saveCloseDay(day)}
              >
                {day}
              </Button>
            ))}
          </div>
        </div>

        {history.length > 0 && (
          <ul className="flex flex-col">
            {history.map((row) => {
              const won = monthWasWon(row, unrecordedCap);
              return (
                <li
                  key={row.monthKey}
                  className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.status === "baseline"
                        ? "Starting point"
                        : row.status === "over-recorded"
                          ? "Needs a look — more in the account than the records allow"
                          : `${formatMoney(row.unrecorded ?? 0)} never recorded`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {row.kept !== null && (
                      <p
                        className={
                          won
                            ? "tabular-nums text-sm font-semibold text-success"
                            : "tabular-nums text-sm font-semibold"
                        }
                      >
                        {formatMoney(row.kept)}
                      </p>
                    )}
                    {row.keptRate !== null && (
                      <p className="text-xs text-muted-foreground">
                        {row.keptRate}% kept
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card.Content>
    </Card>
  );
}
