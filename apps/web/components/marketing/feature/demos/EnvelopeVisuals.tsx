"use client";

import { useState } from "react";
import { m, useReducedMotion } from "motion/react";
import { CurrencyBtc } from "@phosphor-icons/react";
import { formatEuro, formatFullDate } from "@finance/core/constants";
import { FRENCH_TAX_2026 } from "@finance/core/future-plan";
import { INTL_LOCALES } from "@finance/core/i18n/locale";
import { buildPeaStatus, peaMaturityHint } from "@finance/core/pea";
import { FRENCH_SAVINGS_2026 } from "@finance/core/savings-accounts";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import { Count } from "./parts";

/**
 * What each envelope's card opens on: one small moving picture of the thing
 * that envelope is about — the PEA's ceiling and clock, life insurance's
 * eight years, the brokerage account's currencies, the PER's tax box,
 * bitcoin's two faces, a livret filling to its ceiling.
 *
 * The PEA is the sample person's own, so it agrees with the screen above;
 * the others are illustrations, and their figures are written here. Every
 * rule — the ceilings, the rates, the clocks — comes from `@finance/core`,
 * where the app reads them too.
 */

type Items = LocalisedLandingCopy["demos"]["wallets"]["envelopes"]["items"];

const EASE = [0.32, 0.72, 0, 1] as const;

/** The day the sample month is seen from: the 19th of March 2026. */
const TODAY = "2026-03-19";

export function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}

