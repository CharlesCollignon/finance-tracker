"use client";

import { useState } from "react";
import { domAnimation, LazyMotion, m, MotionConfig } from "motion/react";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/locale-context";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

/** A part as a whole percent: « 60 % ». */
export function percent(part: number): string {
  return `${Math.round(part * 100)} %`;
}

/**
 * A split between the two partners, set by sliding: the bar between them
 * moves with the thumb, each side named and counted, and one press saves it
 * for both. The space's split of the spending (6b) and a home's deed (6c).
 */
export function SplitEditor({
  initial,
  partnerName,
  hint,
  label,
  pending,
  onSave,
}: {
  initial: number;
  partnerName: string;
  /** The one sentence saying what this split is for. */
  hint: string;
  /** The slider's accessible name. */
  label: string;
  pending: boolean;
  onSave: (share: number) => void;
}) {
  const t = useT();
  const [share, setShare] = useState(Math.round(initial * 20) / 20);

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className="flex flex-col gap-3">
          <p className={cn("text-muted-foreground", MICRO)}>{hint}</p>
          <div className="flex items-baseline justify-between text-sm font-medium">
            <span>{t("space.shareYou", { part: percent(share) })}</span>
            <span className="text-muted-foreground">
              {t("space.sharePartner", {
                name: partnerName,
                part: percent(1 - share),
              })}
            </span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <m.span
              className="h-full bg-foreground"
              initial={false}
              animate={{ width: `${share * 100}%` }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(share * 100)}
            onChange={(event) => setShare(Number(event.target.value) / 100)}
            aria-label={label}
            aria-valuetext={`${percent(share)} · ${percent(1 - share)}`}
            className="w-full accent-foreground"
          />
          <Button
            size="sm"
            className="self-start"
            disabled={pending || share === initial}
            onClick={() => onSave(share)}
          >
            {pending ? t("profile.saving") : t("profile.save")}
          </Button>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
