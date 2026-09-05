"use client";

import { useState } from "react";
import { ArrowsLeftRight, Trash, X } from "@phosphor-icons/react";
import {
  describeSelectionDeletion,
  describeSelectionMove,
  type MoveEffect,
  type SelectionSummary,
} from "@finance/core/selection";
import type { Category } from "@finance/core/types/database";
import { Button } from "@/components/retroui/Button";
import { CategorySelect } from "@/components/finance/CategorySelect";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

interface SelectionBarProps {
  summary: SelectionSummary;
  pending: boolean;
  onCancel: () => void;
  onDelete: () => void;
  /** Everything the selection could be moved into. */
  categories: Category[];
  /** What moving into `categoryId` would do, for the sentence above the button. */
  planMove: (categoryId: string) => MoveEffect | null;
  onMove: (categoryId: string) => void;
}

/**
 * The bar that appears once rows are selected.
 *
 * Fixed to the bottom rather than placed in the page flow, because the
 * selection is made by scrolling a long list and the action has to stay
 * reachable from wherever the user stopped. It sits above the mobile bottom
 * nav so it never covers navigation.
 *
 * Deleting is behind a second press: it is irreversible, and on a list of
 * checkboxes a stray click is easy.
 *
 * Moving is not, and deliberately. A move is undone by moving back, so a
 * confirm step would be friction charging for nothing — except when the
 * category type changes, which silently rewrites the totals and the unrecorded
 * spending of every past month the selection touches. That one is worth a
 * press, and it is the only one that gets it.
 */
export function SelectionBar({
  summary,
  pending,
  onCancel,
  onDelete,
  categories,
  planMove,
  onMove,
}: SelectionBarProps) {
  const formatEuro = useFormatCurrency();
  const [confirming, setConfirming] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [target, setTarget] = useState("");

  if (summary.count === 0) {
    return null;
  }

  const warning = describeSelectionDeletion(summary);
  const effect = target ? planMove(target) : null;
  const moveNote = effect
    ? describeSelectionMove(
        effect,
        summary,
        categories.find((category) => category.id === target)?.name ?? "",
      )
    : null;
  // The only move that asks twice; see the note on this component.
  const needsConfirm = (effect?.typeChanges ?? 0) > 0;

  function close() {
    setChoosing(false);
    setTarget("");
  }

  return (
    <div
      role="region"
      aria-label="Selected transactions"
      className={cn(
        "fixed inset-x-0 z-40 px-4",
        "bottom-[calc(var(--shell-bottom-nav-height)+var(--shell-bottom-nav-inset)+env(safe-area-inset-bottom,0px)+0.75rem)]",
        "md:bottom-4",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-lg flex-col gap-3 rounded-lg border border-border",
          "bg-background/95 p-3 shadow-lg backdrop-blur-xl md:max-w-2xl",
        )}
      >
        {confirming ? (
          <>
            <p className="text-sm text-foreground">{warning}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-destructive text-destructive"
                disabled={pending}
                onClick={onDelete}
              >
                {pending ? "Deleting…" : "Yes, delete"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : choosing ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="selection-move-category"
                className="text-sm font-medium"
              >
                {`Move ${summary.count} ${
                  summary.count === 1 ? "transaction" : "transactions"
                } to`}
              </label>
              <CategorySelect
                id="selection-move-category"
                categories={categories}
                value={target}
                placeholder="Pick a category"
                disabled={pending}
                onChange={(event) => setTarget(event.target.value)}
              />
            </div>

            {/* What it will do, before it does it — including the merchants
                this will not teach, which is the part nothing else says. */}
            {moveNote ? (
              <p className="text-sm text-muted-foreground">{moveNote}</p>
            ) : null}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending || !target}
                onClick={() => {
                  onMove(target);
                  close();
                }}
              >
                {pending ? "Moving…" : needsConfirm ? "Yes, move them" : "Move"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={close}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {summary.count} selected
                {summary.total > 0 ? (
                  <span className="ml-2 font-mono text-xs text-muted-foreground tabular-nums">
                    {formatEuro(summary.total)}
                  </span>
                ) : null}
              </p>
              {summary.recurringCount > 0 ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {summary.recurringCount} from recurring
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={pending}
                onClick={() => setChoosing(true)}
              >
                <ArrowsLeftRight size={16} />
                Move
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-destructive text-destructive"
                disabled={pending}
                onClick={() => setConfirming(true)}
              >
                <Trash size={16} />
                Delete
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Clear selection"
                disabled={pending}
                onClick={onCancel}
              >
                <X size={18} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** A checkbox sized for a touch target, used on each selectable row. */
export function RowCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      // Stops a click on the box from also opening the row's edit sheet.
      onClick={(event) => event.stopPropagation()}
      className="size-5 shrink-0 accent-[var(--primary)]"
    />
  );
}
