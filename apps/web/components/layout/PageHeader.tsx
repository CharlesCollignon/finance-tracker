import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  SHELL_HEADER_ACTIONS_CLASS,
  SHELL_HEADER_INNER_CLASS,
} from "@/lib/layout-shell";

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, children, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 shrink-0 border-b-2 border-border",
        "bg-background/95 pt-safe backdrop-blur-sm",
        "md:static md:box-border md:h-[var(--shell-header-height)] md:bg-background",
        "md:pt-0",
        className,
      )}
    >
      <div className={SHELL_HEADER_INNER_CLASS}>
        <h1 className="shrink-0 font-head text-lg leading-none md:text-xl">
          {title}
        </h1>
        {children ? (
          <div className={SHELL_HEADER_ACTIONS_CLASS}>{children}</div>
        ) : null}
      </div>
    </header>
  );
}
