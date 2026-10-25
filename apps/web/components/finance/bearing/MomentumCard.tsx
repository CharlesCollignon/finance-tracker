"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CaretRight,
  ChartBar,
  Fire,
  TrendUp,
} from "@phosphor-icons/react";
import { CLOSE_WAIT_REASON_KEYS } from "@finance/core/bank-balance";
import { formatShortDate, lastDayIsoOfMonth } from "@finance/core/constants";
import { monthShort } from "@finance/core/i18n/calendar-names";
import {
  closeInvitation,
  monthWasWon,
  type CloseableMonth,
} from "@finance/core/month-close";
import type { BearingMonth } from "@/lib/bearing/month";
import { MonthCloseSheet } from "@/components/finance/MonthCloseSheet";
import { MonthsSheet } from "@/components/finance/bearing/MonthsSheet";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { Button, ButtonNub } from "@/components/ui/Button";
import { ICON } from "@/lib/icon-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import { Card } from "@/components/finance/bearing/card-parts";

/** How many of the latest months the run's chain shows. */
const CHAIN_LENGTH = 6;

/**
 * One close, and every figure the sheet reads while it is open, frozen the
 * moment it is pressed: recording a close rewrites the very figures the open
 * sheet is showing — the month due empties, and the baseline is a median the
 * new close is one of — and driving the mounted sheet off them would tear it
 * away, reveal and undo included, the instant the refresh landed. The phone
 * holds it the same way.
 */
interface ClosePrompt {
  month: CloseableMonth;
  monthlyCommitted: number;
  unrecordedCap: number | null;
  baseline: number | null;
}

/* ------------------------------------------------------------ the run */

/**
 * What the month is adding up to beyond itself: the run of months closed
 * under the allowance, the close that keeps it going, and what is invested.
 * The one card on the screen that keeps score, so it is the one that is
 * allowed to feel like it.
 *
 * The month close lives here since October 2026, when it left the Plan: a
 * month is closed where the month is read. « Vos mois » — the months' bars,
 * every close, the allowance and the reading day — waits behind a sheet.
 */
