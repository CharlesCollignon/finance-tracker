"use client";

import { useState, useTransition } from "react";
import { PencilSimple, Sparkle, WarningCircle } from "@phosphor-icons/react";
import type { MonthFacts } from "@finance/core/month-facts";
import {
  renderMonthRead,
  type MonthRead as MonthReadValue,
  type ReadSegment,
} from "@finance/core/month-read";
import type { ReadFreshness } from "@finance/core/month-read-budget";
import { writeMonthReadAction } from "@/lib/actions/month-read";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { useToast } from "@/components/layout/ToastProvider";
import { cn } from "@/lib/utils";
import { GLASS_CARD } from "@/lib/glass";
import { useFormatCurrency } from "@/lib/use-currency";

interface MonthReadProps {
  year: number;
  month: number;
  monthLabel: string;
  /** Null when nothing has been written for this month. */
  read: MonthReadValue | null;
  freshness: ReadFreshness | null;
  /** The figures as they stand now — what the read renders against. */
  facts: MonthFacts;
  writesLeft: number;
  /** Whether a writer exists on this deployment at all. */
  configured: boolean;
}

/**
 * A month, in words.
 *
 * The prose is a model's; every figure in it is the app's. The model writes
 * `{{fact:expenses}}` and never a number, and this component substitutes the
 * app's own formatted value — which is what makes the currency toggle and the
 * privacy blur work on a written paragraph, and what stops a figure nobody
 * computed reaching the screen.
 *
 * Rendered from the *current* figures rather than the ones stored with the
 * read, so a number here can never contradict the card above it. What can age
 * is the judgement, and `freshness` is how the card says so.
 *
 * Said plainly rather than implied: this was written by a model. Not for
 * liability — a card that quietly suggests a person looked at your money is
 * the same class of small lie as calling an arithmetic figure "on hand".
 */
export function MonthRead({
  year,
  month,
  monthLabel,
  read,
  freshness,
  facts,
  writesLeft,
  configured,
}: MonthReadProps) {
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const [pending, startTransition] = useTransition();
  const [left, setLeft] = useState(writesLeft);

  const rendered = read ? renderMonthRead(read, facts, formatMoney) : null;

  // Nothing to show and nothing that could be written. The same honesty as
  // the bank capability probe: no broken button on a deployment with no key.
  if (!configured && !rendered) {
    return null;
  }

  // A month with nothing in it is not worth offering a read of, and the
  // server refuses one anyway.
  if (!rendered && facts.thin) {
    return null;
  }

  function write() {
    startTransition(async () => {
      const outcome = await writeMonthReadAction(year, month);
      setLeft(outcome.writesLeft);
      toast(
        outcome.message ?? `Written for ${monthLabel}`,
        outcome.written ? "success" : "error",
      );
    });
  }

  return (
    <section className={cn("flex flex-col gap-4 rounded-3xl p-5", GLASS_CARD)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkle size={14} className="text-primary-rim" />
          The read
        </h2>
        <p className="text-xs text-muted-foreground">
          Written by a model, from the figures on this page. It cannot see your
          accounts.
        </p>
      </div>

      {rendered ? (
        <>
          <p className="font-head text-lg leading-snug">
            <Segments segments={rendered.headline} />
          </p>

          <ul className="flex flex-col gap-2">
            {rendered.observations.map((row, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    row.tone === "good"
                      ? "bg-success"
                      : row.tone === "watch"
                        ? "bg-destructive"
                        : "bg-muted-foreground",
                  )}
                />
                <span className="min-w-0">
                  <Segments segments={row.segments} />
                </span>
              </li>
            ))}
          </ul>

          {/* Below a rule, under a heading of its own. The owner asked for
              advice, and a reader should still always be able to tell which
              lines are measurements and which are opinions. */}
          {rendered.suggestions.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-foreground/10 pt-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                What to change
              </h3>
              <ul className="flex flex-col gap-2">
                {rendered.suggestions.map((row, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span
                      aria-hidden
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-rim"
                    />
                    <span className="min-w-0">
                      <Segments segments={row.segments} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {`Nothing has been written about ${monthLabel} yet.`}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/10 pt-3">
        <p className="text-xs text-muted-foreground">
          {freshness ? <Standing freshness={freshness} /> : null}
        </p>

        {configured ? (
          <button
            type="button"
            onClick={write}
            disabled={pending || left <= 0}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3",
              "text-sm font-medium transition-colors",
              left > 0
                ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                : "cursor-not-allowed text-muted-foreground",
              "disabled:opacity-60",
            )}
          >
            <PencilSimple size={14} />
            {pending
              ? "Writing…"
              : left <= 0
                ? `No reads left for ${monthLabel}`
                : rendered
                  ? `Write it again (${left} left)`
                  : `Write one (${left} left)`}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/**
 * How well the read still stands.
 *
 * A month in progress is never called stale, however much has moved: its
 * figures change whenever anything is recorded, so the badge would be lit
 * permanently and a warning that is always on is one nobody reads.
 */
function Standing({ freshness }: { freshness: ReadFreshness }) {
  if (freshness.standing === "moved") {
    const count = freshness.moved.length;
    return (
      <span className="flex items-center gap-1.5 text-primary-ink">
        <WarningCircle size={13} />
        {`${count === 1 ? "One figure" : `${count} figures`} this rests on ${
          count === 1 ? "has" : "have"
        } moved since it was written, ${freshness.writtenAge}.`}
      </span>
    );
  }

  if (freshness.standing === "provisional") {
    return (
      <>{`Written ${freshness.writtenAge}, from the figures as they stood then.`}</>
    );
  }

  return <>{`Written ${freshness.writtenAge}.`}</>;
}

/**
 * Prose and figures, interleaved.
 *
 * Each figure gets its own element so privacy mode can blur it, and carries
 * the datum's label as a title so a reader can check which figure it is —
 * "the app renders its own value for that datum", made visible.
 */
function Segments({ segments }: { segments: ReadSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <PrivateAmount
            key={index}
            title={segment.label}
            className="font-medium tabular-nums"
          >
            {segment.display}
          </PrivateAmount>
        ),
      )}
    </>
  );
}
