import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  SHELL_HEADER_ACTIONS_CLASS,
  SHELL_HEADER_INNER_CLASS,
} from "@/lib/layout-shell";
import { PrivacyToggle } from "@/components/layout/PrivacyToggle";

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, children, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 box-border h-[calc(var(--shell-header-height)+env(safe-area-inset-top,0px))] shrink-0",
        "border-b border-border bg-background/95 pt-safe backdrop-blur-sm",
        "md:static md:h-[var(--shell-header-height)] md:bg-background md:pt-0",
        className,
      )}
    >
      <div className={SHELL_HEADER_INNER_CLASS}>
        <h1 className="shrink-0 font-head text-lg leading-none md:text-xl">
          {title}
        </h1>
        <div className={SHELL_HEADER_ACTIONS_CLASS}>
          {children}
          <PrivacyToggle className="shrink-0" />
        </div>
      </div>
    </header>
  );
}
