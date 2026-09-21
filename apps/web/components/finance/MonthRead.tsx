"use client";

import { useState, useTransition } from "react";
import { Sparkle, WarningCircle } from "@phosphor-icons/react";
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
import { Button } from "@/components/retroui/Button";
import { cn } from "@/lib/utils";
import { GLASS_CARD } from "@/lib/glass";
import { useFormatCurrency } from "@/lib/use-currency";
import { ICON } from "@/lib/icon-scale";
import type { Locale } from "@finance/core/i18n/locale";
import { LOCALE_LABELS } from "@finance/core/i18n/locale";
import { describeModel } from "@finance/core/model-name";
import { useLocale, useT } from "@/lib/locale-context";

interface MonthReadProps {
  year: number;
  month: number;
  monthLabel: string;
  /** Null when nothing has been written for this month. */
  read: MonthReadValue | null;
  freshness: ReadFreshness | null;
  /** The figures as they stand now — what the read renders against. */
  facts: MonthFacts;
  /**
   * The same figures, labelled in the language the read was written in.
   *
   * Identical to `facts` in the ordinary case. They diverge only after
   * somebody switches language with a read already stored, and then only in
   * their labels — which is exactly what the prose refers to.
   */
  readFacts: MonthFacts;
  /** The language the prose is in, which may not be the reader's. */
  readLocale: Locale;
  writesLeft: number;
  /** Whether a writer exists on this deployment at all. */
  configured: boolean;
  /**
   * The maker, for the control that spends a call — "Write with Mistral".
   *
   * The button said "Write one", and the line beside it said "a model", which
   * between them named neither what would happen nor what would do it.
   */
  writerBrand: string;
  /** The model recorded on the stored read, when there is one. */
  readModel: string | null;
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
  readFacts,
  readLocale,
  writesLeft,
  configured,
  writerBrand,
  readModel,
}: MonthReadProps) {
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const locale = useLocale();
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [left, setLeft] = useState(writesLeft);

  const rendered = read
    ? renderMonthRead(read, readFacts, formatMoney, readLocale)
    : null;
  // Stated rather than smoothed over. A reader who has switched language and
  // finds a paragraph in the old one should be told why, and offered the one
  // action that fixes it — writing a new read — rather than left to wonder
  // whether the app is broken.
  const inAnotherLanguage = Boolean(rendered) && readLocale !== locale;

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
        outcome.message ?? t("monthRead.writtenToast", { month: monthLabel }),
        outcome.written ? "success" : "error",
      );
    });
  }

  return (
    <section
      className={cn("flex flex-col gap-4 rounded-card p-card", GLASS_CARD)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkle size={ICON.sm} className="text-muted-foreground" />
          {t("monthRead.title")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("monthRead.subtitleWeb", { model: writerBrand })}
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
                {t("monthRead.suggestionsHeading")}
              </h3>
              <ul className="flex flex-col gap-2">
                {rendered.suggestions.map((row, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span
                      aria-hidden
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground"
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
          {t("monthRead.empty", { month: monthLabel })}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/10 pt-3">
        <p className="text-xs text-muted-foreground">
          {freshness ? <Standing freshness={freshness} /> : null}
          {inAnotherLanguage ? (
            <>
              {freshness ? " " : null}
              {t("monthRead.writtenInOtherLanguage", {
                language: LOCALE_LABELS[readLocale],
              })}
            </>
          ) : null}
          {/* Which model, exactly — read off the stored read rather than off
              today's configuration, because they are not always the same
              model and this is the sentence that exists to be exact. */}
          {rendered ? (
            <>
              {" "}
              {readModel === null
                ? t("monthRead.writtenByUnknown")
                : t("monthRead.writtenBy", { model: exactModel(readModel) })}
            </>
          ) : null}
        </p>

        {configured ? (
          <Button
            type="button"
            onClick={write}
            disabled={pending || left <= 0}
            variant={left > 0 ? "default" : "ghost"}
            size="sm"
            className={cn(
              "shrink-0 gap-1.5 rounded-full",
              left <= 0 && "cursor-not-allowed text-muted-foreground",
            )}
          >
            {/* The house mark for "a model did this", the same one on the
                card's own heading and on the look-through's Review. */}
            <Sparkle size={ICON.sm} weight="fill" aria-hidden="true" />
            {pending
              ? t("monthRead.writing")
              : left <= 0
                ? t("monthRead.noReadsLeft", { month: monthLabel })
                : rendered
                  ? t("monthRead.writeAgain", { left, model: writerBrand })
                  : t("monthRead.writeOne", { left, model: writerBrand })}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/**
 * "Mistral Large (mistral-large-latest)": the maker, the model and the build.
 *
 * The id is repeated in brackets because it is what someone would compare
 * against a configuration, while the name is what they would recognise. An id
 * this app cannot attribute is shown as it stands — an unfamiliar string
 * beats naming the wrong writer.
 */
function exactModel(modelId: string): string {
  const named = describeModel(modelId);
  return named.full === named.id ? named.id : `${named.full} (${named.id})`;
}

/**
 * How well the read still stands.
 *
 * A month in progress is never called stale, however much has moved: its
 * figures change whenever anything is recorded, so the badge would be lit
 * permanently and a warning that is always on is one nobody reads.
 */
function Standing({ freshness }: { freshness: ReadFreshness }) {
  const t = useT();

  if (freshness.standing === "moved") {
    return (
      <span className="flex items-center gap-1.5 text-foreground">
        <WarningCircle size={ICON.sm} />
        {t("monthRead.standingMoved", {
          count: freshness.moved.length,
          age: freshness.writtenAge,
        })}
      </span>
    );
  }

  if (freshness.standing === "provisional") {
    return (
      <>{t("monthRead.standingProvisional", { age: freshness.writtenAge })}</>
    );
  }

  return <>{t("monthRead.standingWritten", { age: freshness.writtenAge })}</>;
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
