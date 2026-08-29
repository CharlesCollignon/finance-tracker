"use client";

import dynamic from "next/dynamic";

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

export const ProgressRing = dynamic(
  () => import("@/components/finance/ProgressRing").then((m) => m.ProgressRing),
  {
    ssr: false,
    loading: () => <ChartFallback className="h-[100px] w-[100px]" />,
  },
);

export const DashboardWalletsCard = dynamic(
  () =>
    import("@/components/finance/DashboardWalletsCard").then(
      (m) => m.DashboardWalletsCard,
    ),
  {
    ssr: false,
    loading: () => <ChartFallback className="mx-auto h-56 w-full max-w-md" />,
  },
);

export const DashboardAllocationChart = dynamic(
  () =>
    import("@/components/finance/DashboardAllocationChart").then(
      (m) => m.DashboardAllocationChart,
    ),
  {
    ssr: false,
    loading: () => <ChartFallback className="mx-auto h-72 w-full max-w-lg" />,
  },
);

export const TransactionTypeSankey = dynamic(
  () =>
    import("@/components/finance/TransactionTypeSankey").then(
      (m) => m.TransactionTypeSankey,
    ),
  {
    ssr: false,
    loading: () => <ChartFallback className="mx-auto h-64 w-full max-w-2xl" />,
  },
);

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
