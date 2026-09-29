/**
 * Motion's layout-animation features, in a module of their own so they can
 * be loaded after the page rather than with it.
 *
 * `LazyMotion` takes a loader, and the loader has to point at a separate
 * module: importing `domMax` from `motion/react` in the same file as `m`
 * would put both in the same chunk and the laziness would buy nothing. What
 * stays in the first load is the `m` component, a few kilobytes; the layout
 * engine behind `layoutId`, which is most of the library, arrives on its own
 * a moment later, and until it does the pill simply moves without sliding.
 */
export { domMax as default } from "motion/react";
