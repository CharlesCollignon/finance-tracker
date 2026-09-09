import { z } from "zod";

import { BEARING_TILE_IDS, MAX_TILES } from "../bearing-tiles";

/**
 * Where the user has dragged their tiles.
 *
 * Arriving from a browser or a phone, so validated rather than trusted, and
 * bounded on both sides: the key must be a figure that can actually be a tile
 * and the slot must be one the grid has. `mergeArrangement` also drops
 * anything it cannot use — that is its job and it is tested — but a client
 * posting a thousand keys should be refused at the door rather than
 * quietly ignored after being written to a row.
 *
 * `z.enum` over the catalogue rather than a loose string, because the
 * catalogue is closed. That is the same property the model is held to, and it
 * costs nothing to hold a client to it too.
 */
export const tilePinsSchema = z.record(
  z.enum(BEARING_TILE_IDS),
  z.number().int().min(0).max(MAX_TILES - 1),
);

export const bearingPinsRequestSchema = z.object({
  pins: tilePinsSchema,
});
