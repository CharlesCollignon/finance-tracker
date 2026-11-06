"use client";

import { useTransition, type CSSProperties } from "react";
import { Check } from "@phosphor-icons/react";
import { DESIGNS, type Design } from "@finance/core/designs";
import { useToast } from "@/components/layout/ToastProvider";
import { setDesignPreference } from "@/lib/actions/design";
import { useDesign } from "@/lib/design-context";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/**
 * Each design drawn small, in its own colours and its own figure face,
 * whatever design the page around it is in — the swatch is a picture of the
 * choice, not part of the current skin, so its values are literal here and
 * mirror the design's tokens in globals.css.
 */
const SWATCH: Record<
  Design,
  {
    ground: string;
    card: string;
    ink: string;
    muted: string;
    accent: string;
    radius: number;
    figure: string;
  }
> = {
  nuit: {
    ground: "#0a0a10",
    card: "#131320",
    ink: "#ececf1",
    muted: "#9b9bad",
    accent: "#fa9842",
    radius: 8,
    figure: "var(--font-fraunces), ui-serif, Georgia, serif",
  },
  papier: {
    ground: "#f6f1e7",
    card: "#fbf8f2",
    ink: "#1c1a17",
    muted: "#5f584e",
    accent: "#9a3412",
    radius: 2,
    figure: "var(--font-newsreader), ui-serif, Georgia, serif",
  },
  bento: {
    ground: "#eef0f3",
    card: "#ffffff",
    ink: "#0f1115",
    muted: "#535a68",
    accent: "#2340f5",
    radius: 12,
    figure: "var(--font-bricolage), var(--font-instrument-sans), sans-serif",
  },
  console: {
    ground: "#0b0b0b",
    card: "#121212",
    ink: "#ededed",
    muted: "#9a9a9a",
    accent: "#fa9842",
    radius: 1,
    figure: "var(--font-plex-mono), ui-monospace, monospace",
  },
};

/**
 * « Design », in the profile's « Apparence » section: the four looks side by
 * side. Picking one repaints the page at once (`preview`) and then saves it —
 * cookie and row — so the next page and the phone open in it too. A failed
 * save says so and leaves the page in the design picked; the cookie is
 * already written, so this browser keeps it either way.
 */
export function DesignPicker() {
  const t = useT();
  const { toast } = useToast();
  const { design, preview } = useDesign();
  const [, startTransition] = useTransition();

  function choose(next: Design) {
    if (next === design) {
      return;
    }
    preview(next);
    startTransition(async () => {
      const result = await setDesignPreference(next);
      if (result.error) {
        toast(result.error, "error");
      }
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("design.settingLabel")}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {DESIGNS.map((id) => {
        const swatch = SWATCH[id];
        const selected = id === design;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => choose(id)}
            className={cn(
              "group flex flex-col gap-2 rounded-control p-1.5 text-left transition-colors duration-hover",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-primary/10 ring-2 ring-primary"
                : "hover:bg-muted/40",
            )}
          >
            <span
              aria-hidden
              className="flex h-20 flex-col justify-between overflow-hidden p-2.5"
              style={
                {
                  background: swatch.ground,
                  borderRadius: swatch.radius + 4,
                  border: "1px solid rgba(128,128,128,0.25)",
                } as CSSProperties
              }
            >
              <span
                className="flex items-end justify-between px-2 py-1.5"
                style={{
                  background: swatch.card,
                  borderRadius: swatch.radius,
                }}
              >
                <span
                  className="whitespace-nowrap text-base leading-none tabular-nums"
                  style={{
                    color: swatch.ink,
                    fontFamily: swatch.figure,
                    fontWeight: 600,
                  }}
                >
                  1 184 €
                </span>
                <span
                  className="mb-0.5 h-1.5 w-5 rounded-full"
                  style={{ background: swatch.accent }}
                />
              </span>
              <span className="flex gap-1">
                <span
                  className="h-1 w-8 rounded-full"
                  style={{ background: swatch.muted, opacity: 0.6 }}
                />
                <span
                  className="h-1 w-4 rounded-full"
                  style={{ background: swatch.muted, opacity: 0.35 }}
                />
              </span>
            </span>
            <span className="flex items-center justify-between gap-2 px-1">
              <span className="text-sm font-semibold">
                {t(`design.${id}.name`)}
              </span>
              {selected ? (
                <Check
                  weight="bold"
                  className="size-4 shrink-0 text-primary"
                  aria-hidden
                />
              ) : null}
            </span>
            <span className="px-1 pb-1 text-xs leading-snug text-muted-foreground">
              {t(`design.${id}.hint`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
