import { formatMonthLabel } from "@finance/core/constants";
import { writesRemaining } from "@finance/core/month-read-budget";
import { describeModel } from "@finance/core/model-name";
import { MonthRead } from "@/components/finance/MonthRead";
import { getLocale } from "@/lib/locale";
import { GLASS_CARD } from "@/lib/glass";
import { monthReadConfigured, monthReadModel } from "@/lib/month-read/client";
import { gatherMonthFacts } from "@/lib/month-read/facts";
import { readMonthReadState } from "@/lib/month-read/store";
import { getMonthRead } from "@/lib/queries/month-read";
import { cn } from "@/lib/utils";

/**
 * A few written sentences on the month, under its figures.
 *
 * Streamed in behind its own boundary rather than gathered with the rest of
 * the page: the fact pack a read is written against is the slowest thing the
 * Bearing asks for, and the balance above should not wait on it. Nothing here
 * calls a model — the card renders the read somebody already asked for, and
 * only the button on it spends.
 *
 * Two packs rather than one whenever the stored read is in a language the
 * reader is not in: the prose refers to figures by their labels, so the
 * labels have to be the ones it was written against.
 */
export async function MonthReadSlot({
  userId,
  year,
  month,
}: {
  userId: string;
  year: number;
  month: number;
}) {
  const locale = await getLocale();
  const facts = await gatherMonthFacts(userId, year, month);

  const [view, { stored }] = await Promise.all([
    getMonthRead(userId, year, month, facts),
    readMonthReadState(userId, year, month),
  ]);

  const readFacts =
    view && view.locale !== locale
      ? await gatherMonthFacts(userId, year, month, undefined, view.locale)
      : facts;

  return (
    <section className={cn(GLASS_CARD, "rounded-card p-card")}>
      <MonthRead
        year={year}
        month={month}
        monthLabel={formatMonthLabel(year, month, locale)}
        read={view?.read ?? null}
        freshness={view?.freshness ?? null}
        facts={facts}
        readFacts={readFacts}
        readLocale={view?.locale ?? locale}
        writesLeft={writesRemaining(stored?.tally ?? null)}
        configured={monthReadConfigured()}
        writerBrand={describeModel(monthReadModel()).brand}
        readModel={stored?.read ? stored.model : null}
      />
    </section>
  );
}
