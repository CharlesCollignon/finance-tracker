/**
 * The shape of the sidebar's tree: where the trunk sits, where each branch
 * leaves it, and how long the traced path to a given row is.
 *
 * Pulled out of `BranchedNav` so the marketing mock can draw the same tree
 * rather than a flat list beside a screenshot of one. The mock already shares
 * `APP_NAV_ITEMS` with the real nav for the same reason — the two can never
 * drift apart if there is only one of each — and the geometry is the other
 * half of that: a picture of the sidebar with the branches hand-drawn would
 * go stale the first time the real one moved a pixel.
 *
 * Constants rather than props, because a sidebar has one shape and the
 * alternative is five numbers that can be set to values that do not meet.
 */

/** Where the trunk sits: the centre of a parent row's icon, in pixels. */
export const TRUNK_X = 21;

/** The curve where a branch leaves the trunk. */
export const RADIUS = 9;

/** Where a child row's text starts. Past the parent's label, not under it. */
export const INDENT = 46;

/** Where a branch stops, short of the text it points at. */
export const BRANCH_END = INDENT - 8;

/** A child row's height, and the padding above the first and below the last. */
export const ROW_HEIGHT = 36;
export const PAD = 6;

/** The vertical centre of child `index`, within the children block. */
export function rowY(index: number): number {
  return PAD + index * ROW_HEIGHT + ROW_HEIGHT / 2;
}

/** The trunk, from the top of the block down to the last branch's curve. */
export function trunkPath(count: number): string {
  return `M ${TRUNK_X} 0 V ${rowY(count - 1) - RADIUS}`;
}

/** One branch: out of the trunk, round the corner, along to the text. */
export function branchPath(index: number): string {
  const y = rowY(index);
  return `M ${TRUNK_X} ${y - RADIUS} A ${RADIUS} ${RADIUS} 0 0 0 ${
    TRUNK_X + RADIUS
  } ${y} H ${BRANCH_END}`;
}

/** The same branch, traced from the very top: the accent on the view you
 * are in. It used to draw itself in on a dash offset when a section
 * unfolded; sections do not fold any more, so it is simply drawn. */
export function reachPath(index: number): string {
  const y = rowY(index);
  return `M ${TRUNK_X} 0 V ${y - RADIUS} A ${RADIUS} ${RADIUS} 0 0 0 ${
    TRUNK_X + RADIUS
  } ${y} H ${BRANCH_END}`;
}

/** The block a surface's children occupy, in pixels. */
export function childrenHeight(count: number): number {
  return PAD * 2 + count * ROW_HEIGHT;
}
