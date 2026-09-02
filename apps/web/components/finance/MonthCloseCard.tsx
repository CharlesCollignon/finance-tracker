"use client";

import { useState } from "react";
import { ArrowRight, Flame } from "@phosphor-icons/react";
import { Button, ButtonNub } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { MonthCloseSheet } from "@/components/finance/MonthCloseSheet";
import { useFormatCurrency } from "@/lib/use-currency";

interface MonthCloseCardProps {
  year: number;
  month: number;
  monthLabel: string;
  observeOn: string;
  isBaseline: boolean;
  monthlyCommitted: number;
  unrecordedCap: number | null;
  baseline: number | null;
  streak: number;
}

/**
 * The month's closing moment.
 *
 * Its opposite number, MonthReadyCard, opens a month by filling it in from
 * the standing instructions. This one shuts it, and is the only place the app
 * asks for something it cannot work out for itself. One number, once a month,
 * in exchange for the only honest answer to "did I actually save anything" —
 * so it is worth a card rather than a setting buried on a screen nobody
 * visits.
 */
export function MonthCloseCard({
  year,
  month,
  monthLabel,
  observeOn,
  isBaseline,
  monthlyCommitted,
  unrecordedCap,
  baseline,
  streak,
}: MonthCloseCardProps) {
  const formatMoney = useFormatCurrency();
  const [open, setOpen] = useState(false);

  const detail = isBaseline
    ? "One balance sets the starting point. From next month the app can tell you what it never saw."
    : unrecordedCap !== null
      ? `Stay under ${formatMoney(unrecordedCap)} of unrecorded spending to keep the run going.`
      : baseline !== null
        ? `A normal month for you is around ${formatMoney(baseline)} the app never sees.`
        : "One balance, and the app can work out what it never saw.";

  return (
    <>
      <Card.Bezel className="w-full" innerClassName="p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-head text-lg">
                {monthLabel} is ready to close
              </h2>
              {streak > 1 && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground"
                  title={`${streak} months in a row`}
                >
                  <Flame size={12} weight="fill" />
                  {streak}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="pill"
              className="gap-3"
              onClick={() => setOpen(true)}
            >
              Close the month
              <ButtonNub>
                <ArrowRight size={16} />
              </ButtonNub>
            </Button>
          </div>
        </div>
      </Card.Bezel>

      <MonthCloseSheet
        open={open}
        onOpenChange={setOpen}
        year={year}
        month={month}
        monthLabel={monthLabel}
        observeOn={observeOn}
        isBaseline={isBaseline}
        monthlyCommitted={monthlyCommitted}
        unrecordedCap={unrecordedCap}
        baseline={baseline}
      />
    </>
  );
}
