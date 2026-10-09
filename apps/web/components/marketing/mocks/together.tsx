"use client";

import { landingSampleFor } from "@/components/marketing/landing-sample";
import {
  ACTIVE_NAV,
  MOBILE_HEIGHT,
  MOBILE_WIDTH,
  MockViewport,
  WEB_HEIGHT,
  WEB_WIDTH,
  MobileHero,
  MobileShell,
  MockCard,
  type Variant,
  WebHero,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/** The shared space, as a landing mock (`./frame.tsx`). */

/** « Moi · Commun », the shared space chosen. */
function OwnerSwitch() {
  const { together } = landingSampleFor(useLocale());
  return (
    <div className="flex self-center rounded-full border border-border p-1 text-sm">
      <span className="rounded-full px-3 py-1 text-muted-foreground">
        {together.me}
      </span>
      <span className="rounded-full bg-muted px-3 py-1 font-medium">
        {together.name}
      </span>
    </div>
  );
}

/** How the joint spending splits, and what is the reader's part of it. */
function ShareCard({ compact }: { compact: boolean }) {
  const t = useT();
  const euro = useEuro();
  const { together } = landingSampleFor(useLocale());
  const part = `${together.share} %`;
  return (
    <MockCard innerClassName={compact ? "p-4" : "p-5"}>
      <p className="text-sm font-medium">{t("space.shareRow")}</p>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
        <div className="bg-primary" style={{ width: `${together.share}%` }} />
        <div className="flex-1 bg-chart-2" />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{t("space.shareYou", { part })}</span>
        <span>{t("space.sharePartner", { name: "B.", part })}</span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        <span className="font-mono text-foreground tabular-nums">
          {euro(together.myPart)}
        </span>{" "}
        / {euro(together.spent)}
      </p>
    </MockCard>
  );
}

function SharedRows({ compact }: { compact: boolean }) {
  const euro = useEuro();
  const { together } = landingSampleFor(useLocale());
  return (
    <MockCard innerClassName={compact ? "p-2" : "p-3"}>
      <ul className="flex flex-col">
        {together.rows.map((row) => (
          <li
            key={row.name}
            className="flex items-center gap-3 rounded-lg px-2 py-2"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {row.by}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{row.name}</span>
              <span className="block text-[11px] text-muted-foreground">
                {row.meta}
              </span>
            </span>
            <span
              className={cn(
                "font-mono text-sm tabular-nums",
                row.amount > 0 && "text-success",
              )}
            >
              {row.amount > 0 ? "+" : ""}
              {euro(row.amount)}
            </span>
          </li>
        ))}
      </ul>
    </MockCard>
  );
}

export function TogetherMock({ variant = "web" }: { variant?: Variant }) {
  const t = useT();
  const euro = useEuro();
  const { together } = landingSampleFor(useLocale());
  if (variant === "mobile") {
    return (
      <MockViewport width={MOBILE_WIDTH} height={MOBILE_HEIGHT}>
        <MobileShell active={ACTIVE_NAV.together}>
          <OwnerSwitch />
          <MockCard innerClassName="p-4">
            <MobileHero
              label={t("bearingMonth.onAccount")}
              amount={euro(together.balance)}
            />
          </MockCard>
          <ShareCard compact />
          <SharedRows compact />
        </MobileShell>
      </MockViewport>
    );
  }
  return (
    <MockViewport width={WEB_WIDTH} height={WEB_HEIGHT}>
      <WebShell active={ACTIVE_NAV.together}>
        <div className="grid flex-1 grid-cols-12 gap-4">
          <div className="col-span-7 flex flex-col gap-4">
            <OwnerSwitch />
            <MockCard innerClassName="p-5">
              <WebHero
                label={t("bearingMonth.onAccount")}
                amount={euro(together.balance)}
              />
            </MockCard>
            <ShareCard compact={false} />
          </div>
          <div className="col-span-5">
            <SharedRows compact={false} />
          </div>
        </div>
      </WebShell>
    </MockViewport>
  );
}
