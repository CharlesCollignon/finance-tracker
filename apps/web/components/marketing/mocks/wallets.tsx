"use client";

import { landingSampleFor } from "@/components/marketing/landing-sample";
import { useLocale, useT } from "@/lib/locale-context";
import {
  MobileShell,
  MockCard,
  type Variant,
  WebHero,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";

/** Placements, as a landing mock (`./frame.tsx`). */

/* ----------------------------------------------------------------- wallets */

export function WalletsMock({ variant = "web" }: { variant?: Variant }) {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const euro = useEuro();
  const { portfolio, portfolioInvested, portfolioGain, wallets } = sample;
  const total = wallets.reduce((sum, wallet) => sum + wallet.value, 0);

  const allocationBar = (
    <div className="h-2.5 w-full overflow-hidden rounded-full" aria-hidden>
      <div className="flex h-full w-full">
        {wallets.map((wallet) => (
          <div
            key={wallet.label}
            style={{
              width: `${(wallet.value / total) * 100}%`,
              backgroundColor: `var(${wallet.colorVar})`,
            }}
          />
        ))}
      </div>
    </div>
  );

  const legend = (
    <ul className="flex w-full flex-col gap-1.5">
      {wallets.map((wallet) => (
        <li
          key={wallet.label}
          className="flex items-center justify-between text-sm"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: `var(${wallet.colorVar})` }}
              aria-hidden
            />
            {wallet.label}
          </span>
          <span className="font-mono tabular-nums">{euro(wallet.value)}</span>
        </li>
      ))}
    </ul>
  );

  if (variant === "mobile") {
    return (
      <MobileShell active="nav.wallets">
        <MockCard innerClassName="p-4">
          <p className="text-sm text-muted-foreground">
            {t("marketingMock.portfolioValue")}
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums">
            {euro(portfolio)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-mono">{euro(portfolioInvested)}</span>
            {` ${t("wallets.investedSuffix")} · `}
            <span className="font-mono text-success">
              +{euro(portfolioGain)}
            </span>
          </p>
        </MockCard>
        <MockCard innerClassName="flex flex-col gap-3 p-4">
          {allocationBar}
          {legend}
        </MockCard>
      </MobileShell>
    );
  }

  return (
    <WebShell active="nav.wallets">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7">
          <MockCard innerClassName="flex h-full flex-col items-center justify-center px-8 py-7">
            <WebHero
              label={t("wallets.marketValue")}
              amount={euro(portfolio)}
              subtitle={
                <p>
                  <span className="privacy-amount tabular-nums">
                    {euro(portfolioInvested)}
                  </span>
                  {` ${t("wallets.investedSuffix")} · `}
                  <span className="privacy-amount font-mono font-medium tabular-nums text-success">
                    +{euro(portfolioGain)}
                  </span>
                </p>
              }
            />
          </MockCard>
        </div>
        <div className="col-span-5">
          <MockCard innerClassName="flex h-full flex-col justify-center gap-4 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("position.allocation")}
            </p>
            {allocationBar}
            {legend}
          </MockCard>
        </div>
      </div>
    </WebShell>
  );
}
