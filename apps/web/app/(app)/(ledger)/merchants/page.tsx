import { redirect } from "next/navigation";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import { readMerchantScreen } from "@finance/data/merchant-screen";
import { MerchantView } from "@/components/finance/merchant/MerchantView";
import { getAuthUser } from "@/lib/auth/get-user";
import { getLocale } from "@/lib/locale";
import { getOwner } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";

interface MerchantsPageProps {
  /** `?q=`: the words to find, when the page was opened with some. */
  searchParams: Promise<{ q?: string }>;
}

/**
 * The by-shop view: every place the money went over the last twelve
 * months, one card a shop — what `@finance/data/merchant-screen` gathers,
 * shared with the phone. No month above it, like By category: it reads a
 * year whatever month is shown elsewhere.
 */
export default async function MerchantsPage({
  searchParams,
}: MerchantsPageProps) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }

  const [db, locale, owner, params] = await Promise.all([
    createClient(),
    getLocale(),
    getOwner(),
    searchParams,
  ]);
  const { year, month } = getCurrentMonth();
  const screen = await readMerchantScreen(db, owner?.ownerId ?? user.id, {
    year,
    month,
    locale,
  });

  return (
    <MerchantView
      screen={screen}
      today={todayIsoLocal()}
      initialQuery={typeof params.q === "string" ? params.q.slice(0, 80) : ""}
    />
  );
}
