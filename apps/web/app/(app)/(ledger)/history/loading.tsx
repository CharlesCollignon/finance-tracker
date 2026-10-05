import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-control bg-muted/40", className)}
    />
  );
}

/**
 * By category while it loads: the month's split, then a card per category.
 * Only the view: the header and the views are the Ledger layout's, and stay
 * drawn above it.
 */
export default function HistoryLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Bone className="h-40 w-full" />
      <Bone className="h-24 w-full" />
      <Bone className="h-24 w-full" />
      <Bone className="h-24 w-full" />
    </div>
  );
}
