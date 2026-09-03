import type { ReactNode } from "react";
import Image from "next/image";
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
        {/* Shrinks and truncates rather than holding its width: on a 320px
            screen the month picker and the title together are wider than the
            band, and a fixed title zone means they overlap rather than one of
            them giving way. */}
        <div className="flex min-w-0 shrink items-center gap-2">
          {/* The bare orb rather than the full composition: at this size the
              furrow drawn in the ground is a smudge, while the sphere still
              reads. */}
          <Image
            src="/logo-mark.png"
            alt=""
            aria-hidden
            width={22}
            height={22}
            priority
            className="shrink-0"
            style={{ width: 22, height: 22 }}
          />
          <h1 className="truncate font-head text-lg leading-none md:text-xl">
            {title}
          </h1>
        </div>
        <div className={SHELL_HEADER_ACTIONS_CLASS}>
          {children}
          <PrivacyToggle className="shrink-0" />
        </div>
      </div>
    </header>
  );
}
