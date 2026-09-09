import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { slotSpan } from "@finance/core/bearing-tiles";
import { GLASS_CARD } from "@/lib/glass";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted/40", className)} />;
}

const SPAN_CLASS: Record<ReturnType<typeof slotSpan>, string> = {
  hero: "col-span-2 row-span-2",
  wide: "col-span-2",
  unit: "col-span-1",
};

/**
 * The shape of the Bearing before its figures arrive.
 *
 * The real bento, drawn from `slotSpan` rather than from a hand-written list
 * of sizes — so a change to the grid's rhythm cannot leave the skeleton
 * describing a layout that no longer exists. The Month screen's own loading
 * file records that exact failure: it drew centred rings for a page that had
 * been rebuilt around something else, which is a worse loading state than
 * none.
 *
 * Ten tiles rather than the full twelve. Somebody with every figure gets two
 * more cards than the skeleton promised, which settles downward and is barely
 * visible; the reverse — a skeleton taller than the page — leaves a scrollbar
 * that vanishes.
 */
export default function BearingLoading() {
  return (
    <>
      <PageHeader titleKey="nav.bearing" />
      <PageContainer className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Bone className="h-3 w-64 max-w-full" />
          <Bone className="h-8 w-32 rounded-full" />
        </div>

        <div className="grid grid-cols-2 gap-3 [grid-auto-flow:row_dense] md:grid-cols-4 md:gap-4">
          {Array.from({ length: 10 }).map((_, index) => {
            const span = slotSpan(index);
            return (
              <div
                key={index}
                className={cn(
                  "flex min-h-[7.5rem] flex-col justify-between rounded-3xl p-4 md:p-5",
                  GLASS_CARD,
                  span === "hero" && "min-h-[11rem] md:p-6",
                  SPAN_CLASS[span],
                )}
              >
                <Bone className="h-4 w-24" />
                <Bone
                  className={cn("h-8 w-32", span === "hero" && "h-12 w-48")}
                />
              </div>
            );
          })}
        </div>
      </PageContainer>
    </>
  );
}
