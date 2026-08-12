"use client";

import { useEffect, useState, type RefObject } from "react";

/** Keep an ECharts instance sized to its container without React re-renders. */
export function useEchartsSize(
  containerRef: RefObject<HTMLElement | null>,
  chartRef: RefObject<{
    getEchartsInstance: () => { resize: () => void };
  } | null>,
): void {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const apply = (): void => {
      chartRef.current?.getEchartsInstance()?.resize();
    };

    apply();
    const frame = window.requestAnimationFrame(apply);
    const observer = new ResizeObserver(apply);
    observer.observe(el);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [chartRef, containerRef]);
}

/** Stable compact flag for chart layout (no per-pixel width updates). */
export function useCompactViewport(maxWidthPx = 419): boolean {
  const [compact, setCompact] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(`(max-width: ${maxWidthPx}px)`).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const onChange = (): void => {
      setCompact((prev) => (prev === media.matches ? prev : media.matches));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [maxWidthPx]);

  return compact;
}
