import { formatEuro } from "./constants";
import { formatMoney } from "./market/fx";
import type { QuoteSource } from "./market/quote-source";
import { computeSharesAmount } from "./market/yahoo";

interface SharesTemplateFields {
  pricing_type: string | null;
  amount: number;
  share_count: number | null;
  instrument_symbol: string | null;
  instrument_name: string | null;
  description: string | null;
  last_quote_price: number | null;
}

export interface ResolvedRecurringAmount {
  amount: number;
  note: string | null;
  quoteUpdate: {
    amount: number;
    last_quote_price: number;
    last_quote_at: string;
  } | null;
}

/**
 * Amount and note for one occurrence of a template. Fixed pricing never
 * consults `quotes`; shares pricing falls back to `last_quote_price` when the
 * source has no price, and throws when there is nothing to fall back to.
 */
export async function resolveRecurringAmount(
  template: SharesTemplateFields,
  quotes: QuoteSource,
): Promise<ResolvedRecurringAmount> {
  if (
    template.pricing_type !== "shares" ||
    !template.share_count ||
    !template.instrument_symbol
  ) {
    return {
      amount: Number(template.amount),
      note: template.description?.trim() || null,
      quoteUpdate: null,
    };
  }

  const shareCount = template.share_count;
  const live = await quotes.quoteInEur(template.instrument_symbol);

  let price = live?.priceEur ?? null;
  let amount = live ? computeSharesAmount(shareCount, live.priceEur) : null;
  const quotedAt = live?.quotedAt ?? null;

  if (price === null && template.last_quote_price) {
    price = Number(template.last_quote_price);
    amount = computeSharesAmount(shareCount, price);
  }

  if (price === null || amount === null) {
    throw new Error("Could not resolve a price for this instrument.");
  }

  const priceLabel =
    live && live.currency !== "EUR"
      ? `${formatEuro(price)} (${formatMoney(live.priceOriginal, live.currency)} / share)`
      : formatEuro(price);
  const shareNote =
    `${shareCount} × ` +
    `${template.instrument_name ?? template.instrument_symbol} @ ${priceLabel}`;

  const note = template.description?.trim()
    ? `${template.description.trim()} · ${shareNote}`
    : shareNote;

  return {
    amount,
    note,
    quoteUpdate: quotedAt
      ? {
          amount,
          last_quote_price: price,
          last_quote_at: quotedAt,
        }
      : null,
  };
}

export function formatSharesLabel(template: {
  share_count: number | null;
  instrument_name: string | null;
  instrument_symbol: string | null;
}): string | null {
  if (!template.share_count) {
    return null;
  }

  const label =
    template.instrument_name ?? template.instrument_symbol ?? "Instrument";

  return `${template.share_count} × ${label}`;
}
