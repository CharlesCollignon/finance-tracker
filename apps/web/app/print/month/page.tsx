import Link from "next/link";
import { redirect } from "next/navigation";
import {
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
  getCurrentMonth,
  parseMonthParams,
} from "@finance/core/constants";
import { amountSign } from "@finance/core/amount-sign";
import { translator } from "@finance/core/i18n/t";
import { PrintButton } from "@/components/finance/bearing/PrintButton";
import { getAuthUser } from "@/lib/auth/get-user";
import { readMonthShare } from "@/lib/bearing/share";
import { getLocale } from "@/lib/locale";
import { getOwner } from "@/lib/owner";
import { getTransactions } from "@/lib/queries/finance";
import { createClient } from "@/lib/supabase/server";

interface PrintMonthPageProps {
  searchParams: Promise<{ y?: string; m?: string; amounts?: string }>;
}

export const metadata = { title: "Relevé du mois" };

/**
 * « Relevé du mois », as a page to print — the browser's print dialog
 * saves it as a PDF. Outside the app shell on purpose: nothing but the
 * month, its lines, its spending and its rows. The owner on screen's, as
 * Le point is; `?amounts=0` keeps every amount off it.
 */
export default async function PrintMonthPage({
  searchParams,
}: PrintMonthPageProps) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }
  const [params, locale, owner, db] = await Promise.all([
    searchParams,
    getLocale(),
    getOwner(),
    createClient(),
  ]);
  const ownerId = owner?.ownerId ?? user.id;
  const { year, month } =
    params.y && params.m
      ? parseMonthParams(params.y, params.m)
      : getCurrentMonth();
  const withAmounts = params.amounts !== "0";
  const t = translator(locale);
  const [share, rows] = await Promise.all([
    readMonthShare(db, ownerId, year, month, locale, withAmounts),
    withAmounts ? getTransactions(ownerId, year, month) : Promise.resolve([]),
  ]);
  const money = (amount: number) => formatCurrency(amount, "EUR", locale);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-10 print:px-0 print:py-0">
      <header className="flex items-start justify-between gap-4 print:hidden">
        <Link
          href={`/bearing?y=${year}&m=${month}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("monthShare.back")}
        </Link>
        <PrintButton label={t("monthShare.print")} />
      </header>

      <h1 className="font-serif text-3xl font-semibold">{share.title}</h1>

      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-base">
        {share.lines.map((line) => (
          <div key={line.id} className="contents">
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd className="text-right font-semibold tabular-nums">{line.figure}</dd>
          </div>
        ))}
      </dl>

      {share.categories.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("monthShare.whereItWent")}
          </h2>
          <ul className="flex flex-col gap-2">
            {share.categories.map((category) => (
              <li key={category.name} className="flex flex-col gap-1">
                <div className="flex justify-between gap-4 text-sm">
                  <span>{category.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {category.figure}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted print:bg-neutral-200">
                  <div
                    className="h-1.5 rounded-full bg-primary print:bg-neutral-800"
                    style={{ width: `${Math.max(2, Math.round(category.ratio * 100))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rows.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("monthShare.printEntries")}
          </h2>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="py-1.5 pr-3 align-top text-muted-foreground tabular-nums">
                    {formatShortDate(row.occurred_on, locale)}
                  </td>
                  <td className="py-1.5 pr-3 align-top">
                    <span className="block">{row.categories.name}</span>
                    {row.note ? (
                      <span className="block text-xs text-muted-foreground">
                        {row.note}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 text-right align-top tabular-nums">
                    {amountSign(row.categories.type)}
                    {money(Number(row.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {t("monthShare.madeWith")} · {formatMonthLabel(year, month, locale)}
      </p>
    </main>
  );
}
