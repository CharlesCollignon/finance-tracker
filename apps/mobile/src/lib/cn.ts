/**
 * Minimal className joiner for NativeWind. Filters out falsy values so
 * conditional classes read cleanly: cn("base", active && "bg-primary").
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
