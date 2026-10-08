"use client";

import { useState } from "react";
import { DownloadSimple, ShareNetwork } from "@phosphor-icons/react";
import { yearReviewCards, type YearReview } from "@finance/core/year-review";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { GLASS_CARD, GLASS_HERO } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { FIGURE_HERO } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

/**
 * « Votre année »: the year in a few tall cards, one figure each, then the
 * image to share — the same cards with no amount in them, drawn by
 * `/api/year-review/image`.
 */
export function YearReviewView({
  year,
  review,
}: {
  year: number;
  review: YearReview | null;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();

  if (!review) {
    return (
      <>
        <PageHeader titleKey="nav.yearReview" />
        <PageContainer>
          <p className="text-sm text-muted-foreground">
            {t("yearReview.nothing", { year })}
          </p>
        </PageContainer>
      </>
    );
  }

  const cards = yearReviewCards(review, { t, locale, formatMoney: format });

  return (
    <>
      <PageHeader titleKey="nav.yearReview" />
      <PageContainer className="flex max-w-2xl flex-col gap-5">
        <section
          className={cn(
            GLASS_CARD,
            GLASS_HERO,
            "flex min-h-[40vh] flex-col justify-center gap-3 rounded-card p-8",
          )}
        >
          <h2 className="font-head text-4xl">
            {t("yearReview.title", { year })}
          </h2>
          <p className="max-w-prose text-muted-foreground">
            {t("yearReview.lead")}
          </p>
        </section>

        {cards.map((card) => (
          <section
            key={card.id}
            className={cn(
              GLASS_CARD,
              "flex min-h-[40vh] flex-col justify-center gap-2 rounded-card p-8",
            )}
          >
            <PrivateAmount className={cn(FIGURE_HERO, "block")}>
              {card.figure}
            </PrivateAmount>
            <p className="text-lg">{card.caption}</p>
            {card.note ? (
              <p className="text-sm text-muted-foreground">
                <PrivateAmount>{card.note}</PrivateAmount>
              </p>
            ) : null}
          </section>
        ))}

        <ShareYear year={year} />
      </PageContainer>
    </>
  );
}

/** The image to share, and the two ways out with it. */
function ShareYear({ year }: { year: number }) {
  const t = useT();
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const src = `/api/year-review/image?y=${year}&l=${locale}`;
  const fileName = `pluclair-${year}.png`;

  async function share() {
    setPending(true);
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: t("yearReview.imageTitle", { year }),
        });
        return;
      }
      // No share sheet here: the file, then.
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
    <section
      className={cn(
        GLASS_CARD,
        "flex flex-col items-start gap-4 rounded-card p-6",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- drawn per
          account on request, nothing for the image optimiser to keep */}
      <img
        src={src}
        alt={t("yearReview.imageTitle", { year })}
        width={1080}
        height={1350}
        className="h-auto w-full max-w-xs rounded-control border border-border"
      />
      <p className="text-xs text-muted-foreground">
        {t("yearReview.shareHint")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => void share()}
        >
          <ShareNetwork size={ICON.sm} aria-hidden />
          {t("yearReview.share")}
        </Button>
        <a
          href={src}
          download={fileName}
          className="inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <DownloadSimple size={ICON.sm} aria-hidden />
          {t("yearReview.download")}
        </a>
      </div>
    </section>
  );
}