export function MomentumCard({
  data,
  askClose = false,
}: {
  data: BearingMonth;
  /** Open the close at once: the attention row's « Faire le bilan ». */
  askClose?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const router = useRouter();
  const close = data.close;
  const overview = close?.overview ?? null;
  const next = overview?.next ?? null;

  const [closing, setClosing] = useState<ClosePrompt | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [monthsOpen, setMonthsOpen] = useState(false);

  const prompt: ClosePrompt | null =
    close && overview && next
      ? {
          month: next,
          monthlyCommitted: close.monthlyCommitted,
          unrecordedCap: overview.settings.unrecordedCap,
          baseline: overview.summary.baseline,
        }
      : null;
  const sheet = closing ?? prompt;

  function openClose() {
    if (prompt) {
      setClosing(prompt);
      setSheetOpen(true);
    }
  }

  // Asked from the attention row: open once per ask, adjusted while
  // rendering rather than in an effect, then drop the ask from the address
  // so a reload does not open it again.
  const [answered, setAnswered] = useState(false);
  if (askClose && !answered && prompt) {
    setAnswered(true);
    setClosing(prompt);
    setSheetOpen(true);
  } else if (!askClose && answered) {
    setAnswered(false);
  }
  useEffect(() => {
    if (askClose) {
      router.replace("/bearing", { scroll: false });
    }
  }, [askClose, router]);

  const chain = (overview?.history ?? [])
    .filter((row) => row.status !== "baseline")
    .slice(0, CHAIN_LENGTH)
    .reverse();

  return (
    <>
      {/* The sheets sit beside the card, not in it: its glass blur would
          hold their fixed overlay inside its own box. */}
      <Card
        icon={<Fire size={ICON.sm} weight="bold" />}
        title={t("removal.momentumTitle")}
      >
        {data.run ? (
          <div className="flex flex-col gap-3 rounded-control bg-accent px-3 py-2.5">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full",
                  data.run.streak > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Fire size={ICON.lg} weight="fill" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {data.run.streak > 0
                    ? t("bearingMonth.run", { count: data.run.streak })
                    : t("bearingMonth.noRunYet")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("bearingMonth.runBody")}
                  {data.run.best > data.run.streak
                    ? ` · ${t("bearingMonth.bestRun", { count: data.run.best })}`
                    : ""}
                </p>
              </div>
            </div>
            {chain.length > 0 && overview ? (
              <ol className="flex items-end gap-2">
                {chain.map((row) => {
                  const won = monthWasWon(row, overview.settings.unrecordedCap);
                  const month = Number(row.monthKey.slice(5, 7));
                  return (
                    <li
                      key={row.monthKey}
                      className="flex flex-1 flex-col items-center gap-1"
                      aria-label={
                        won
                          ? t("planWeb.runMonthWon", { month: row.label })
                          : t("planWeb.runMonthMissed", { month: row.label })
                      }
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "block h-1.5 w-full rounded-full",
                          won ? "bg-primary" : "bg-foreground/10",
                        )}
                      />
                      <span
                        aria-hidden
                        className="text-[11px] text-muted-foreground"
                      >
                        {monthShort(month, locale)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>
        ) : null}

        {next && overview ? (
          <CloseDue
            next={next}
            overview={overview}
            wait={close?.wait ?? []}
            streak={data.run?.streak ?? 0}
            onOpen={openClose}
          />
        ) : null}

        {overview && overview.history.length > 0 ? (
          <button
            type="button"
            onClick={() => setMonthsOpen(true)}
            className="flex items-center justify-between gap-3 rounded-control border border-border px-3 py-2.5 text-left transition-colors duration-hover hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <ChartBar size={ICON.md} />
              {t("futurePlan.monthsTitle")}
            </span>
            <CaretRight size={ICON.sm} className="text-muted-foreground" />
          </button>
        ) : null}

        {data.invested !== null ? (
          <Link
            href="/investments"
            className="mt-auto flex items-center justify-between gap-3 rounded-control border border-border px-3 py-2.5 transition-colors duration-hover hover:bg-muted"
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendUp size={ICON.md} />
              {t("bearingMonth.invested")}
            </span>
            <PrivateAmount className="text-sm font-semibold tabular-nums">
              {format(data.invested)}
            </PrivateAmount>
          </Link>
        ) : null}
      </Card>
      {sheet ? (
        <MonthCloseSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          year={sheet.month.year}
          month={sheet.month.month}
          monthLabel={sheet.month.label}
          observeOn={sheet.month.observeOn}
          isBaseline={sheet.month.isBaseline}
          monthlyCommitted={sheet.monthlyCommitted}
          unrecordedCap={sheet.unrecordedCap}
          baseline={sheet.baseline}
        />
      ) : null}
      {overview ? (
        <MonthsSheet
          open={monthsOpen}
          onOpenChange={setMonthsOpen}
          overview={overview}
        />
      ) : null}
    </>
  );
}

/**
 * The month due: what closing it will compare against, why the bank has not
 * closed it yet when it should have, and the way in.
 */
function CloseDue({
  next,
  overview,
  wait,
  streak,
  onOpen,
}: {
  next: CloseableMonth;
  overview: NonNullable<BearingMonth["close"]>["overview"];
  wait: NonNullable<BearingMonth["close"]>["wait"];
  streak: number;
  onOpen: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const invitation = closeInvitation({
    isBaseline: next.isBaseline,
    unrecordedCap: overview.settings.unrecordedCap,
    baseline: overview.summary.baseline,
  });
  const detail =
    invitation.kind === "baseline"
      ? t("monthClose.inviteBaseline")
      : invitation.kind === "allowance"
        ? t("monthClose.inviteAllowance", { cap: format(invitation.cap) })
        : invitation.kind === "normal"
          ? t("monthClose.inviteNormal", {
              amount: format(invitation.baseline),
            })
          : t("monthClose.inviteBare");

  return (
    <div className="flex flex-col gap-3 rounded-control border border-border p-3">
      <div>
        {streak > 0 ? (
          <p className="text-sm font-medium">
            {t("futurePlan.runKeep", { month: next.label })}
          </p>
        ) : null}
        <p
          className={cn(
            "text-sm text-muted-foreground",
            (invitation.kind === "allowance" || invitation.kind === "normal") &&
              "privacy-sensitive",
          )}
        >
          {detail}
        </p>
        {/* Why the bank has not closed it: named, so the fix — renewing one
            bank's consent, as a rule — is obvious. */}
        {wait.length > 0 ? (
          <div className="mt-2 text-sm text-muted-foreground">
            <p>
              {t("monthClose.waitBody", {
                month: next.label,
                date: formatShortDate(
                  lastDayIsoOfMonth(next.year, next.month),
                  locale,
                ),
              })}
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {wait.map((account) => (
                <li key={account.name}>
                  <span className="text-foreground">{account.name}</span>
                  {" · "}
                  {t(CLOSE_WAIT_REASON_KEYS[account.reason])}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <Button
        variant="pill"
        size="sm"
        className="gap-3 self-start"
        onClick={onOpen}
      >
        {next.isBaseline
          ? t("monthClose.setStartingBalance")
          : t("monthClose.closeTheMonth")}
        <ButtonNub>
          <ArrowRight size={ICON.md} />
        </ButtonNub>
      </Button>
    </div>
  );
}
