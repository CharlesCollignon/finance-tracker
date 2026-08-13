"use client";

import { useState } from "react";
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
      {/* External brand marks 404 often; img + onError is the fallback path. */}
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
