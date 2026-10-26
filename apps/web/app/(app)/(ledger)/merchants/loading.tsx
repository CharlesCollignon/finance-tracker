import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-control bg-muted/40", className)}
    />
  );
}

/**
 * By shop while it loads: the search, then a row a shop. Only the view: the
 * header and the views are the Ledger layout's, and stay drawn above it.
 */
export default function MerchantsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Bone className="h-11 w-full" />
      <Bone className="h-16 w-full" />
      <Bone className="h-16 w-full" />
      <Bone className="h-16 w-full" />
      <Bone className="h-16 w-full" />
    </div>
  );
}
