/**
 * Shared app shell dimensions — keep SideNav + PageHeader borders aligned.
 *
 * The width steps here and in PageContainer have to stay in step with each
 * other: they are what makes the header band's contents line up with the
 * cards below it, and changing one alone visibly offsets the title from the
 * column it belongs to.
 *
 * The `xl` step exists because the app had no desktop tier at all — `lg` was
 * the last word, so above 1024px of content the whole app sat in a 1024px
 * column with the backdrop showing on either side. It was 90rem, chosen for
 * the Month surface's two columns; Month is retired and the width outlived
 * its reason, so it is 72rem — wide enough for the Ledger's table and narrow
 * enough that a line of prose stops short of a tiring measure.
 */

export const SHELL_HEADER_BAND_CLASS =
  "box-border h-[var(--shell-header-height)] shrink-0 border-b border-border";

export const SHELL_HEADER_INNER_CLASS =
  "mx-auto flex h-[var(--shell-header-height)] w-full min-w-0 max-w-lg " +
  "items-center justify-between gap-2 px-4 " +
  "sm:gap-3 md:max-w-3xl md:gap-4 md:px-6 lg:max-w-5xl xl:max-w-6xl";

export const SHELL_HEADER_ACTIONS_CLASS =
  "flex min-w-0 shrink items-center justify-end gap-2";

export const SHELL_MAIN_PADDING_BOTTOM =
  "pb-[calc(var(--shell-bottom-nav-height)+var(--shell-bottom-nav-inset)+env(safe-area-inset-bottom,0px))] " +
  "md:pb-0";
