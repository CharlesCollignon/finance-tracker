"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
} from "@phosphor-icons/react";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

/**
 * What the Bearing's cards are made of: the card itself and the change
 * against last month. Each card is a file beside this one; the phone's
 * twins are in `apps/mobile/src/components/bearing/`.
 */

/* ------------------------------------------------------------ the shells */

/**
 * A card on this screen: glass over the lit ground, a small icon and title,
 * and — where there is a surface that explains its figures — a link there.
 * It lifts a pixel under the pointer; nothing else about it moves.
 */
export function Card({
  icon,
  title,
  href,
  hrefLabel,
  action,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  href?: string;
  hrefLabel?: string;
  /** A control of the card's own, beside its link: a switch. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        GLASS_CARD,
        "flex h-full flex-col gap-4 rounded-card p-card",
        "transition-[transform,border-color] duration-hover",
        "hover:-translate-y-0.5 hover:border-foreground/20",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
            {icon}
          </span>
          {title}
        </h2>
        <div className="flex items-center gap-1">
          {action}
          {href ? (
            <Link
              href={href}
              aria-label={hrefLabel ?? title}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-hover hover:bg-muted hover:text-foreground"
            >
              <ArrowRight size={ICON.md} />
            </Link>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  );
}

/** A signed difference, as a pill: up is green and down is red, with an arrow. */
export function DeltaChip({ value, label }: { value: number; label: string }) {
  const format = useFormatCurrency();
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        up
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive",
      )}
      title={label}
    >
      {up ? (
        <ArrowUpRight size={ICON.sm} weight="bold" />
      ) : (
        <ArrowDownRight size={ICON.sm} weight="bold" />
      )}
      <PrivateAmount className="tabular-nums">
        {`${up ? "+" : "−"}${format(Math.abs(value))}`}
      </PrivateAmount>
      <span className="sr-only">{label}</span>
    </span>
  );
}
