/**
 * The desktop nav's notch, as class strings: the tab cut from the bezel at the
 * top of the window that holds the five surfaces and the add button, the two
 * states of a row in it, and where the wordmark and the controls sit on
 * either side of it.
 *
 * Shared rather than written twice because the marketing mock draws the same
 * bar beside a screenshot of the app, and the sidebar that came before it
 * showed what happens otherwise. Its geometry was shared and its colours were
 * not, so when the app's active state moved off the accent the mock went on
 * painting the gold version for a release. Here the whole look is one set of
 * strings, and `TopNav` and `WebTopNav` both read them — with the wings in
 * `components/layout/NotchWing`, which both draw too.
 *
 * The notch is `--frame`, the bezel's colour, so it reads as the bezel
 * dipping into the page: square where it meets the bezel, where the wings
 * turn its corners into fillets, and round where it faces the page, at the
 * row's radius plus the 8px under it so the curves stay concentric. The
 * wordmark and the actions are not in notches; they sit on the page itself,
 * on the notch's row line.
 *
 * The surface you are in is a pill of Raised Surface behind the row — one
 * element, which slides to the next row when you move (`TopNav`) — and a
 * filled icon.
 */

/** The surfaces, centred on the window: the one notch cut from the bezel.
 * 4px above its row, so the pill clears the bezel's edge by the same step
 * the wordmark and the actions beside it do, and 8px under it. */
export const NOTCH_CENTRE_CLASS =
  // `w-max`: absolutely placed from the middle, the notch would otherwise
  // shrink to the half of the bar right of centre, and squeeze its labels
  // onto two lines once there are six surfaces.
  "pointer-events-auto absolute left-1/2 top-0 flex w-max -translate-x-1/2 items-start gap-1 " +
  "rounded-b-[1.875rem] bg-frame px-2 pb-2 pt-1";

/** The wordmark, on the page to the left of the notch, level with its row. */
export const TOPBAR_START_CLASS =
  "pointer-events-auto absolute left-4 top-1 flex h-11 items-center";

/** The refresh, the blur and the account, on the page to the right of the
 * notch, level with its row. */
export const TOPBAR_END_CLASS =
  "pointer-events-auto absolute right-3 top-1 flex h-11 items-center gap-1";

/** Every row in the centre notch. 44px tall: the notch is on a tablet too. */
export const NOTCH_ITEM_CLASS =
  "relative flex h-11 items-center rounded-full px-3 text-sm font-medium " +
  "transition-colors duration-hover lg:px-4";

/** The surface you are in. */
export const NOTCH_ITEM_ACTIVE_CLASS = "text-foreground";

/** Every other surface. */
export const NOTCH_ITEM_IDLE_CLASS =
  "text-muted-foreground hover:text-foreground";

/** The pill behind the surface you are in. */
export const NOTCH_PILL_CLASS = "absolute inset-0 rounded-full bg-muted";
