"use client";

import { useState } from "react";
import { isBitcoinSymbol } from "@finance/core/crypto-holdings";
import { instrumentLogoUrl } from "@finance/core/market/logo";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { cn } from "@/lib/utils";

interface InstrumentLogoProps {
  symbol: string | null;
  name: string;
  fallbackIcon?: string | null;
  className?: string;
}

export function InstrumentLogo({
  symbol,
  name,
  fallbackIcon = null,
  className,
}: InstrumentLogoProps) {
  const [failed, setFailed] = useState(false);
  const src = symbol ? instrumentLogoUrl(symbol) : null;

  // Bitcoin carries the app's own mark: a whole disc, nothing to crop.
  if (isBitcoinSymbol(symbol)) {
    return <BitcoinMark title={name} className={className} />;
  }

  if (!src || failed) {
    return (
      <CategoryIcon
        icon={fallbackIcon}
        className={cn("rounded-full", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center overflow-hidden",
        "rounded-full border border-border bg-white",
        className,
      )}
    >
      {/* External brand marks 404 often; img + onError is the fallback path.
          next/image would need every logo host allow-listed and cannot fall
          back when one fails. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
      <img
        src={src}
        alt=""
        title={name}
        referrerPolicy="no-referrer"
        loading="lazy"
        className="size-full origin-center scale-125 object-cover object-center"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

/** The Bitcoin mark (`public/logos/bitcoin.png`), as a round logo. */
function BitcoinMark({
  title,
  className,
}: {
  title?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a 9 KB local mark
    <img
      src="/logos/bitcoin.png"
      alt=""
      title={title}
      width={32}
      height={32}
      className={cn("size-8 shrink-0 rounded-full", className)}
    />
  );
}
