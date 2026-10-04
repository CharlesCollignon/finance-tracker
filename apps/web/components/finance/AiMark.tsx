import { Sparkle } from "@phosphor-icons/react";
import {
  AI_BRAND_MARKS,
  aiBrandOf,
  type AiBrand,
} from "@finance/core/ai-brands";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";

/**
 * A model's maker, as its mark (`@finance/core/ai-brands`). In its own
 * colour on a dark ground; in the text's colour (`tone="current"`) on a
 * gold button, where an orange mark would not read.
 */
export function AiMark({
  brand,
  tone = "brand",
  className,
}: {
  brand: AiBrand;
  tone?: "brand" | "current";
  className?: string;
}) {
  const mark = AI_BRAND_MARKS[brand];
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill={tone === "brand" && mark.color ? mark.color : "currentColor"}
      className={cn("size-4 shrink-0", className)}
    >
      <path d={mark.path} />
    </svg>
  );
}

/**
 * The leading mark of a button that spends a call, from the writer's name or
 * id: its maker's mark, else the house sparkle for "a model does this".
 */
export function WriterMark({ model }: { model: string | null }) {
  const brand = aiBrandOf(model);
  return brand ? (
    <AiMark brand={brand} tone="current" className="size-3.5" />
  ) : (
    <Sparkle size={ICON.sm} weight="fill" aria-hidden="true" />
  );
}

/** The mark before « Écrit par … », when the maker is one of the three. */
export function BylineMark({ model }: { model: string | null }) {
  const brand = aiBrandOf(model);
  return brand ? (
    <AiMark
      brand={brand}
      tone="current"
      className="mr-1 inline-block size-3 align-[-1px]"
    />
  ) : null;
}
