"use client";

import { m } from "motion/react";
import { FileText, Sparkle, Warning } from "@phosphor-icons/react";
import { ConnectAiInvite } from "@/components/finance/ConnectAiInvite";
import { FADE } from "@/components/motion/fade";
import { Button } from "@/components/ui/Button";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

/**
 * A statement Pluclair cannot take the text out of — a scan, a photo, a
 * screenshot, a PDF it did not recognise — and the offer to have the
 * person's own AI account read it with Mistral: what is sent where, and
 * kept by no one, said before the one button that sends it, for this
 * file only. Without an AI account, the way to connect one. While it
 * reads, a page being scanned.
 */
export function ScanOffer({
  reason,
  aiAccount,
  scanning,
  onScan,
}: {
  /** Why the file needs reading: a picture, or a PDF not recognised. */
  reason: string;
  aiAccount: boolean;
  scanning: boolean;
  onScan: () => void;
}) {
  const t = useT();

  if (scanning) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 py-6 text-center"
      >
        <span className="relative flex size-20 items-center justify-center overflow-hidden rounded-card bg-muted">
          <FileText size={ICON.hero} aria-hidden className="text-muted-foreground" />
          {/* The reading's line, going down the page and back. */}
          <m.span
            aria-hidden
            className="absolute inset-x-2 h-0.5 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]"
            initial={{ top: "12%" }}
            animate={{ top: ["12%", "86%", "12%"] }}
            transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
          />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-medium">{t("statements.scanning")}</p>
          <p className="text-sm text-muted-foreground">
            {t("statements.scanningHint")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 text-sm">
        <Warning size={ICON.md} aria-hidden className="mt-0.5 shrink-0" />
        {reason}
      </p>
      {aiAccount ? (
        <m.div
          {...FADE}
          className="flex flex-col gap-3 rounded-control border border-primary/30 bg-accent p-4"
        >
          <p className="flex items-center gap-2 font-head text-base">
            <Sparkle size={ICON.md} weight="fill" aria-hidden className="text-primary" />
            {t("statements.scanTitle")}
          </p>
          <p className="text-sm">{t("statements.scanBody")}</p>
          <p className="text-xs text-muted-foreground">{t("statements.scanCost")}</p>
          <Button className="self-start" onClick={onScan}>
            <Sparkle size={ICON.sm} weight="fill" className="mr-1.5 inline" aria-hidden />
            {t("statements.scanGo")}
          </Button>
        </m.div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {t("statements.scanNoAccountBody")}
          </p>
          <ConnectAiInvite />
        </div>
      )}
    </div>
  );
}
