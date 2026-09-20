import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-control bg-muted", className)}
      aria-hidden="true"
    />
  );
}

/**
 * The shape of the look-through while it is being computed.
 *
 * Mirrors the real page's order — the coverage hero, then the sections — so
 * the layout does not jump when the figures arrive. The tab strip is drawn
 * rather than skeletoned: it is already known and rendering it as bones
 * would make a navigation control look unavailable.
 */
export default function LookThroughLoading() {
  return (
    <>
      <PageHeader titleKey="nav.walletsLookThrough" />
      <PageContainer>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <Bone className="h-8 w-24 rounded-full" />
            <Bone className="h-8 w-28 rounded-full" />
          </div>
          <Bone className="h-8 w-36 rounded-control" />
        </div>

        <div className="flex w-full flex-col items-center gap-5">
          <div className="flex w-full flex-col items-center gap-2">
            <Bone className="h-3 w-40" />
            <Bone className="h-10 w-48" />
            <Bone className="h-3 w-24" />
          </div>

          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="w-full rounded-card p-card border border-border"
            >
              <Bone className="h-4 w-32" />
              <div className="mt-4 flex flex-col gap-3">
                <Bone className="h-3 w-full" />
                <Bone className="h-3 w-5/6" />
                <Bone className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </PageContainer>
    </>
  );
}
