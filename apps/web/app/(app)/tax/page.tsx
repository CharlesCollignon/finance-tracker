import { redirect } from "next/navigation";
import { todayIsoLocal } from "@finance/core/constants";
import {
  incomeYearFor,
  taxReturnBoxes,
  taxRulesFor,
} from "@finance/core/tax-return";
import { getCategories } from "@finance/data/categories";
import { getTaxBoxes, readTaxRows } from "@finance/data/tax-return";
import { TaxView } from "@/components/tax/TaxView";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

/** How many years back the page offers. */
const YEARS_BACK = 3;

/**
 * « Déclaration de revenus »: the boxes of the return the person's own rows
 * fill, for an income year (`?y=`, the year before by default), each with
 * its amount and the rows behind it (`@finance/core/tax-return`). The
 * person's own money, never the space's.
 */
export default async function TaxPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }

  const latest = incomeYearFor(todayIsoLocal());
  const years = Array.from(
    { length: YEARS_BACK },
    (_, index) => latest - index,
  );
  const asked = Number((await searchParams).y);
  const year = years.includes(asked) ? asked : latest;

  const db = await createClient();
  const [rows, filed, categories] = await Promise.all([
    readTaxRows(db, user.id, year),
    getTaxBoxes(db, user.id),
    getCategories(db, user.id),
  ]);
  const { rules, provisional } = taxRulesFor(year);

  return (
    <>
      <PageHeader titleKey="tax.title" />
      <PageContainer>
        <TaxView
          year={year}
          years={years}
          formsYear={year + 1}
          rulesFormsYear={rules.formsYear}
          provisional={provisional}
          boxes={taxReturnBoxes(rules, rows, filed)}
          filed={Object.fromEntries(filed)}
          categories={categories
            .filter((category) => category.type === "expense")
            .map(({ id, name }) => ({ id, name }))}
        />
      </PageContainer>
    </>
  );
}
