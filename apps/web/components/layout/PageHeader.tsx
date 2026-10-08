import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Orb } from "@/components/brand/Orb";
import { GLASS_CHROME } from "@/lib/glass";
import {
  SHELL_HEADER_ACTIONS_CLASS,
  SHELL_HEADER_INNER_CLASS,
} from "@/lib/layout-shell";
import type { Key } from "@finance/core/i18n/t";
import { HeaderAccountMenu } from "@/components/layout/AccountLabel";
import { HeaderTitle } from "@/components/layout/OwnerSwitch";
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

/**
 * The band at the top of a page: on a phone, the only bar at the top of the
 * screen — the orb, the page's title, its controls, the refresh, the
 * privacy blur and the account menu — sticky on the chrome glass.
 *
 * From `md` the notch is the chrome and says where you are, and the top bar
 * beside it holds the refresh and the blur, so this band keeps only what is
 * the page's own: the controls a caller hands in, like the month picker. The
 * title stays in the document for screen readers — it is still the page's
 * one `h1` — but is not drawn. A page with no controls of its own has
 * nothing left to show, so the whole band goes the same way and takes no
 * room, and the page starts right under the notch.
 */
export function PageHeader({ titleKey, children, className }: PageHeaderProps) {
  const bare = !children;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 box-border h-[calc(var(--shell-header-height)+env(safe-area-inset-top,0px))] shrink-0",
        "border-b pt-safe",
        GLASS_CHROME,
        bare
          ? "md:sr-only"
          : // No glass and no hairline: the controls sit on the page rather
            // than in a bar of their own under the notch.
            "md:static md:h-[var(--shell-header-height)] md:border-b-0 md:bg-transparent md:pt-0 md:backdrop-filter-none",
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
              glass header a clear shell has nothing to catch. Phone only:
              from `md` the top bar's wordmark is right above it. Hidden on a
              wrapper because `.pc-orb` sets its own `display` outside
              Tailwind's layers, and an unlayered rule beats `md:hidden`. */}
          <span className="flex shrink-0 md:hidden">
            <Orb size="22px" tone="mark" />
          </span>
          {/* The switch takes the title's place on a shared screen, for
              someone in a space. */}
          <HeaderTitle>
            <PageTitle titleKey={titleKey} />
          </HeaderTitle>
        </div>
        <div className={SHELL_HEADER_ACTIONS_CLASS}>
          {children}
          {/* All three phone only: from `md` the top bar carries them, and
              these would be second buttons saying the same thing. The
              refresh and the account menu render nothing outside the app
              shell, so the auth and marketing headers are unaffected. */}
          <RefreshButton className="md:hidden" />
          <PrivacyToggle className="md:hidden" />
          <HeaderAccountMenu />
        </div>
      </div>
    </header>
  );
}
