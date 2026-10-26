"use client";

import type { ReactNode } from "react";
import { nextSetupStep } from "@finance/core/setup-steps";
import type { BankAttention } from "@finance/core/bank-attention";
import { bankAttentionItems, sortAttention } from "@finance/core/attention";
import type { SpaceBalance } from "@finance/core/space-balance";
import type { BearingMonth } from "@/lib/bearing/month";
import { BalanceBetweenCard } from "@/components/finance/bearing/BalanceBetweenCard";
import { MyShareProvider } from "@/components/finance/bearing/MyShareToggle";
import { TodoStrip } from "@/components/finance/bearing/TodoStrip";
import { ArrivedCharges } from "@/components/finance/ArrivedCharges";
import { PurchasesToConfirm } from "@/components/finance/PurchasesToConfirm";
import { SetupCard } from "@/components/finance/bearing/SetupCard";
import { ShareMonthCard } from "@/components/finance/bearing/ShareMonthCard";
import { YearReadyCard } from "@/components/finance/bearing/YearReadyCard";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { FadeIn, FadeInItem } from "@/components/motion/FadeIn";
import { GLASS_CARD } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { BalanceCard } from "@/components/finance/bearing/BalanceCard";
import { MomentumCard } from "@/components/finance/bearing/MomentumCard";
import { SpentCard } from "@/components/finance/bearing/SpentCard";
import { TrustCard } from "@/components/finance/bearing/TrustCard";
import { UpcomingCard } from "@/components/finance/bearing/UpcomingCard";
import { WhereItWentCard } from "@/components/finance/bearing/WhereItWentCard";

/**
 * The Bearing: one month, told in a few big cards.
 *
 * It used to be where everything stood on one day — two figures, then five
 * collapsible families of twenty-odd figures, each with a panel fetched on
 * the press. Most of it was true and almost none of it was what the screen is
 * opened for, which is two questions: what is on the account, and where the
 * month ends. So those lead, as big figures over the line that joins them,
 * and everything else is a card only when it has something to say.
 *
 * One month at a time, switched from the same control as the Ledger. A month
 * that has ended tells what it did; one ahead tells what its charges call
 * for; the month in progress tells both, joined at today.
 */
