import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-control bg-muted/40", className)}
    />
  );
}

/**
 * The analysis while it loads. Only the view: the header, the views and the
 * quotes' refresh are Placements' layout's, and stay drawn above it.
 */
export default function AnalysisLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Bone className="h-4 w-72 max-w-full" />
      {/* Return, split, fees. */}
      <Bone className="h-36 w-full" />
      <Bone className="h-64 w-full" />
      <Bone className="h-32 w-full" />
    </div>
  );
}
