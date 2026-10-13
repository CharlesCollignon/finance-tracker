"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  m,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
} from "motion/react";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

/** Where on the screen a section counts as the one being read. */
const READ_AT = 0.3;

/** Asked again after the first frame, once the guide's text is in the page. */
function subscribeOnce(onChange: () => void): () => void {
  const frame = requestAnimationFrame(onChange);
  return () => cancelAnimationFrame(frame);
}

function readSections(bodyId: string): string {
  const headings = document.querySelectorAll<HTMLElement>(
    `#${bodyId} [data-guide-section]`,
  );
  return JSON.stringify(
    [...headings].map((heading) => ({
      id: heading.id,
      text: heading.textContent ?? "",
    })),
  );
}

/**
 * A guide's contents in the margin, on a desktop: its sections, the one
 * being read in the ink grey, and beside them a line that fills as the
 * guide is read. On a phone, where there is no margin, the same progress is
 * a hairline across the top of the screen. Ink, not gold: reading a guide
 * is not a figure or a moment. Both follow the scroll and nothing else, so
 * reduced motion changes nothing here.
 */
export function GuideToc({ label, bodyId }: { label: string; bodyId: string }) {
  const raw = useSyncExternalStore(
    subscribeOnce,
    () => readSections(bodyId),
    () => "[]",
  );
  const sections = useMemo(
    () => JSON.parse(raw) as { id: string; text: string }[],
    [raw],
  );
  const [active, setActive] = useState<string | null>(null);
  const progress = useMotionValue(0);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", () => {
    const body = document.getElementById(bodyId);
    if (!body) {
      return;
    }
    const box = body.getBoundingClientRect();
    const span = Math.max(1, box.height - window.innerHeight * 0.6);
    progress.set(Math.min(1, Math.max(0, -box.top / span)));

    const line = window.innerHeight * READ_AT;
    let current: string | null = null;
    for (const section of sections) {
      const heading = document.getElementById(section.id);
      if (heading && heading.getBoundingClientRect().top <= line) {
        current = section.id;
      }
    }
    setActive((previous) => (previous === current ? previous : current));
  });

  return (
    <>
      <m.div
        aria-hidden
        className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-white/85 md:hidden"
        style={{ scaleX: progress }}
      />
      {sections.length > 0 ? (
        <nav aria-label={label} className="sticky top-32 hidden md:block">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-marketing-faint">
            {label}
          </p>
          <div className="relative mt-4 pl-5">
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-px bg-white/10"
            />
            <m.span
              aria-hidden
              className="absolute inset-y-0 left-0 w-px origin-top bg-white/85"
              style={{ scaleY: progress }}
            />
            <ol className="flex flex-col gap-1">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    aria-current={active === section.id ? "true" : undefined}
                    className={cn(
                      "block rounded-control py-1.5 text-sm leading-snug transition-colors duration-hover",
                      marketingFocus,
                      active === section.id
                        ? "text-marketing-ink"
                        : "text-marketing-muted hover:text-white",
                    )}
                  >
                    {section.text}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      ) : null}
    </>
  );
}