export function BearingMonthView({
  data,
  recapSlot,
  readSlot,
  bankInvite = false,
  bankAttention = null,
  awaitingAccounts = 0,
  spaceBalance = null,
  askClose = false,
}: {
  data: BearingMonth;
  /** « Équilibre » between the partners, under « Commun »; null elsewhere. */
  spaceBalance?: SpaceBalance | null;
  /** Open the month close at once: asked for from the attention row. */
  askClose?: boolean;
  /** Whether to invite this reader to connect a bank: the first setup card. */
  bankInvite?: boolean;
  /** A connected bank about to stop, or stopped: shown above everything. */
  bankAttention?: BankAttention | null;
  /** Accounts the bank shows that wait to be told what they are. */
  awaitingAccounts?: number;
  /**
   * The week's recap, early in the week: streamed in like the read, and
   * nothing at all on the days it has nothing to show.
   */
  recapSlot?: ReactNode;
  /**
   * The month read, streamed in behind its own boundary: its facts are the
   * slowest thing on the page to gather, and the figures above it should not
   * wait for them.
   */
  readSlot?: ReactNode;
}) {
  const current = data.balance.period === "current";
  const past = data.balance.period === "past";
  const hasSpending = data.spending.total > 0;
  const hasMomentum =
    current &&
    (data.run !== null ||
      data.invested !== null ||
      (data.close?.overview.next ?? null) !== null);
  // One setup card at a time, for the month in progress.
  const setupStep = data.setup
    ? nextSetupStep({ ...data.setup, bankInvited: bankInvite })
    : null;
  // Only what has something in it: a first visit shows the setup card, not
  // a row of zeros.
  const hasSpentBefore =
    data.spent.total > 0 || data.spent.trend.some((entry) => entry.total > 0);
  // « À faire »: the month's list and the person's bank, read as one. The
  // bank is the person's whatever owner is on screen.
  const todo = sortAttention([
    ...data.attention,
    ...bankAttentionItems({ bank: bankAttention, awaitingAccounts }),
  ]);

  return (
    <MyShareProvider on={data.myShare?.on ?? false}>
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">
        <MonthPicker basePath="/bearing" className="self-center" />

        {todo.length > 0 ? <TodoStrip items={todo} /> : null}

        {/* Before the figures, because answering one changes them: a salary
          confirmed as arrived stops being counted as still to come. */}
        {data.arrived ? (
          <section
            id="arrived"
            className={cn(GLASS_CARD, "scroll-mt-20 rounded-card p-card")}
          >
            <ArrivedCharges proposals={data.arrived.proposals} />
          </section>
        ) : null}

        {/* January: the year before, told in a few cards. */}
        {data.yearReady !== null && !data.empty ? (
          <YearReadyCard year={data.yearReady} />
        ) : null}

        {/* The same kind of question, for what the bank cannot see. */}
        {data.purchases.length > 0 ? (
          <section
            id="purchases"
            className={cn(GLASS_CARD, "scroll-mt-20 rounded-card p-card")}
          >
            <PurchasesToConfirm purchases={data.purchases} />
          </section>
        ) : null}

        <FadeIn
          // Replayed per month: a new month is a new set of figures arriving.
          key={`${data.year}-${data.month}`}
          // One column that may shrink below its content on a phone: a grid
          // with no columns sizes its one track to the widest thing in it.
          className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3"
        >
          {setupStep && data.setup ? (
            <FadeInItem className="md:col-span-2 xl:col-span-3">
              <SetupCard
                step={setupStep}
                firstCloseOn={data.setup.firstCloseOn}
              />
            </FadeInItem>
          ) : null}

          {!data.empty ? (
            <FadeInItem className="md:col-span-2 xl:col-span-3">
              <BalanceCard data={data} />
            </FadeInItem>
          ) : null}

          {recapSlot ? (
            // Hidden while empty, so a week with no card leaves no gap.
            <FadeInItem className="empty:hidden md:col-span-2 xl:col-span-3">
              {recapSlot}
            </FadeInItem>
          ) : null}

          {hasSpentBefore && data.balance.period !== "future" ? (
            <FadeInItem>
              <SpentCard data={data} />
            </FadeInItem>
          ) : null}

          {spaceBalance ? (
            <FadeInItem>
              <BalanceBetweenCard balance={spaceBalance} />
            </FadeInItem>
          ) : null}

          {!past && data.upcoming && data.recurring ? (
            <FadeInItem>
              <UpcomingCard data={data} />
            </FadeInItem>
          ) : null}

          {hasMomentum ? (
            <FadeInItem>
              <MomentumCard data={data} askClose={askClose} />
            </FadeInItem>
          ) : null}

          {/* What the figures above rest on: the lines, the charges, the
              review, the close. Not on a first visit, which has none yet.
              The whole row, as a strip: a fact a cell, never a card left
              alone beside an empty one. */}
          {!data.empty && data.trust.length > 0 ? (
            <FadeInItem className="md:col-span-2 xl:col-span-3">
              <TrustCard signals={data.trust} />
            </FadeInItem>
          ) : null}

          {hasSpending ? (
            <FadeInItem
              className={cn(
                "md:col-span-2",
                // Beside the spent card when nothing else shares the row.
                current ? "xl:col-span-3" : "xl:col-span-2",
              )}
            >
              <WhereItWentCard data={data} />
            </FadeInItem>
          ) : null}

          {readSlot ? (
            <FadeInItem className="md:col-span-2 xl:col-span-3">
              {readSlot}
            </FadeInItem>
          ) : null}

          {/* The month to send or to print: not a month ahead, which has
              nothing to say yet, nor a first visit. */}
          {!data.empty && data.balance.period !== "future" ? (
            <FadeInItem className="md:col-span-2 xl:col-span-3">
              <ShareMonthCard year={data.year} month={data.month} />
            </FadeInItem>
          ) : null}
        </FadeIn>
      </div>
    </MyShareProvider>
  );
}
