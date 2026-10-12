import { marketingFocus } from "@/components/marketing/marketing-focus";

/**
 * The marketing site's two buttons as class strings: the gold one and the
 * glass one, at the nav's size and the hero's. `LandingCtas` is the signup
 * pair built from them; a page with another next step — the about page's
 * download — builds its own from the same four, so the buttons stay one
 * pair. A module of its own, not exports of that client component, so a
 * server component can read them.
 */

export const CTA_BASE =
  "inline-flex items-center justify-center rounded-full font-medium " +
  "transition-[transform,background-color,border-color,color] duration-hover [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] " +
  `${marketingFocus} ` +
  "active:scale-[0.98]";

/* `md` is the nav pill and asks for its height rather than deriving one from
   padding: at `py-2.5` it drew a 40px box, which is under the 44px a finger
   needs and it is the primary action on every marketing page. `lg` already
   clears the minimum on its padding alone. */
export const CTA_SIZES = {
  md: "min-h-11 px-5 text-sm",
  lg: "px-7 py-3.5 text-[0.95rem]",
} as const;

/* No glow. The `lg` button cast `0 8px 28px -12px rgba(224, 190, 122, 0.45)`
   under itself until DESIGN.md's Flat-With-One-Exception Rule was read as
   written: the only shadows this site is licensed to cast are the two in the
   glass vocabulary, under The Marketing Glass Rule, and a gold halo under a
   button is neither glass nor a recess — it is a lens flare, which is what it
   already looked like at nav size.

   Nothing is lost by it. The fill is Lamplit Gold, `--primary` at #ecb25e,
   which this file's note above measures at 10:1 on the near-black marketing
   ground; the other button in the pair is a 6%-white pane behind a hairline.
   Which of the two is the primary action was never the halo's work. */
/* Gold glass: Lamplit Gold as a gradient, lighter at the top left and deeper
   at the bottom right, a little transparent and blurred over what is behind
   it — the Earth, the stars — with a thin light along its top edge. Hover
   brightens it rather than lifting it. See `.marketing-cta-gold` in
   globals.css; the owner's call, October 2026. */
export const CTA_SOLID = "marketing-cta-gold text-primary-foreground";

/* Glass, like every other translucent surface on the site: on the hero it
   sits over the orb's bloom, and the blur is what stops it reading as a hole
   punched in the light. */
export const CTA_QUIET =
  "border border-white/12 bg-white/[0.06] backdrop-blur-xl text-marketing-ink " +
  "hover:border-white/25 hover:bg-white/[0.11] hover:text-white";
