"use client";

import dynamic from "next/dynamic";

/**
 * Only the one mark that needs a runtime is lazy now. The rest render on the
 * server in plain markup, so deferring them would cost a flash of nothing to
 * save a download that no longer happens.
 */
function ChartFallback({ className }: { className?: string }) {
  return (
    <div
      className={
        className ??
        "mx-auto h-40 w-full max-w-md animate-pulse rounded-md bg-muted/40"
      }
      aria-hidden
    />
  );
}

export const InvestmentItemChart = dynamic(
  () =>
    import("@/components/finance/InvestmentItemChart").then(
      (m) => m.InvestmentItemChart,
    ),
  {
    ssr: false,
    loading: () => <ChartFallback className="h-48 w-full" />,
  },
);
