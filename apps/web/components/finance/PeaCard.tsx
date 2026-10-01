"use client";

import { useState, useTransition } from "react";
import { formatWeight } from "@finance/core/allocation";
import { todayIsoLocal } from "@finance/core/constants";
import type { InvestmentColumnSummary } from "@finance/core/investment-positions";
import { buildPeaStatus, peaMaturityHint } from "@finance/core/pea";
import type { WalletPlan } from "@finance/core/types/database";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { useToast } from "@/components/layout/ToastProvider";
import { saveWalletPlan } from "@/lib/actions/investments";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

/**
 * The PEA's own two facts: how much room is left under the ceiling, and when
 * the five-year clock is reached. Shown with the PEA itself on Comptes, since
 * both are about that one account and the date is typed in here.
 */
export function PeaCard({
  column,
  plan,
}: {
  column: InvestmentColumnSummary;
  plan: WalletPlan | undefined;
}) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const status = buildPeaStatus(
    column.totalInvested,
    plan?.opened_on ?? null,
    todayIsoLocal(),
    plan?.contribution_ceiling ? Number(plan.contribution_ceiling) : undefined,
  );

  return (
    <Card.Bezel className="w-full" innerClassName="p-5 md:p-6">
      <h2 className="font-head text-base">PEA</h2>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {t("position.peaPaidIn")}{" "}
          <span className="privacy-amount tabular-nums text-foreground">
            {formatEuro(status.contributed)}
          </span>{" "}
          {t("position.peaOfCeiling", {
            ceiling: formatEuro(status.ceiling),
          })}{" "}
          —{" "}
          <span className="privacy-amount tabular-nums">
            {formatWeight(status.ratio, locale)}
          </span>
        </span>
        <span
          className={cn(
            "tabular-nums",
            status.nearCeiling ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <span className="privacy-amount">{formatEuro(status.headroom)}</span>{" "}
          {t("position.peaRoomLeft")}
        </span>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {t("position.peaCashOnly")}
      </p>

      <PeaOpenedField
        openedOn={plan?.opened_on ?? null}
        hint={peaMaturityHint(status, locale)}
      />
    </Card.Bezel>
  );
}

/** The one date that starts a PEA's five-year clock. */
function PeaOpenedField({
  openedOn,
  hint,
}: {
  openedOn: string | null;
  hint: string | null;
}) {
  const t = useT();
  const { toast } = useToast();
  const [value, setValue] = useState(openedOn ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
      <label htmlFor="pea-opened" className="text-sm font-medium">
        {t("position.openedOn")}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="pea-opened"
          type="date"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-10 min-h-11 lg:min-h-0 rounded-control border border-border bg-background px-3 text-base"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={pending || value === (openedOn ?? "")}
          onClick={() =>
            startTransition(async () => {
              const result = await saveWalletPlan({
                wallet: "pea",
                openedOn: value,
              });
              if (result.error) {
                toast(result.error, "error");
                return;
              }
              toast(t("position.saved"), "success");
            })
          }
        >
          {pending ? t("position.saving") : t("position.save")}
        </Button>
      </div>
      {hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("position.peaOpenedHint")}
        </p>
      )}
    </div>
  );
}
