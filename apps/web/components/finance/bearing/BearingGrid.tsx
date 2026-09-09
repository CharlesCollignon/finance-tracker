"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BearingFacts } from "@finance/core/bearing-facts";
import {
  renderArrangement,
  type Arrangement,
} from "@finance/core/bearing-read";
import { slotSpan, type TileId, type TilePins } from "@finance/core/bearing-tiles";
import type { Locale } from "@finance/core/i18n/locale";
import type { RenderedTile } from "@finance/core/bearing-read";
import { useFormatCurrency } from "@/lib/use-currency";
import { saveBearingPinsAction } from "@/lib/actions/bearing";
import { useToast } from "@/components/layout/ToastProvider";
import { useT } from "@/lib/locale-context";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { Tile } from "@/components/finance/bearing/Tile";
import { cn } from "@/lib/utils";

/**
 * The bento, and the dragging.
 *
 * Four columns on a desktop, two on a phone, and the spans come from the slot
 * rather than from the tile — which is what makes this a plain permutation
 * instead of a packing problem. `HEAD` and `REPEAT` in `bearing-tiles.ts` are
 * chosen so every row is exactly full at four columns, so no reordering can
 * leave a hole.
 *
 * Reordering writes pins rather than an order. The distinction matters: an
 * order would freeze all twelve tiles the first time somebody moved one, and
 * the model would never get to improve the other eleven again. A pin says
 * "this one, here" and leaves the rest to the arrangement.
 *
 * Optimistic, and it has to be. The tile is already under the pointer when
 * the user lets go; awaiting a round trip before moving it would mean
 * dragging a card that snaps back and then jumps. The write is fire-and-
 * forget with a toast on failure, because the cost of losing a tile position
 * is that you drag it again.
 */

interface BearingGridProps {
  /**
   * The order the server settled on: the arrangement with the user's pins
   * already applied. The starting point, not the last word — the client owns
   * the order from here, because a dropped tile has to stay where it was
   * dropped and the save action deliberately does not revalidate.
   */
  order: TileId[];
  /**
   * The figures, and the captions that point at them.
   *
   * Handed over unrendered on purpose. The display currency lives in this
   * browser's localStorage and no server can know it, so every figure on this
   * screen — inside a caption as much as under a label — is formatted here.
   * That is the whole reason a model writes `{{fact:id}}` and never a number.
   */
  facts: BearingFacts;
  arrangement: Arrangement | null;
  /** The language the captions are in, which may not be the reader's. */
  captionLocale: Locale;
  pins: TilePins;
  trend: number[];
  /** False when migration 029 has not run, or nobody is signed in to save for. */
  draggable: boolean;
}

export function BearingGrid({
  order: initialOrder,
  facts,
  arrangement,
  captionLocale,
  pins,
  trend,
  draggable,
}: BearingGridProps) {
  const t = useT();
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const reducedMotion = usePrefersReducedMotion();
  const [, startTransition] = useTransition();

  const [order, setOrder] = useState<TileId[]>(initialOrder);
  const [pinned, setPinned] = useState<Set<string>>(
    () => new Set(Object.keys(pins)),
  );
  const [dragging, setDragging] = useState<TileId | null>(null);

  // Spans come from the position, so the bento keeps its shape whatever the
  // order — a tile does not carry its size around with it.
  const laid = useMemo(
    () => renderArrangement(order, arrangement, facts, formatMoney, captionLocale),
    [order, arrangement, facts, formatMoney, captionLocale],
  );

  const byId = useMemo(
    () => new Map(laid.map((tile) => [tile.id, tile] as const)),
    [laid],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Enough that a press on a tile is a press, not the start of a drag.
      // Without it the whole card becomes unpressable on a touch screen.
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragging(null);
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const from = order.indexOf(active.id as TileId);
      const to = order.indexOf(over.id as TileId);
      if (from < 0 || to < 0) {
        return;
      }

      const next = arrayMove(order, from, to);
      setOrder(next);

      // Everything the user has ever placed, re-read off the layout they can
      // actually see. Pinning only the tile just moved would let the ones it
      // pushed past drift back on the next arrangement, so the whole visible
      // order below the highest pin is what gets remembered.
      const nowPinned = new Set(pinned).add(active.id as string);
      setPinned(nowPinned);

      const nextPins: TilePins = Object.fromEntries(
        next.flatMap((id, index) => (nowPinned.has(id) ? [[id, index]] : [])),
      );

      startTransition(async () => {
        const { saved } = await saveBearingPinsAction(nextPins);
        if (!saved) {
          toast(t("bearing.orderNotSaved"), "error");
        }
      });
    },
    [order, pinned, t, toast],
  );

  const onDragStart = useCallback((event: DragStartEvent) => {
    setDragging(event.active.id as TileId);
  }, []);

  const grid = (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4",
        // Dense so a span that cannot fit the row it starts on backfills the
        // gap behind it instead of leaving one. The template is built not to
        // need this at four columns; at two, a hero followed by a wide does.
        "[grid-auto-flow:row_dense]",
      )}
    >
      {laid.map((tile) => (
        <SortableTile
          key={tile.id}
          tile={tile}
          trend={trend}
          pinned={pinned.has(tile.id)}
          draggable={draggable}
          reducedMotion={reducedMotion}
          handleLabel={t("bearing.reorder", { label: tile.label })}
        />
      ))}
    </div>
  );

  if (!draggable) {
    return grid;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToParentElement]}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <SortableContext
        items={order}
        strategy={rectSortingStrategy}
      >
        {grid}
      </SortableContext>

      {/* What the pointer carries. Drawn outside the grid so it is not
          clipped by a cell, and at the dragged tile's own span so it does not
          change size the moment it is picked up. */}
      <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
        {dragging ? (
          <div className="h-full opacity-90">
            <Tile
              tile={
                laid.find((tile) => tile.id === dragging) ?? byId.get(dragging)!
              }
              trend={trend}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const SPAN_CLASS: Record<ReturnType<typeof slotSpan>, string> = {
  hero: "col-span-2 row-span-2",
  wide: "col-span-2",
  unit: "col-span-1",
};

function SortableTile({
  tile,
  trend,
  pinned,
  draggable,
  reducedMotion,
  handleLabel,
}: {
  tile: RenderedTile;
  trend: number[];
  pinned: boolean;
  draggable: boolean;
  reducedMotion: boolean;
  handleLabel: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tile.id, disabled: !draggable });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        // The one animation on this screen. Suppressed outright rather than
        // shortened when the reader has asked for less motion: a grid of
        // twelve cards all sliding is exactly the effect that setting exists
        // to turn off.
        transition: reducedMotion ? undefined : transition,
      }}
      className={cn(SPAN_CLASS[tile.span], isDragging && "z-10")}
    >
      <Tile
        tile={tile}
        trend={trend}
        pinned={pinned}
        dragging={isDragging}
        handleLabel={handleLabel}
        handleRef={draggable ? setActivatorNodeRef : undefined}
        handleProps={draggable ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  );
}
