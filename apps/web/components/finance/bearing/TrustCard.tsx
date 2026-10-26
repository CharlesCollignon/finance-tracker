"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  MinusCircle,
  ShieldCheck,
} from "@phosphor-icons/react";
import { formatShortDate } from "@finance/core/constants";
import type { TrustSignal } from "@finance/core/month-trust";
import { Card } from "@/components/finance/bearing/card-parts";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------- what backs the month */

/**
 * « Fiabilité du mois »: what the month's figures rest on, one fact a line
 * — how far the bank's or a statement's lines reach, the charges arrived
 * and awaited, what waits in the review, and the close and what it found.
 * Each line is a measurement from `@finance/core/month-trust`; a line with
 * somewhere to go is a link there. The phone draws the same card.
 */
export function TrustCard({ signals }: { signals: TrustSignal[] }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();

  return (
    <Card
      icon={<ShieldCheck size={ICON.sm} weight="bold" />}
      title={t("bearingMonth.trust.title")}
    >
      <ul className="flex flex-col gap-2">
        {signals.map((signal) => {
          const text = t(signal.messageKey, {
            ...signal.params,
            ...(signal.amount !== undefined
              ? { amount: format(signal.amount) }
              : {}),
            ...(signal.date
              ? { date: formatShortDate(signal.date, locale) }
              : {}),
          });
          const body = (
            <>
              <ToneIcon tone={signal.tone} />
              <span
                className={cn(
                  "min-w-0 flex-1 text-sm",
                  signal.tone === "none" && "text-muted-foreground",
                )}
              >
                {signal.amount !== undefined ? (
                  <PrivateAmount>{text}</PrivateAmount>
                ) : (
                  text
                )}
              </span>
            </>
          );
          return (
            <li key={signal.id}>
              {signal.href ? (
                <Link
                  href={signal.href}
                  className="group -mx-1 flex items-center gap-2.5 rounded-control px-1 py-1 transition-colors duration-hover hover:bg-muted/40"
                >
                  {body}
                  <ArrowRight
                    size={ICON.sm}
                    className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              ) : (
                <div className="flex items-center gap-2.5 px-1 py-1">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** The line's state, by colour and shape; the sentence says it in words. */
function ToneIcon({ tone }: { tone: TrustSignal["tone"] }) {
  if (tone === "ok") {
    return (
      <CheckCircle
        size={ICON.md}
        weight="fill"
        className="shrink-0 text-success"
        aria-hidden
      />
    );
  }
  if (tone === "waiting") {
    return (
      <Clock
        size={ICON.md}
        weight="fill"
        className="shrink-0 text-warning"
        aria-hidden
      />
    );
  }
  return (
    <MinusCircle
      size={ICON.md}
      className="shrink-0 text-muted-foreground"
      aria-hidden
    />
  );
}
