"use client";

import { useId, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowSquareOut, CaretDown, Question } from "@phosphor-icons/react";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";
import {
  BANK_IDS,
  BANK_NAMES,
  exportGuide,
  type BankId,
} from "@finance/core/statement";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** The first letters a bank is known by, for its chip. */
function initials(bank: BankId): string {
  return BANK_NAMES[bank]
    .replace(/[^A-Za-zÀ-ÿ0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * « Où trouver l'export de ma banque ? »: the person picks their bank and
 * reads, in two or three steps, where it puts its export — its own steps
 * where they are written down, the steps that hold for any bank otherwise
 * (`exportGuide`) — with its website a click away. Opens where it stands.
 */
export function BankGuide({
  initialBank = null,
}: {
  initialBank?: BankId | null;
}) {
  const t = useT();
  const locale = useLocale();
  const panelId = useId();
  const [open, setOpen] = useState(initialBank !== null);
  const [bank, setBank] = useState<BankId | "other" | null>(initialBank);
  const guide =
    bank === null ? null : exportGuide(bank === "other" ? null : bank, locale);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 items-center gap-2 self-start rounded-control text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        <Question size={ICON.md} aria-hidden />
        {t("statements.where")}
        <CaretDown
          size={ICON.sm}
          aria-hidden
          className={cn(
            "transition-transform duration-hover",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <m.div
            id={panelId}
            key="guide"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.panel / 1000, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("statements.wherePick")}
            </p>
            <div role="group" className="mt-2 flex flex-wrap gap-1.5">
              {[...BANK_IDS, "other" as const].map((id) => {
                const chosen = bank === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => setBank(id)}
                    className={cn(
                      "flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm transition-colors duration-hover",
                      chosen
                        ? "border-foreground/30 bg-foreground/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {id === "other" ? null : (
                      <span
                        aria-hidden
                        className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground"
                      >
                        {initials(id)}
                      </span>
                    )}
                    {id === "other"
                      ? t("statements.otherBank")
                      : BANK_NAMES[id]}
                  </button>
                );
              })}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {guide ? (
                <m.div
                  key={bank}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: DURATION.press / 1000, ease: EASE }}
                  className="mt-4 flex flex-col gap-3"
                >
                  <ol className="flex flex-col gap-2">
                    {guide.steps.map((step, index) => (
                      <li key={index} className="flex gap-3 text-sm">
                        <span
                          aria-hidden
                          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                        >
                          {index + 1}
                        </span>
                        <span className="pt-0.5 text-muted-foreground">
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {guide.site && bank !== "other" && bank !== null ? (
                    <a
                      href={guide.site}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center gap-2 self-start rounded-control text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {t("statements.openSite", { bank: BANK_NAMES[bank] })}
                      <ArrowSquareOut size={ICON.sm} aria-hidden />
                    </a>
                  ) : null}
                </m.div>
              ) : null}
            </AnimatePresence>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
