"use client";

import type { PointerEvent } from "react";
import Link from "next/link";
import { m, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import {
  featureHref,
  type LandingPageId,
} from "@/components/marketing/landing-copy";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { PAGE_ICON } from "@/components/marketing/page-icons";
import { cn } from "@/lib/utils";

interface Neighbour {
  id: LandingPageId;
  title: string;
  body: string;
}

/**
 * The pages either side, as two large cards that lean after the pointer —
 * a few pixels, on a spring — with the arrow running ahead on hover.
 */
export function PageNav({
  prev,
  next,
  labels,
  ariaLabel,
}: {
  prev: Neighbour | null;
  next: Neighbour | null;
  labels: { previous: string; next: string };
  ariaLabel: string;
}) {
  return (
    <nav
      className="mx-auto mt-24 grid w-full max-w-6xl gap-4 px-6 pb-28 md:grid-cols-2"
      aria-label={ariaLabel}
    >
      {prev ? (
        <NeighbourCard page={prev} label={labels.previous} side="prev" />
      ) : (
        <span />
      )}
      {next ? (
        <NeighbourCard page={next} label={labels.next} side="next" />
      ) : (
        <span />
      )}
    </nav>
  );
}

function NeighbourCard({
  page,
  label,
  side,
}: {
  page: Neighbour;
  label: string;
  side: "prev" | "next";
}) {
  const still = useReducedMotion() ?? false;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 18 });
  const sy = useSpring(y, { stiffness: 200, damping: 18 });
  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      "--x",
      `${event.clientX - box.left}px`,
    );
    event.currentTarget.style.setProperty(
      "--y",
      `${event.clientY - box.top}px`,
    );
    if (still || event.pointerType !== "mouse") return;
    x.set(((event.clientX - box.left) / box.width - 0.5) * 10);
    y.set(((event.clientY - box.top) / box.height - 0.5) * 8);
  }
  const Icon = PAGE_ICON[page.id];
  const Arrow = side === "prev" ? ArrowLeft : ArrowRight;
  return (
    <m.div style={{ x: sx, y: sy }}>
      <Link
        href={featureHref(page.id)}
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          x.set(0);
          y.set(0);
        }}
        className={cn(
          "group relative isolate flex h-full flex-col gap-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-7 transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.05]",
          "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:opacity-0 before:transition-opacity before:duration-500 before:[background:radial-gradient(20rem_circle_at_var(--x,50%)_var(--y,50%),rgb(236_178_94/0.14),transparent_60%)] hover:before:opacity-100",
          side === "next" && "md:items-end md:text-right",
          marketingFocus,
        )}
      >
        <span className="flex items-center gap-2 text-sm text-marketing-faint">
          {side === "prev" ? (
            <Arrow
              size={14}
              className="transition-transform duration-300 group-hover:-translate-x-1"
            />
          ) : null}
          {label}
          {side === "next" ? (
            <Arrow
              size={14}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          ) : null}
        </span>
        <span
          className={cn(
            "flex items-center gap-3",
            side === "next" && "md:flex-row-reverse",
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
            <Icon size={22} weight="duotone" />
          </span>
          <span className="font-head text-2xl text-marketing-ink">
            {page.title}
          </span>
        </span>
        <span className="max-w-sm text-sm leading-relaxed text-marketing-muted">
          {page.body}
        </span>
      </Link>
    </m.div>
  );
}