function usePercentOf() {
  const locale = useLocale();
  return (fraction: number) =>
    new Intl.NumberFormat(INTL_LOCALES[locale], {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(fraction);
}

/* --------------------------------------------------------------------- PEA */

/** The ceiling, filling to what was paid in, and the five-year ring. */
export function PeaVisual({ copy }: { copy: Items["pea"] }) {
  const locale = useLocale();
  const sample = landingSampleFor(locale);
  const euro = (value: number) => formatEuro(Math.round(value), locale);
  const paidIn = sample.wallets.find((wallet) => wallet.id === "pea")!.invested;
  const status = buildPeaStatus(paidIn, sample.pea.openedOn, TODAY);
  const elapsed =
    (Date.parse(TODAY) - Date.parse(status.openedOn!)) /
    (Date.parse(status.maturesOn!) - Date.parse(status.openedOn!));
  const radius = 42;

  return (
    <div className="grid items-center gap-8 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-marketing-muted">
          {copy.paidIn}
          <Count
            from={0}
            value={paidIn}
            format={euro}
            className="font-serif text-3xl text-marketing-ink"
          />
          {fill(copy.of, { ceiling: euro(status.ceiling) })}
        </p>
        <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-white/[0.07]">
          <m.span
            className="absolute inset-y-0 left-0 rounded-full bg-primary shadow-[0_0_16px_rgb(236_178_94/0.7)]"
            initial={{ width: "0%" }}
            animate={{ width: `${Math.max(status.ratio * 100, 2)}%` }}
            transition={{ duration: 1.2, ease: EASE, delay: 0.2 }}
          />
          {/* A tick a tenth of the way along each, so the scale reads. */}
          {Array.from({ length: 9 }, (_, index) => (
            <span
              key={index}
              className="absolute inset-y-0 w-px bg-white/10"
              style={{ left: `${(index + 1) * 10}%` }}
            />
          ))}
        </div>
        <p className="mt-3 text-sm text-marketing-faint">
          {fill(copy.left, { amount: euro(status.headroom) })}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="size-28 -rotate-90" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgb(255 255 255 / 0.08)"
            strokeWidth="7"
          />
          <m.circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="7"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: elapsed }}
            transition={{ duration: 1.4, ease: EASE, delay: 0.3 }}
          />
        </svg>
        <div className="max-w-[12rem] text-sm">
          <p className="font-head text-lg text-marketing-ink">{copy.clock}</p>
          <p className="mt-1 text-marketing-muted">
            {fill(copy.opened, {
              date: formatFullDate(status.openedOn!, locale),
            })}
          </p>
          <p className="mt-1 text-marketing-faint">
            {peaMaturityHint(status, locale)}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- life insurance */

/** A contract in its seventh year: eight years, lit one by one. */
const AV_YEAR = 7;

export function AvVisual({ copy }: { copy: Items["av"] }) {
  const locale = useLocale();
  const euro = (value: number) => formatEuro(Math.round(value), locale);
  const { single, couple } = FRENCH_TAX_2026.lifeInsuranceAllowance;
  return (
    <div className="flex flex-col gap-7">
      <div>
        <div className="flex gap-1.5">
          {Array.from({ length: 8 }, (_, index) => {
            const lit = index < AV_YEAR;
            const last = index === 7;
            return (
              <m.span
                key={index}
                className={cn(
                  "h-10 flex-1 rounded-lg border",
                  last
                    ? "border-primary/70 border-dashed"
                    : "border-transparent",
                )}
                initial={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                animate={{
                  backgroundColor: lit
                    ? "rgba(236,178,94,0.85)"
                    : "rgba(255,255,255,0.06)",
                }}
                transition={{ delay: 0.15 + index * 0.09, duration: 0.4 }}
              />
            );
          })}
        </div>
        <p className="mt-3 text-sm text-marketing-muted">
          {fill(copy.progress, { count: String(AV_YEAR) })}
        </p>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Count
          from={0}
          value={single}
          format={euro}
          className="font-serif text-4xl text-marketing-ink"
        />
        <span className="max-w-xs text-sm text-marketing-muted">
          {copy.allowance}
        </span>
        <span className="w-full text-sm text-marketing-faint">
          {fill(copy.couple, { amount: euro(couple) })}
        </span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- brokerage account */

/**
 * Three shares priced abroad, each arriving in euros. The rates are a day's
 * in early 2026, for the picture; the app takes them from the market.
 */
const QUOTES = [
  { currency: "USD", price: 228.4, eur: 196.9 },
  { currency: "GBP", price: 48.2, eur: 56.7 },
  { currency: "CHF", price: 96.1, eur: 102.3 },
] as const;

export function CtoVisual({ copy }: { copy: Items["cto"] }) {
  const locale = useLocale();
  const euro = (value: number) =>
    new Intl.NumberFormat(INTL_LOCALES[locale], {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(value);
  return (
    <ul className="flex flex-col gap-3">
      {QUOTES.map((quote, index) => (
        <m.li
          key={quote.currency}
          className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_3.5rem_auto]"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 + index * 0.12, duration: 0.6, ease: EASE }}
        >
          <span className="truncate text-sm text-marketing-muted">
            {copy.quotes[index]}
          </span>
          <span className="font-mono text-sm text-marketing-faint">
            {new Intl.NumberFormat(INTL_LOCALES[locale], {
              style: "currency",
              currency: quote.currency,
            }).format(quote.price)}
          </span>
          <svg
            viewBox="0 0 56 12"
            className="hidden h-3 w-14 sm:block"
            aria-hidden
          >
            <m.path
              d="M2 6 H48 M42 1 L50 6 L42 11"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{
                delay: 0.4 + index * 0.12,
                duration: 0.7,
                ease: EASE,
              }}
            />
          </svg>
          <Count
            from={0}
            value={quote.eur}
            format={euro}
            className="col-start-2 text-right font-mono text-base text-marketing-ink sm:col-start-auto"
          />
        </m.li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------- retirement plan */

/** Twelve months of 200 € dropping into the box the tax page fills. */
const PER_MONTHLY = 200;

export function PerVisual({ copy }: { copy: Items["per"] }) {
  const locale = useLocale();
  const euro = (value: number) => formatEuro(Math.round(value), locale);
  const year = 2025;
  return (
    <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <p className="text-sm text-marketing-muted">
          {fill(copy.paid, { year: String(year) })}
        </p>
        <div className="mt-3 grid grid-cols-6 gap-1.5">
          {Array.from({ length: 12 }, (_, index) => (
            <m.span
              key={index}
              className="flex h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] font-mono text-[11px] text-marketing-muted"
              initial={{ opacity: 0, y: -14, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: 0.1 + index * 0.06,
                type: "spring",
                stiffness: 380,
                damping: 22,
              }}
            >
              {euro(PER_MONTHLY)}
            </m.span>
          ))}
        </div>
      </div>
      <m.div
        className="rounded-2xl border-2 border-primary/60 bg-primary/[0.06] px-6 py-5 text-center shadow-[0_0_40px_-12px_rgb(236_178_94/0.6)]"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.8, type: "spring", stiffness: 260, damping: 18 }}
      >
        <p className="font-mono text-xs tracking-widest text-primary">
          {copy.box}
        </p>
        <Count
          from={0}
          value={PER_MONTHLY * 12}
          format={euro}
          className="mt-1 block font-serif text-3xl text-marketing-ink"
        />
      </m.div>
    </div>
  );
}

/* ------------------------------------------------------------------ crypto */

/** The sample's bitcoin: one face in coins, the other in euros. */
export function CryptoVisual({ copy }: { copy: Items["crypto"] }) {
  const locale = useLocale();
  const sample = landingSampleFor(locale);
  const still = useReducedMotion() ?? false;
  const [flipped, setFlipped] = useState(false);
  const value = sample.wallets.find((wallet) => wallet.id === "crypto")!.value;
  const btc = new Intl.NumberFormat(INTL_LOCALES[locale], {
    maximumFractionDigits: 8,
  }).format(sample.btc);

  const face =
    "absolute inset-0 flex flex-col items-center justify-center rounded-full [backface-visibility:hidden]";
  return (
    <div className="flex flex-wrap items-center gap-8">
      <button
        type="button"
        onClick={() => setFlipped((side) => !side)}
        aria-label={copy.flip}
        aria-pressed={flipped}
        className="rounded-full [perspective:800px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <m.span
          className="relative block size-36 [transform-style:preserve-3d]"
          animate={{ rotateY: flipped ? 180 : 0 }}
          whileHover={still ? undefined : { scale: 1.05 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
        >
          <span
            className={cn(
              face,
              "border-2 border-primary/70 [background:radial-gradient(circle_at_35%_30%,#f6d79a,#ecb25e_45%,#9a6a26)] text-[#3a2508] shadow-[0_20px_40px_-16px_rgb(236_178_94/0.6)]",
            )}
          >
            <CurrencyBtc size={56} weight="bold" />
            <span className="mt-2 font-mono text-xs">{btc} BTC</span>
          </span>
          <span
            className={cn(
              face,
              "border-2 border-white/20 [background:radial-gradient(circle_at_35%_30%,#3a3a4a,#1a1a26_60%,#0d0d14)] text-marketing-ink [transform:rotateY(180deg)]",
            )}
          >
            <span className="font-serif text-3xl">
              {formatEuro(value, locale)}
            </span>
          </span>
        </m.span>
      </button>
      <div className="text-sm">
        <p className="text-marketing-muted">{copy.flip}</p>
        <p className="mt-1 font-mono text-marketing-faint">
          {fill(copy.price, {
            price: formatEuro(Math.round(value / sample.btc), locale),
          })}
        </p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- livrets */

/** A Livret A part-way to its ceiling. */
const LIVRET_BALANCE = 8400;

export function LivretVisual({ copy }: { copy: Items["livret"] }) {
  const locale = useLocale();
  const percent = usePercentOf();
  const euro = (value: number) => formatEuro(Math.round(value), locale);
  const { ceiling, rate } = FRENCH_SAVINGS_2026.livret_a;
  const share = LIVRET_BALANCE / ceiling!;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-baseline gap-2 text-sm text-marketing-muted">
          {copy.balance}
          <Count
            from={0}
            value={LIVRET_BALANCE}
            format={euro}
            className="font-serif text-3xl text-marketing-ink"
          />
        </p>
        <span className="font-mono text-sm text-marketing-faint">
          {euro(ceiling!)}
        </span>
      </div>
      <div className="relative h-14 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <m.div
          className="absolute inset-y-0 left-0 [background:linear-gradient(90deg,rgb(236_178_94/0.25),rgb(236_178_94/0.6))]"
          initial={{ width: "0%" }}
          animate={{ width: `${share * 100}%` }}
          transition={{ duration: 1.4, ease: EASE, delay: 0.2 }}
        >
          <span className="absolute inset-y-0 right-0 w-0.5 bg-primary shadow-[0_0_12px_rgb(236_178_94/0.9)]" />
        </m.div>
        <span className="absolute inset-y-0 right-0 flex items-center px-4 font-mono text-sm text-primary">
          {percent(rate)}
        </span>
      </div>
      <p className="text-sm text-marketing-muted">
        {fill(copy.interest, {
          amount: euro(Math.round(LIVRET_BALANCE * rate)),
        })}
      </p>
    </div>
  );
}

/** The rules each card's « tax » line quotes, filled in the reader's way. */
export function useEnvelopeFacts() {
  const locale = useLocale();
  const percent = usePercentOf();
  const euro = (value: number) => formatEuro(value, locale);
  const tax = FRENCH_TAX_2026;
  return {
    pea: {
      badge: { ceiling: euro(tax.peaContributionCeiling) },
      tax: { rate: percent(tax.socialContributions) },
    },
    av: {
      badge: {},
      tax: {
        allowance: euro(tax.lifeInsuranceAllowance.single),
        couple: euro(tax.lifeInsuranceAllowance.couple),
        rate: percent(
          tax.lifeInsuranceAfterEightYears -
            tax.socialContributionsLifeInsurance,
        ),
        social: percent(tax.socialContributionsLifeInsurance),
      },
    },
    cto: { badge: {}, tax: { rate: percent(tax.flatTax) } },
    per: { badge: {}, tax: {} },
    crypto: {
      badge: {},
      tax: {
        rate: percent(tax.flatTax),
        exemption: euro(tax.cryptoYearlyExemption),
      },
    },
    livret: {
      badge: { rate: percent(FRENCH_SAVINGS_2026.livret_a.rate) },
      tax: { ceiling: euro(FRENCH_SAVINGS_2026.livret_a.ceiling!) },
    },
  } satisfies Record<
    keyof Items,
    { badge: Record<string, string>; tax: Record<string, string> }
  >;
}
