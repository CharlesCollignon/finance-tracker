/** Shared app shell dimensions — keep SideNav + PageHeader borders aligned. */

export const SHELL_HEADER_BAND_CLASS =
  "box-border h-[var(--shell-header-height)] shrink-0 border-b border-border";

export const SHELL_HEADER_INNER_CLASS =
  "mx-auto flex h-[var(--shell-header-height)] w-full min-w-0 max-w-lg " +
  "items-center justify-between gap-3 px-4 " +
  "md:max-w-3xl md:gap-4 md:px-6 lg:max-w-5xl";

export const SHELL_HEADER_ACTIONS_CLASS =
  "flex min-w-0 shrink items-center justify-end gap-2";

export const SHELL_MAIN_PADDING_BOTTOM =
  "pb-[calc(var(--shell-bottom-nav-height)+env(safe-area-inset-bottom,0px))] " +
  "md:pb-0";
