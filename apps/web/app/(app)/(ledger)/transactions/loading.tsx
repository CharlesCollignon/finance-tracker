import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-control bg-muted/40", className)}
    />
  );
}

/**
 * The list while it loads. Only the list: the header, the views and the
 * month are the Ledger layout's, and stay drawn above it.
 */
export default function TransactionsLoading() {
  return (
    <div className="flex flex-col items-center gap-8 md:gap-10">
      <div className="flex w-full flex-col items-center gap-2">
        <Bone className="h-4 w-28" />
        <Bone className="h-12 w-44 md:h-14" />
        <Bone className="h-4 w-52" />
      </div>
      <Bone className="h-64 w-full max-w-2xl" />
      <div className="flex gap-3">
        <Bone className="h-9 w-32" />
        <Bone className="h-9 w-36" />
      </div>
      <div className="w-full space-y-3">
        <Bone className="h-4 w-full" />
        <Bone className="h-10 w-full" />
        <Bone className="h-10 w-full" />
        <Bone className="h-10 w-full" />
        <Bone className="h-10 w-full" />
      </div>
    </div>
  );
}
