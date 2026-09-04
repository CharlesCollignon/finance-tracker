import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Note for anyone adding a slot prop to a page.
 *
 * Children arrive here as an array and are forwarded into a single expression
 * slot, which is what makes React check every member for a key. Members this
 * app's own JSX created are already marked as checked; an element handed in
 * from a server component as a prop — a `bankSlot`, a `footer` — is not, and
 * shows up as "Each child in a list should have a unique key prop… passed a
 * child from SomePage". Render such a slot inside a wrapper the client
 * component itself creates rather than dropping it in as a bare sibling.
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 max-w-lg md:max-w-3xl lg:max-w-5xl",
        "px-4 py-4 md:px-6 md:py-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
