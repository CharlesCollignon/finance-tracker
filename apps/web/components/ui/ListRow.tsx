import type { ReactNode } from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

import { Card } from "@/components/retroui/Card";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";
import { MICRO } from "@/lib/type-scale";

export interface ListRowProps {
  icon?: Icon;
  label: string;
  /** Right-aligned current setting — "Euro (€)", "3 passkeys", an email. */
  value?: ReactNode;
  /** A switch, a badge, anything replacing the chevron. */
  trailing?: ReactNode;
  /** Where the row goes. Renders the row as a link. */
  href?: string;
  /** What the row does. Renders the row as a button. */
  onClick?: () => void;
  /** Deletions read in the destructive colour, icon included. */
  destructive?: boolean;
  disabled?: boolean;
  /** Revealed under the row — an editor, a confirmation, a sub-list. */
  expanded?: ReactNode;
}

/**
 * The settings row, and the group it sits in.
 *
 * Settings had been one card per subject, each with a heading, a paragraph
 * explaining itself and a button — eight of them down a scroll, which is a lot
 * of reading to arrive at a switch. A row states the setting and shows its
 * value; the paragraph survives only as a section footer, and only where the
 * setting is doing something non-obvious.
 *
 * Hover and press are a background wash rather than a lift or a scale: a
 * full-width row that moves under the pointer reads as the list shifting, not
 * as the row responding.
 *
 * The divider is drawn by each row except the first, as an inset pseudo-element
 * rather than by the group handing every child a `last` prop. That keeps the
 * group from cloning its children — see the note in
 * `components/layout/PageContainer.tsx` about what React does to a slot it was
 * handed from a server component — and it means a row can be added or made
 * conditional without the group recounting.
 */
export function ListRow({
  icon: IconGlyph,
  label,
  value,
  trailing,
  href,
  onClick,
  destructive,
  disabled,
  expanded,
}: ListRowProps) {
  const interactive = Boolean((href || onClick) && !disabled);

  const body = (
    <>
      {IconGlyph ? (
        <IconGlyph
          size={ICON.lg}
          className={cn(
            "shrink-0",
            disabled
              ? "text-muted-foreground"
              : destructive
                ? "text-destructive"
                : "text-primary-ink",
          )}
        />
      ) : null}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-left",
          destructive && "text-destructive",
          disabled && "text-muted-foreground",
        )}
      >
        {label}
      </span>
      {value ? (
        <span className="min-w-0 truncate text-sm text-muted-foreground">
          {value}
        </span>
      ) : null}
      {trailing ??
        (interactive ? (
          <CaretRight
            size={ICON.md}
            className="shrink-0 text-muted-foreground"
          />
        ) : null)}
    </>
  );

  const rowClass =
    "flex min-h-14 w-full items-center gap-3 px-5 py-3.5 text-left transition-colors";
  const washClass = "hover:bg-secondary/60 active:bg-secondary";

  return (
    <div
      className={cn(
        "relative",
        // The inset divider. Starts at the label so the icon column reads as
        // one strip rather than as a set of boxed rows.
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0",
        "before:ml-14 before:h-px before:bg-border first:before:hidden",
      )}
    >
      {href && !disabled ? (
        <Link href={href} className={cn(rowClass, washClass)}>
          {body}
        </Link>
      ) : onClick ? (
        <button
          type="button"
          disabled={disabled}
          aria-expanded={expanded === undefined ? undefined : Boolean(expanded)}
          onClick={onClick}
          className={cn(
            rowClass,
            !disabled && washClass,
            disabled && "cursor-not-allowed",
          )}
        >
          {body}
        </button>
      ) : (
        <div className={rowClass}>{body}</div>
      )}

      {expanded ? <div className="px-5 pb-4">{expanded}</div> : null}
    </div>
  );
}

export function ListSection({
  title,
  footer,
  children,
}: {
  title?: string;
  /** The one caveat a row cannot carry — "this does not convert amounts". */
  footer?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex w-full flex-col gap-2">
      {title ? (
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      ) : null}
      <Card.Bezel className="w-full" innerClassName="overflow-hidden p-0">
        {children}
      </Card.Bezel>
      {footer ? (
        <p className={cn("px-1 text-muted-foreground", MICRO)}>{footer}</p>
      ) : null}
    </section>
  );
}
