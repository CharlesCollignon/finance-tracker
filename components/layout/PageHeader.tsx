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
        "sticky top-0 z-30 border-b-2 border-border bg-background pt-safe",
        className,
      )}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
        <h1 className="font-head text-lg">{title}</h1>
        {children}
      </div>
    </header>
  );
}
