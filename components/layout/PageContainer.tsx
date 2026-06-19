import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

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
