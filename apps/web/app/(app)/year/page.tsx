import { redirect } from "next/navigation";
import { todayIsoLocal } from "@finance/core/constants";
import { reviewedYear } from "@finance/core/year-review";
import { readYearReview } from "@finance/data/year-review";
import { getAuthUser } from "@/lib/auth/get-user";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import { YearReviewView } from "@/components/finance/YearReviewView";

interface YearPageProps {
  /** `?y=` for a year other than the one January reviews. */
  searchParams: Promise<{ y?: string }>;
}

export const metadata = {
  title: "Votre année",
};

/**
 * « Votre année »: the year before, in January; any year gone by with `?y=`.
 */
export default async function YearPage({ searchParams }: YearPageProps) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }
  const today = todayIsoLocal();
  const current = Number(today.slice(0, 4));
  const asked = Number((await searchParams).y);
  const year =
    Number.isInteger(asked) && asked >= 2000 && asked < current
      ? asked
      : (reviewedYear(today) ?? current - 1);
  const locale = await getLocale();
  const review = await readYearReview(await createClient(), user.id, year, {
    today,
    locale,
  });
  return <YearReviewView year={year} review={review} />;
}
