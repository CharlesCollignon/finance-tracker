/*
 * NativeWind resolves competing utilities by stylesheet order, and Tailwind
 * emits colour utilities alphabetically. So `text-foreground` (order 162)
 * beats `text-destructive` (161) and `text-background` (160) no matter which
 * comes later in the className string. A component that bakes a colour into a
 * variant therefore silently overrides the colour its caller passed.
 *
 * These helpers let a component drop its own colour when the caller supplied
 * one, so the call site always wins.
 */

const SIZE = /^text-(xs|sm|base|lg|xl|[2-9]xl)$/;
const ALIGN = /^text-(left|center|right|justify|start|end)$/;
const WRAP = /^text-(wrap|nowrap|balance|pretty|ellipsis|clip)$/;
/** Arbitrary values: text-[10px] is a size, text-[#fff] is a colour. */
const ARBITRARY_SIZE = /^text-\[[.\d]/;

export function isTextColorClass(token: string): boolean {
  if (!token.startsWith("text-")) {
    return false;
  }
  const base = token.split("/")[0];
  return (
    !SIZE.test(base) &&
    !ALIGN.test(base) &&
    !WRAP.test(base) &&
    !ARBITRARY_SIZE.test(base)
  );
}

export function hasTextColor(className?: string): boolean {
  if (!className) {
    return false;
  }
  return className.split(/\s+/).some(isTextColorClass);
}

/** Strips colour utilities, keeping sizing and alignment intact. */
export function withoutTextColor(className: string): string {
  return className
    .split(/\s+/)
    .filter((token) => token && !isTextColorClass(token))
    .join(" ");
}
