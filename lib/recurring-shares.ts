import { formatEuro } from "@/lib/constants";
import { fetchInstrumentQuoteInEur, formatMoney } from "@/lib/market/fx";
import {
  computeSharesAmount,
  fetchInstrumentQuote,
} from "@/lib/market/yahoo";

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

export async function resolveRecurringAmount(
  template: SharesTemplateFields,
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

  const live = await fetchInstrumentQuoteInEur(
    template.instrument_symbol,
  ).then(
    (quote) => ({
      priceEur: quote.priceEur,
      priceOriginal: quote.priceOriginal,
      currency: quote.currency,
      amount: computeSharesAmount(template.share_count!, quote.priceEur),
      quotedAt: new Date().toISOString(),
    }),
    () => null,
  );

  let price = live?.priceEur ?? null;
  let amount = live?.amount ?? null;
  let quotedAt = live?.quotedAt ?? null;

  if (price === null && template.last_quote_price) {
    price = Number(template.last_quote_price);
    amount = Math.round(template.share_count * price * 100) / 100;
  }

  if (price === null || amount === null) {
    throw new Error("Could not resolve a price for this instrument.");
  }

  const priceLabel =
    live && live.currency !== "EUR"
      ? `${formatEuro(price)} (${formatMoney(live.priceOriginal, live.currency)} / share)`
      : formatEuro(price);
  const shareNote =
    `${template.share_count} × ` +
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
