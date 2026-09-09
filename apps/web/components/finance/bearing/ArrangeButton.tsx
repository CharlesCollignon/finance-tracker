"use client";

import { useState, useTransition } from "react";
import { ArrowsClockwise, Sparkle } from "@phosphor-icons/react";
import {
  arrangeBearingAction,
  clearBearingPinsAction,
} from "@/lib/actions/bearing";
import { useToast } from "@/components/layout/ToastProvider";
import { useT } from "@/lib/locale-context";
import { ICON } from "@/lib/icon-scale";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

interface ArrangeButtonProps {
  /** Whether a writer exists on this deployment at all. */
  configured: boolean;
  arrangementsLeft: number;
  /** True when the user has dragged at least one tile. */
  hasPins: boolean;
}

/**
 * The one control on the surface, and it says plainly what it does.
 *
 * Absent rather than broken on a deployment with no key — the same honesty
 * the bank buttons and the month read card use. The surface loses nothing by
 * it: the app's own ordering is what renders either way, so somebody who has
 * never configured a model gets a working Bearing and simply no button.
 *
 * Said out loud that a model chose the order. Not for liability — a screen
 * that quietly implies a person ranked your figures is the same class of
 * small lie as calling an arithmetic figure "on hand".
 */
export function ArrangeButton({
  configured,
  arrangementsLeft,
  hasPins,
}: ArrangeButtonProps) {
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [left, setLeft] = useState(arrangementsLeft);

  function arrange() {
    startTransition(async () => {
      const outcome = await arrangeBearingAction();
      setLeft(outcome.arrangementsLeft);
      if (outcome.message) {
        toast(outcome.message, outcome.arranged ? "success" : "error");
      }
    });
  }

  function clearPins() {
    startTransition(async () => {
      await clearBearingPinsAction();
    });
  }

  if (!configured && !hasPins) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* Only once the user has actually overruled something. Offering to
          clear an order nobody set is a button that does nothing, next to a
          button that does. */}
      {hasPins ? (
        <button
          type="button"
          onClick={clearPins}
          disabled={pending}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <ArrowsClockwise size={ICON.sm} />
          {t("bearing.resetPins")}
        </button>
      ) : null}

      {configured ? (
        <>
          <button
            type="button"
            onClick={arrange}
            disabled={pending || left <= 0}
            className={cn(
              "flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5",
              "text-sm transition-colors hover:border-foreground/30 disabled:opacity-50",
            )}
          >
            <Sparkle size={ICON.sm} className="text-primary-rim" />
            {pending ? t("bearing.arranging") : t("bearing.arrange")}
          </button>
          <span className={cn(MICRO, "text-muted-foreground")}>
            {t("bearing.arrangementsLeft", { count: left })}
          </span>
        </>
      ) : null}
    </div>
  );
}
