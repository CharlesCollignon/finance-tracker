/**
 * The app's glass vocabulary, now that there is something behind it.
 *
 * Every surface used to be opaque, which was right when the ground was a flat
 * token colour: painting `bg-card` over `bg-background` hid the layout seams
 * for free. With a veil drifting behind the whole app, an opaque card is a
 * hole punched in it — so surfaces are translucent and blurred, and the seams
 * are drawn as hairlines instead of hidden under paint.
 *
 * Three weights, because there are three jobs. Chrome frames the app and must
 * stay legible over anything that scrolls under it. A card holds figures and
 * wants the bloom to show through without stealing contrast from them. A
 * panel floats above everything and has to be readable over content it did
 * not choose, so it is the most opaque of the three.
 *
 * Kept as strings rather than components: they compose with `cn` at the call
 * site, and a wrapper component per weight would be three components that
 * only forward children.
 */

/** Header bands and the side rail — structure, not content. */
export const GLASS_CHROME =
  "border-border bg-background/60 backdrop-blur-xl backdrop-saturate-150";

/**
 * A content card floating on the veil.
 *
 * `bg-card/60` rather than a lower number: the figures on these cards are the
 * point of the screen, and text over a moving gradient at high transparency
 * is the single easiest way to make an interface look cheap.
 */
export const GLASS_CARD =
  "border border-foreground/10 bg-card/60 backdrop-blur-xl backdrop-saturate-150";

/** Popovers, menus and sheets — above everything, over anything. */
export const GLASS_PANEL =
  "border border-foreground/10 bg-background/80 backdrop-blur-2xl backdrop-saturate-150";

/**
 * A panel that has to be solid.
 *
 * `backdrop-filter` composites against what is already painted behind the
 * element, and it does not nest: a blurred panel inside a blurred header gets
 * the header's finished pixels as its backdrop and blurs nothing, so the
 * content behind shows through sharp and the panel becomes unreadable. The
 * month grid opens out of the header band, so it cannot be glass.
 *
 * The mobile app reached the same conclusion by a different route — its
 * account sheet notes that a frosted panel "made the rows hard to read
 * against busy content behind it". A control holding twelve small targets is
 * one to see clearly, not through.
 */
export const SOLID_PANEL =
  "border border-foreground/10 bg-popover shadow-xl shadow-black/40";

/**
 * The hero card's extra lift.
 *
 * One card per screen gets a hairline of light along its top edge, the way a
 * pane of glass catches a highlight. Used on the Month screen's headline and
 * nowhere else: the effect is only "expensive" while it is rare.
 */
export const GLASS_HERO =
  "relative overflow-hidden before:pointer-events-none before:absolute before:inset-x-0 " +
  "before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent " +
  "before:via-foreground/25 before:to-transparent";
