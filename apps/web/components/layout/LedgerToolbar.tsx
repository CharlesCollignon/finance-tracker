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
 * The Ledger's toolbar, drawn once by the views' layout: the four views
 * centred at the top, on a row of their own at every width (the owner's
 * call, November 2026), then the month in the middle under them, because it
 * is what everything below is about, with Add at the end of that row. The
 * views come first so they stay where they are on the views that have no
 * month, By category and By shop.
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
    <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2">
      <SurfaceTabs
        tabs={LEDGER_TABS}
        className="col-span-3 min-w-0 max-w-full justify-self-center"
      />
      {dated ? (
        <MonthPicker
          basePath={pathname}
          className="col-start-2 row-start-2 justify-self-center"
        />
      ) : null}
      {pathname === "/transactions" ? (
        <div className="col-start-3 row-start-2 flex shrink-0 items-center gap-2 justify-self-end">
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
