"use client";

import { useEffect, useState, type RefObject } from "react";

/** Track container width and keep ECharts sized to it. */
export function useEchartsSize(
  containerRef: RefObject<HTMLElement | null>,
  chartRef: RefObject<{ getEchartsInstance: () => { resize: () => void } } | null>,
): number | undefined {
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const apply = (): void => {
      const next = Math.floor(el.getBoundingClientRect().width);
      if (next > 0) {
        setWidth(next);
      }
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

  return width;
}
