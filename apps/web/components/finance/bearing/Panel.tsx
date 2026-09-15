"use client";

import type { RenderedTile } from "@finance/core/bearing-read";
import { useT } from "@/lib/locale-context";

/**
 * What opens under a pressed tile.
 *
 * A stub, for now. This module exists so `BearingGrid` has something to
 * render in the row it opens — the mechanism that opens a full-width row
 * under a tile without leaving a hole in the bento — while the blocks that
 * actually explain a figure (`panelFor` in `@finance/core/bearing-panels`,
 * built in the task before this one) wait for Task 5 to draw them.
 *
 * The signature is the point: `{ tile }` is already everything a real panel
 * needs to look itself up — the tile's id, its family, its own rendered
 * figure — so Task 5 replaces this function's body and nothing in
 * `BearingGrid` has to change to call it.
 */
export function Panel({ tile }: { tile: RenderedTile }) {
  const t = useT();

  return (
    <div
      data-panel-for={tile.id}
      className="flex h-24 items-center justify-center rounded-3xl border border-foreground/10 text-sm text-muted-foreground"
    >
      {t("bearing.panel.loading")}
    </div>
  );
}
