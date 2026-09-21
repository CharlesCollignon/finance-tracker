"use client";

import { useEffect, useRef, useState } from "react";

/**
 * An overlay that is open for one key at a time, and closes when the key moves.
 *
 * Extracted from the marketing header's Product menu, which invented it, and
 * now shared with the language menu beside it. Two properties are worth
 * keeping as they were.
 *
 * The open state is a key rather than a boolean. The header stays mounted
 * across a navigation, so a boolean would survive one — the menu would still
 * be hanging open over the page it just took you to. Holding the pathname
 * instead makes "closed" a derivation of the route rather than a `setState`
 * cascading after the render that changed it.
 *
 * And the effect closes by calling `setOpenForKey` directly instead of a
 * `close` helper from the render body. A helper would be a new identity every
 * render and so a dependency this effect would re-subscribe on; a state setter
 * is stable, which is what keeps the dependency list down to `open` and the
 * listeners attached exactly once per opening.
 */
export function useKeyedMenu<T extends HTMLElement = HTMLDivElement>(
  key: string,
) {
  const [openForKey, setOpenForKey] = useState<string | null>(null);
  const open = openForKey === key;
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpenForKey(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenForKey(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return {
    open,
    /** Put on the element a click must land inside of to count as "within". */
    ref,
    toggle: () => setOpenForKey(open ? null : key),
    close: () => setOpenForKey(null),
  };
}
