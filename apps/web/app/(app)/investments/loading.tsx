import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-control bg-muted/40", className)}
    />
  );
}

/**
 * The accounts while they load. Only the view: the header, the views and the
 * quotes' refresh are Placements' layout's, and stay drawn above it.
 */
export default function InvestmentsLoading() {
  return (
    <div className="flex flex-col items-center gap-8 md:gap-10">
      <div className="flex w-full flex-col items-center gap-2">
        <Bone className="h-4 w-28" />
        <Bone className="h-12 w-44 md:h-14" />
        <Bone className="h-4 w-56" />
      </div>
      <div className="flex gap-4">
        <Bone className="h-4 w-12" />
        <Bone className="h-4 w-12" />
        <Bone className="h-4 w-16" />
      </div>
      <div className="flex w-full max-w-md flex-wrap justify-center gap-2">
        <Bone className="h-10 w-16" />
        <Bone className="h-10 w-16" />
        <Bone className="h-10 w-12" />
        <Bone className="h-10 w-16" />
        <Bone className="h-10 w-20" />
      </div>
      <div className="w-full space-y-3">
        <Bone className="h-4 w-24" />
        {/* The range switch, then rows that now carry their own line. */}
        <Bone className="ml-auto h-9 w-60 rounded-full" />
        <Bone className="h-32 w-full" />
        <Bone className="h-32 w-full" />
      </div>
    </div>
  );
}
