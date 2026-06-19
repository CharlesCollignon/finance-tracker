/** Shared app shell dimensions — keep SideNav + PageHeader borders aligned. */

export const SHELL_HEADER_BAND_CLASS =
  "box-border h-[var(--shell-header-height)] shrink-0 border-b-2 border-border";

export const SHELL_HEADER_INNER_CLASS =
  "mx-auto flex w-full min-w-0 max-w-lg flex-col gap-3 px-4 py-3 " +
  "md:h-full md:max-w-3xl md:flex-row md:items-center md:justify-between " +
  "md:gap-4 md:px-6 md:py-0 lg:max-w-5xl";

export const SHELL_HEADER_ACTIONS_CLASS =
  "flex w-full flex-wrap items-center justify-end gap-2 " +
  "sm:flex-nowrap md:w-auto md:shrink-0";

export const SHELL_MAIN_PADDING_BOTTOM =
  "pb-[calc(var(--shell-bottom-nav-height)+env(safe-area-inset-bottom,0px))] " +
  "md:pb-0";
