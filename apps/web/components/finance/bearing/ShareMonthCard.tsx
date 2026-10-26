"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer, ShareNetwork } from "@phosphor-icons/react";
import { formatMonthLabel } from "@finance/core/constants";
import { Card } from "@/components/finance/bearing/card-parts";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/**
 * « Partager ce mois »: the month as an image for the share sheet (or a
 * download where there is none), and as a page to print or save as a PDF
 * — with the amounts, or with the shares and a sign only. The image is
 * `/api/month-share/image`, drawn for the account asking and kept
 * nowhere. The phone shares the image through its own sheet.
 */
export function ShareMonthCard({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const t = useT();
  const locale = useLocale();
  const [withAmounts, setWithAmounts] = useState(false);
  const [pending, setPending] = useState(false);
  const monthLabel = formatMonthLabel(year, month, locale);
  const src = `/api/month-share/image?y=${year}&m=${month}&l=${locale}&amounts=${withAmounts ? 1 : 0}`;
  const fileName = `pluclair-${year}-${String(month).padStart(2, "0")}.png`;

  async function share() {
    setPending(true);
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: t("monthShare.title", { month: monthLabel }),
        });
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      // Cancelled, or the browser refused: nothing to say.
    } finally {
      setPending(false);
    }
  }

  return (
    <Card
      icon={<ShareNetwork size={ICON.sm} weight="bold" />}
      title={t("monthShare.share")}
    >
      {/* The whole row of Le point's grid: the words on the left, the
          switch and the two ways out on the right, once there is room. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
        <p className="text-sm text-muted-foreground md:max-w-prose">
          {t("monthShare.shareHint")}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:shrink-0 md:justify-end">
          <label className="flex items-center gap-2 text-sm">
            <span>{t("monthShare.withAmounts")}</span>
            <Switch
              checked={withAmounts}
              onChange={setWithAmounts}
              label={t("monthShare.withAmounts")}
            />
          </label>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => void share()}
            className="gap-2"
          >
            <ShareNetwork size={ICON.md} aria-hidden />
            {t("monthShare.shareImage")}
          </Button>
          <Link
            href={`/print/month?y=${year}&m=${month}&amounts=${withAmounts ? 1 : 0}`}
            target="_blank"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-2",
            )}
          >
            <Printer size={ICON.md} aria-hidden />
            {t("monthShare.sharePrint")}
          </Link>
        </div>
      </div>
    </Card>
  );
}
