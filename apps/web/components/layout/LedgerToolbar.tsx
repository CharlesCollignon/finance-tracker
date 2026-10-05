"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { parseMonthParams, todayIsoLocal } from "@finance/core/constants";
import { Button, ButtonNub } from "@/components/ui/Button";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { useQuickAdd } from "@/components/layout/QuickAddProvider";
import { LEDGER_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

/**
 * The Ledger's toolbar, drawn once by the views' layout: the views, the
 * month and Add in one row from `lg`, the month in the middle, because it is
 * what everything below is about. Narrower, the month takes a row of its own
 * under the views — under rather than over, so the views stay where they are
 * on the one view that has no month, By category.
 *
 * In the layout rather than in each view, so that switching views leaves it
 * where it is while the view under it loads. What differs between the views
 * is read from the address, as the month picker already reads its month.
 */
export function LedgerToolbar() {
  const t = useT();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const quickAdd = useQuickAdd();

  const dated = pathname === "/transactions" || pathname === "/calendar";
  const { year, month } = parseMonthParams(
    searchParams.get("y") ?? undefined,
    searchParams.get("m") ?? undefined,
  );
  // Today while reading this month; the month's first day while reading
  // another, so an entry added from there lands in the month on screen.
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const addDate = todayIsoLocal().startsWith(firstDay.slice(0, 7))
    ? undefined
    : firstDay;

  return (
    <div className="mb-4 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 lg:grid-cols-[1fr_auto_1fr]">
      <SurfaceTabs tabs={LEDGER_TABS} className="min-w-0" />
      {dated ? (
        <MonthPicker
          basePath={pathname}
          className="col-span-2 row-start-2 justify-self-center lg:col-span-1 lg:col-start-2 lg:row-start-1"
        />
      ) : null}
      {pathname === "/transactions" ? (
        <div className="flex shrink-0 items-center gap-2 justify-self-end lg:col-start-3 lg:row-start-1">
          {/* A phone has the floating add button; this is the desktop's.
              The same sheet as the notch's "+", opened on the month being
              read when that is not this one. On the list only: the
              calendar's Add is under it, beside the day it adds to. */}
          <Button
            variant="pill"
            size="sm"
            className="hidden md:inline-flex"
            onClick={() => quickAdd?.open({ date: addDate })}
          >
            {t("ledger.add")}
            <ButtonNub>
              <Plus size={ICON.md} weight="bold" />
            </ButtonNub>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
