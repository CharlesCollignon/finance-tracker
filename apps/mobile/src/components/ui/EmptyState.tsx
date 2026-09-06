import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  /** What could be done here, in a handful of words. */
  title: string;
  /** One short line. If it needs a second, it belongs behind the action. */
  description: string;
  className?: string;
  /** The single thing to do next. One, not a choice of two. */
  children?: ReactNode;
}

/**
 * An empty view is an invitation, not a void.
 *
 * These had been a centred statement over a dashed outline with a paragraph
 * under it — the shape of a missing thing. A dashed border reads as a
 * placeholder that failed to load; a solid surface with something to do on it
 * reads as a step. Left-aligned for the same reason the rest of the app is:
 * a heading centred over body text has nothing to line up with.
 */

export function EmptyState({
  title,
  description,
  className,
  children,
}: EmptyStateProps) {
  return (
    <View
      className={cn(
        "gap-2 rounded-card border border-border bg-card/70 p-6",
        className,
      )}
    >
      <Text variant="title">{title}</Text>
      <Text variant="muted">{description}</Text>
      {children ? <View className="mt-3">{children}</View> : null}
    </View>
  );
}
