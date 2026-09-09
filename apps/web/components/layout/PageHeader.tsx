import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Orb } from "@/components/brand/Orb";
import { GLASS_CHROME } from "@/lib/glass";
import {
  SHELL_HEADER_ACTIONS_CLASS,
  SHELL_HEADER_INNER_CLASS,
} from "@/lib/layout-shell";
import type { Key } from "@finance/core/i18n/t";
import { PageTitle } from "@/components/layout/PageTitle";
import { PrivacyToggle } from "@/components/layout/PrivacyToggle";
import { RefreshButton } from "@/components/layout/RefreshButton";

interface PageHeaderProps {
  /**
   * The message key for the heading, not the heading.
   *
   * Every page's title is one of a fixed set of surface names, so a key is
   * all a caller ever needs — and it lets the skeletons in `loading.tsx`
   * stay synchronous while still being translated. See `PageTitle`.
   */
  titleKey: Key;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ titleKey, children, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 box-border h-[calc(var(--shell-header-height)+env(safe-area-inset-top,0px))] shrink-0",
        "border-b pt-safe",
        GLASS_CHROME,
        "md:static md:h-[var(--shell-header-height)] md:pt-0",
        className,
      )}
    >
      <div className={SHELL_HEADER_INNER_CLASS}>
        {/* Shrinks and truncates rather than holding its width: on a 320px
            screen the month picker and the title together are wider than the
            band, and a fixed title zone means they overlap rather than one of
            them giving way. */}
        <div className="flex min-w-0 shrink items-center gap-2">
          {/* The orb alone, with no wordmark: the app's own name is on the
              tab and the home screen, and the band beside it is already
              carrying the page title. `tone="mark"` because at 22px over a
              glass header a clear shell has nothing to catch. */}
          <Orb size="22px" tone="mark" className="shrink-0" />
          <h1 className="truncate font-head text-lg leading-none md:text-xl">
            <PageTitle titleKey={titleKey} />
          </h1>
        </div>
        <div className={SHELL_HEADER_ACTIONS_CLASS}>
          {children}
          {/* Renders nothing outside the app shell, so the auth and marketing
              headers are unaffected. On a desktop the sidebar carries the
              wide version and this one would be a second button saying the
              same thing. */}
          <RefreshButton className="md:hidden" />
          <PrivacyToggle className="shrink-0" />
        </div>
      </div>
    </header>
  );
}
