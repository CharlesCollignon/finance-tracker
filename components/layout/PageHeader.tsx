import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, children, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b-2 border-border bg-background/95 pt-safe",
        "backdrop-blur-sm md:static md:bg-background",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-lg flex-col gap-3 px-4 py-3",
          "sm:flex-row sm:items-center sm:justify-between",
          "md:max-w-3xl md:px-6 lg:max-w-5xl",
        )}
      >
        <h1 className="font-head text-lg md:text-xl">{title}</h1>
        <div className="flex min-h-11 shrink-0 items-center justify-end gap-2">
          {children}
        </div>
      </div>
    </header>
  );
}
