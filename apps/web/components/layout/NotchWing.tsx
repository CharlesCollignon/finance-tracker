import { cn } from "@/lib/utils";

/**
 * The curve that makes a notch look cut from the bezel rather than stuck to
 * it. It sits beside a notch's top corner, outside it, and fills the inside
 * of a quarter circle between the bezel's edge and the notch's side — the
 * concave fillet where one surface turns into the other. A start and an end
 * hand, one for each side of the notch.
 *
 * Adapted from the adaptive notch navigation bar these were lifted from. The
 * paths are its; the colour is the bezel's `--frame` token, and each path runs
 * a unit past its box so no hairline of the page shows along the joins.
 *
 * Plain SVG and no state, so a server component can draw one — the
 * marketing mock does. Always decorative.
 */

const WING_CLASS =
  "pointer-events-none absolute size-4 overflow-visible text-frame select-none";

export function NotchWing({ side }: { side: "start" | "end" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      shapeRendering="geometricPrecision"
      className={cn(
        WING_CLASS,
        "top-0",
        side === "start" ? "right-full" : "left-full",
      )}
    >
      <path
        d={
          side === "start"
            ? "M 0 0 C 11.046 0 20 8.954 20 20 H 21 V -1 H 0 Z"
            : "M 20 0 C 8.954 0 0 8.954 0 20 H -1 V -1 H 20 Z"
        }
        fill="currentColor"
      />
    </svg>
  );
}
