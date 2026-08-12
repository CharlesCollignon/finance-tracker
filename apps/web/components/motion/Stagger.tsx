"use client";

import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface StaggerProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
}

type StyledProps = {
  className?: string;
  style?: CSSProperties;
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

/** CSS stagger enter — no framer-motion. */
export function Stagger({ children, className, stagger = 0.04 }: StaggerProps) {
  const items = flattenElements(children);

  return (
    <div className={cn(className)}>
      {items.map((child, index) => {
        const delay = `${index * stagger}s`;
        const style: CSSProperties = {
          ...child.props.style,
          animationDelay: delay,
        };
        const key = child.key ?? index;

        if (child.type === StaggerItem) {
          return cloneElement(child, { key, style });
        }

        if (typeof child.type === "string") {
          return cloneElement(child, {
            key,
            className: cn("stagger-item", child.props.className),
            style,
          });
        }

        return (
          <div key={key} className="stagger-item" style={style}>
            {child}
          </div>
        );
      })}
    </div>
  );
}

export function StaggerItem({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn("stagger-item", className)} style={style}>
      {children}
    </div>
  );
}
