"use client";

import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface FadeInProps {
  children: ReactNode;
  className?: string;
}

type StyledProps = {
  className?: string;
  children?: ReactNode;
};

/** Flatten Fragments so we never put className on React.Fragment. */
function flattenElements(children: ReactNode): ReactElement<StyledProps>[] {
  const result: ReactElement<StyledProps>[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<StyledProps>(child)) {
      return;
    }

    if (child.type === Fragment) {
      result.push(...flattenElements(child.props.children));
      return;
    }

    result.push(child);
  });

  return result;
}

/**
 * A screen's blocks arriving: one fade, all of them at once.
 *
 * This was `Stagger`, which brought each block up from below 40ms after the
 * one before it. Since October 2026 everything in the app arrives as a fade
 * and nothing waits its turn (`DURATION.enter`, DESIGN.md « Motion »). The
 * fade runs once on mount, so a re-render does not replay it. Each child
 * still gets its own wrapper, so a screen's layout is the one it had.
 */
export function FadeIn({ children, className }: FadeInProps) {
  const items = flattenElements(children);

  return (
    <div className={cn("fade-in", className)}>
      {items.map((child, index) => {
        const key = child.key ?? index;

        if (child.type === FadeInItem) {
          return cloneElement(child, { key });
        }

        return <FadeInItem key={key}>{child}</FadeInItem>;
      })}
    </div>
  );
}

export function FadeInItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
